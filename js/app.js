/* V1.5.6 HOTFIX: Modul pengulangan soal.
   File js/retry.js tetap disertakan; fallback ini menjaga permainan
   tetap berjalan bila pengguna memasang patch lama tidak lengkap. */
if (typeof window !== "undefined" && !window.SLRetry) {
/*
 * Snake & Ladder Knowledge Battle — Question Retry Manager v1.5.1
 * A wrong or timed-out question is offered again to the SAME team, after
 * two other answered questions when enough different questions exist.
 * It does not store/reveal answer keys and is session-only.
 */
(function(root, factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.SLRetry=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  function questionKey(q){
    return q && q.id != null ? String(q.id) : [q?.level,q?.grade,q?.subject,q?.topic,q?.question].join('|');
  }
  function createSession(teamCount, delay=2){
    if(!Number.isInteger(teamCount)||teamCount<1)throw new Error('Jumlah tim tidak valid.');
    if(!Number.isInteger(delay)||delay<0)throw new Error('Jeda ulang tidak valid.');
    const teams=Array.from({length:teamCount},()=>({answered:0,pending:[],recent:[],totalWrong:0,recovered:0}));
    function team(index){if(!Number.isInteger(index)||!teams[index])throw new Error('Tim tidak tersedia.');return teams[index];}
    function next(index, fresh){
      const t=team(index);
      const due=t.pending.find(e=>e.readyAt<=t.answered);
      let q=due?.question, retry=!!due;
      if(!q){
        const excluded=new Set(t.pending.map(e=>e.key));
        q=fresh(excluded,new Set(t.recent));
        if(!q && t.pending.length){q=t.pending[0].question;retry=true;} // Bank sangat kecil.
        if(!q)q=fresh(new Set(),new Set());
        if(!q)throw new Error('Tidak ada soal tersedia untuk dimainkan.');
        retry=retry||t.pending.some(e=>e.key===questionKey(q));
      }
      t.recent=[...t.recent,questionKey(q)].slice(-2);
      return {question:q,retry};
    }
    function record(index,q,correct){
      const t=team(index),key=questionKey(q),pendingIdx=t.pending.findIndex(e=>e.key===key);
      t.answered++;
      if(correct){if(pendingIdx>=0){t.pending.splice(pendingIdx,1);t.recovered++;}}
      else {
        t.totalWrong++;
        if(pendingIdx>=0){t.pending[pendingIdx].readyAt=t.answered+delay;t.pending[pendingIdx].attempts++;}
        else t.pending.push({key,question:q,readyAt:t.answered+delay,attempts:1});
      }
      return {pending:t.pending.length,recovered:t.recovered,wrongAttempts:t.totalWrong};
    }
    function stats(index){const t=team(index);return {pending:t.pending.length,recovered:t.recovered,wrongAttempts:t.totalWrong,answered:t.answered};}
    return {next,record,stats,questionKey};
  }
  return {createSession,questionKey};
});

}
(() => {
'use strict';
const R = window.SLRules;
const CAT = window.SLCatalog;
const RETRY = window.SLRetry;
// V1.5.12a: satu label PAI untuk filter, impor JSON, dan katalog.
const PAI_SUBJECT = 'PAI & Budi Pekerti';
function canonicalSubject(value){
  const s=String(value??'').trim();
  return /^Pendidikan\s+Agama\s+Islam\s+dan\s+Budi\s+Pekerti$/i.test(s)?PAI_SUBJECT:s;
}
const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
const COLORS = ['Merah','Biru','Hijau','Kuning','Ungu','Oranye'];
const PATH = (kind, i) => `assets/optimized/${kind}/${kind === 'players' ? 'player' : 'dice'}-${String(i+1).padStart(2,'0')}.webp`;
const storage = {
  get(key, fallback) { try { const data = JSON.parse(localStorage.getItem(key)); return data == null ? fallback : data; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* browser private or storage unavailable */ } }
};
const DEFAULT_SETTINGS = Object.freeze({music:true,musicVolume:20,sfx:true,art:true,shuffle:true,timer:30,cycle:20});
let settings = {...DEFAULT_SETTINGS,...storage.get('slkb.settings.v1', {})};
let customQuestions = storage.get('slkb.custom.v1', []);
let cloudQuestions = []; // Memory-only, cleared at logout; never cache private questions in localStorage.
let premiumQuestions = []; // Hanya paket soal untuk sesi game, disimpan sementara di memori.
let masterTotalCount=0;
let cloudSyncWarnings=[]; // Diagnostik sesi; tidak menyimpan kata sandi atau token.
let bankPage=1,bankPageSize=25,bankRequestSeq=0,setupCountSeq=0,setupLoadBusy=false;
const facetCache=new Map(),facetSequence={setup:0,bank:0};
let gameMasterFilterKey='';
let activationRequests = []; 
let cloudBusy = false;
let authMode = 'login';
let authVerificationEmail = '';

if (!Array.isArray(customQuestions)) customQuestions=[];
let count=2, currentView='menu', previousView='menu', state=null, subject='SD • Semua Kelas • Semua Mata Pelajaran';
let selectedBank={level:'SD',grade:'all',subject:'all',topic:'all'};
let editingQuestionId=null;
let phase='idle', lastRoll=1, activeQuestion=null, activeChoices=[], choiceSelected=-1, isCorrect=false;
let deck=[], deckIndex=0, usedQuestionKeys=new Set(), quizNumber=0, timerHandle=null, timerLeft=0, toastHandle=null;
let retrySession=null, isRetryQuestion=false;
let inputSubject='';
function updateMusic() { window.SLAudio?.configure(settings); }
function showToast(msg) {const el=$('toast');el.textContent=msg;el.hidden=false;clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.hidden=true,3500)}
function fitLowGradeOptions(q){
  if(q.level==='SD' && Number(q.grade)<=3 && Number(q.grade)>=1 && Array.isArray(q.choices) && q.choices.length===4){
    let ans=typeof q.answer==='string'?'ABCD'.indexOf(q.answer.toUpperCase()):Number(q.answer);
    const remove=[3,2,1,0].find(i=>i!==ans);
    return {...q, choices:q.choices.filter((_,i)=>i!==remove),answer:ans>remove?ans-1:ans};
  }
  return q;
}
function canManageBank(){return !!(window.SLCloud?.user && window.SLCloud?.premium);}
function requireBankPremium(){if(canManageBank())return true;showToast('🔒 Tambah soal dan impor CSV/JSON hanya untuk akun Premium aktif.');return false;}
function syncBankAccess(){
  const unlocked=canManageBank();
  $('bankPremiumLocked').hidden=unlocked;
  $('bankPremiumGuide').hidden=false; // Panduan tersedia juga bagi guru pengguna Demo
  $('bankPremiumTools').hidden=!unlocked;
  $('bankEditorPanel').hidden=!unlocked;
  $('bankLayout').classList.toggle('bank-readonly',!unlocked);
}
function getLocalQuestions(){
  const extras=canManageBank()?[...customQuestions,...cloudQuestions.filter(q=>q.status==='approved'||q.ownerId===window.SLCloud?.user?.id)]:[];
  return [...window.SLDemoQuestions,...(window.SLExpansionQuestions||[]),...extras].map(fitLowGradeOptions);
}
function getAllQuestions(){return [...getLocalQuestions(),...premiumQuestions].map(fitLowGradeOptions)}
function matches(q,f){return (f.level==='all'||q.level===f.level) && (f.grade==='all'||Number(q.grade)===Number(f.grade)) && (f.subject==='all'||canonicalSubject(q.subject)===canonicalSubject(f.subject)) && (f.topic==='all'||q.topic===f.topic)}
function poolOf(f){return getAllQuestions().filter(q=>matches(q,f))}
function options(select, values, current, fallback='all'){
  select.replaceChildren();for(const [val,label] of values){const o=el('option',null,label);o.value=String(val);select.append(o)}
  select.value=values.some(([v])=>String(v)===String(current))?String(current):fallback;
  if(!select.value&&values.length)select.selectedIndex=0;
}
function levelGrades(level){return CAT.GRADES[level]||[]}
function subjectOptions(level,grade='all'){
  const base=CAT.SUBJECTS[level]||[];
  const custom=getLocalQuestions().filter(q=>(level==='all'||q.level===level) && (grade==='all'||Number(q.grade)===Number(grade))).map(q=>q.subject);
  const facets=facetCache.get(`${level}|${grade}`)||[];
  return [...new Set([...base,...custom,...facets.map(q=>q.subject)].map(canonicalSubject))].sort((a,b)=>a.localeCompare(b,'id'));
}
function currentFilter(prefix){
  return {level:$(prefix==='setup'?'setupLevel':'bankLevel').value,grade:$(prefix==='setup'?'setupGrade':'bankGrade').value||'all',subject:$(prefix==='setup'?'subjectSelect':'bankFilter').value||'all',topic:$(prefix==='setup'?'setupTopic':'bankTopic').value||'all'};
}
function filterKey(f){return [f.level,f.grade,f.subject,f.topic].join('\u001f')}
function topicsFor(level,grade,subject){
  const scope={level,grade,subject,topic:'all'};
  const local=getLocalQuestions().filter(q=>matches(q,scope)).map(q=>q.topic);
  const remote=(facetCache.get(`${level}|${grade}`)||[])
    .filter(q=>subject==='all'||canonicalSubject(q.subject)===canonicalSubject(subject)).map(q=>q.topic);
  return [...new Set([...local,...remote])].sort((a,b)=>a.localeCompare(b,'id'));
}
async function fetchFacets(prefix,level,grade,preferred={}){
  const seq=++facetSequence[prefix];
  if(!canManageBank()||grade==='all'||level==='all')return;
  const key=`${level}|${grade}`;
  try{
    if(!facetCache.has(key)){
      const result=await window.SLCloud.masterFacets(level,grade);
      if(!facetCache.has(key))facetCache.set(key,result);
    }
    if(seq!==facetSequence[prefix])return;
    const setup=prefix==='setup',levelEl=$(setup?'setupLevel':'bankLevel'),gradeEl=$(setup?'setupGrade':'bankGrade');
    if(levelEl.value!==level||gradeEl.value!==grade)return;
    const subjectEl=$(setup?'subjectSelect':'bankFilter'),topicEl=$(setup?'setupTopic':'bankTopic');
    const previousSubject=preferred.subject??subjectEl.value;
    options(subjectEl,[['all','Semua Mata Pelajaran'],...subjectOptions(level,grade).map(x=>[x,x])],previousSubject);
    const requestedTopic=preferred.topic??topicEl.value;
    options(topicEl,[['all','Semua Materi'],...topicsFor(level,grade,subjectEl.value).map(t=>[t,t])],requestedTopic);
    if(setup){selectedBank=currentFilter('setup');updatePoolInfo();}
    else{bankPage=1;renderBankList();}
  }catch(e){if(seq===facetSequence[prefix]){
    const msg='Daftar materi Cloud belum dapat dibaca: '+e.message;
    if(setupFailureVisible(prefix))showToast(msg);
  }}
}
function setupFailureVisible(prefix){return currentView===(prefix==='setup'?'setup':'questions')}
function cascadeFilters(prefix,changed='level',preferred=null){
  const setup=prefix==='setup';const levelEl=$(setup?'setupLevel':'bankLevel'),gradeEl=$(setup?'setupGrade':'bankGrade'),subjectEl=$(setup?'subjectSelect':'bankFilter'),topicEl=$(setup?'setupTopic':'bankTopic');
  const lev=levelEl.value;
  const gradeCurrent=preferred?.grade??(changed==='level'?'all':gradeEl.value);
  options(gradeEl,[['all','Semua Kelas'],...levelGrades(lev).map(g=>[String(g),`Kelas ${g}`])],gradeCurrent);
  const subjectCurrent=preferred?.subject??((changed==='level'||changed==='grade')?'all':subjectEl.value);
  options(subjectEl,[['all','Semua Mata Pelajaran'],...subjectOptions(lev,gradeEl.value).map(x=>[x,x])],subjectCurrent);
  const topicCurrent=preferred?.topic??(['level','grade','subject'].includes(changed)?'all':topicEl.value);
  options(topicEl,[['all','Semua Materi'],...topicsFor(lev,gradeEl.value,subjectEl.value).map(t=>[t,t])],topicCurrent);
  if(setup){selectedBank={...currentFilter('setup'),...(preferred?.topic&&!topicsFor(lev,gradeEl.value,subjectEl.value).includes(preferred.topic)?{topic:preferred.topic}:{})};updatePoolInfo()}
  else{if(changed!=='init')bankPage=1;renderBankList();}
  // Saat master Cloud besar, daftar materi berasal dari metadata database,
  // bukan dari seluruh pertanyaan di browser.
  fetchFacets(prefix,lev,gradeEl.value,preferred||{});
}
function bankDescription(f){return [f.level==='all'?'Semua Jenjang':f.level, f.grade==='all'?'Semua Kelas':`Kelas ${f.grade}`,f.subject==='all'?'Semua Mapel':f.subject,f.topic==='all'?'Semua Materi':f.topic].join(' • ')}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a}
function rng(){try{if(window.crypto&&crypto.getRandomValues){const v=new Uint32Array(1);crypto.getRandomValues(v);return 1+Math.floor((v[0]/4294967296)*6)}}catch{}return 1+Math.floor(Math.random()*6)}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function img(src,alt,cls){const i=document.createElement('img');i.src=src;i.alt=alt||'';if(cls)i.className=cls;return i}
function showView(name){
  if(name==='game'&&!state){showToast('Mulai permainan dengan memilih tim terlebih dahulu.');name='setup';}
  if(name==='scores'&&!state){showToast('Belum ada pertandingan.');name='setup';}
  if(name==='results'&&!state){name='menu'}
  // V1.5.8: route based on authenticated role, do not rely on a hidden menu.
  const auth=window.SLCloud;
  if(name==='cloud' && auth?.user && !auth.isRecoveryFlow?.() && !auth.authReturnError?.()) name=auth.role==='admin'?'admin':'teacher';
  if(name==='admin' && (!auth?.user || auth.role!=='admin')) name=auth?.user?'teacher':'cloud';
  if(name==='teacher' && (!auth?.user || auth.role==='admin')) name=auth?.role==='admin'&&auth?.user?'admin':'cloud';
  if(name==='monitor' && (!auth?.user || auth.role!=='admin')) name=auth?.user?'teacher':'cloud';
  if(name==='questions'||name==='help') previousView=currentView;
  currentView=name;
  document.body.classList.toggle('game-active',name==='game');
  $$('.view').forEach(n=>n.hidden=(n.id!=='view-'+name));
  if(name==='game') renderGame();
  if(name==='scores') renderScores();
  if(name==='results') renderResults();
  if(name==='questions') renderBank();
  if(name==='setup') renderSetup();
  if(name==='settings') renderSettings();
  if(name==='monitor'){monitorLoadSubjects();monitorRefresh();}
  if(['cloud','admin','teacher'].includes(name))renderCloudPanel();
  if(name==='cloud')showAuthForm(auth?.isRecoveryVerified?.() && auth?.user?'reset':authMode);
  window.scrollTo({top:0,behavior:'instant'});
}
function setupCount(n) {count=n;renderSetup();}
function renderSetup() {
  const wrap=$('teamCounts');wrap.replaceChildren();
  for(let n=2;n<=6;n++) {const b=el('button',`count-btn${n===count?' active':''}`,`${n} Tim`);b.type='button';b.addEventListener('click',()=>setupCount(n));wrap.append(b)}
  const oldValues=$$('#teamInputs input').map(i=>i.value);
  const ti=$('teamInputs');ti.replaceChildren();
  for(let i=0;i<count;i++) {
    const box=el('div','team-input');box.append(img(PATH('players',i),`Bidak ${COLORS[i]}`));
    const label=el('label',null,`Tim ${i+1} • ${COLORS[i]}`), inp=el('input');inp.type='text';inp.maxLength=32;inp.setAttribute('aria-label',`Nama tim ${i+1}`);inp.value=oldValues[i]||R.NAMES[i];label.append(inp);box.append(label);ti.append(box);
  }
  const saved={...selectedBank};
  $('setupLevel').value=saved.level;
  cascadeFilters('setup','init',saved);
}
function setSetupIssue(message=''){
  const notice=$('setupStartMessage');
  notice.hidden=!message;
  notice.textContent=message;
  $('useDemoBankBtn').hidden=!message;
}
async function updatePoolInfo(){
  const seq=++setupCountSeq;
  const f=currentFilter('setup');
  const local=getLocalQuestions().filter(q=>matches(q,f)).length;
  $('questionPoolInfo').textContent=canManageBank()?'⏳ Menghitung soal sesuai filter di Supabase…':`${local} soal Demo tersedia.`;
  setSetupIssue('');
  try{
    const remote=canManageBank()?await window.SLCloud.countMasterQuestions(f):0;
    if(seq!==setupCountSeq || currentFilter('setup').level!==f.level || filterKey(currentFilter('setup'))!==filterKey(f))return;
    const total=local+remote;
    $('questionPoolInfo').textContent=total
      ?`✅ ${total} soal tersedia (${local} lokal/Demo, ${remote} Master Premium). Paket Cloud diambil hanya saat Mulai Pertandingan (maks. 500 soal sampel per sesi). Jika habis sebelum FINISH, bank diulang otomatis.`
      :`⚠ Tidak ada soal untuk ${bankDescription(f)}. Pilih materi lain, sinkronkan Cloud, atau Gunakan Soal Demo.`;
    setSetupIssue(total?'':$('questionPoolInfo').textContent);
  }catch(e){if(seq!==setupCountSeq)return;
    $('questionPoolInfo').textContent=`⚠ Gagal memeriksa jumlah soal Cloud: ${e.message}. Soal lokal tersedia: ${local}.`;
    setSetupIssue(local?'':$('questionPoolInfo').textContent);
  }
}
function useDemoBank(){
  // Tampilkan koleksi demo SD yang selalu dibundel pada versi publik.
  selectedBank={level:'SD',grade:'all',subject:'all',topic:'all'};
  premiumQuestions=[];gameMasterFilterKey='';
  $('setupLevel').value='SD';
  cascadeFilters('setup','level');
  showToast('Bank Soal Demo dipilih. Silakan tekan Mulai Pertandingan.');
}
async function startGame(){
  if(setupLoadBusy)return;
  // Tombol ini memulai pertandingan BARU dari layar persiapan. Status feedback/quiz
  // pertandingan lama tidak boleh mengunci tombol setelah kembali ke menu.
  if(currentView!=='setup'){
    showToast('Buka menu Mulai Bermain untuk memulai pertandingan baru.');
    return;
  }
  setupLoadBusy=true;
  const btn=$('startGameBtn'),btnText=btn.textContent;
  btn.disabled=true;btn.textContent='⏳ Menyiapkan Bank Soal…';
  try{
    const names=$$('#teamInputs input').map((inp,i)=>inp.value.trim()||R.NAMES[i]);
    const filter=currentFilter('setup');
    // Data Premium hanya ada sementara untuk sesi permainan ini.
    premiumQuestions=[];gameMasterFilterKey='';
    if(canManageBank()){
      const found=await window.SLCloud.listMasterQuestions(filter,500);
      if(currentView!=='setup')return;
      premiumQuestions=found.map(q=>({...q,answer:q.answer,premium:true}));
      gameMasterFilterKey=filterKey(filter);
    }
    const pool=poolOf(filter);
    if(!pool.length){
      const message=`⚠ Pertandingan belum dimulai karena bank soal ${bankDescription(filter)} kosong. Pilih materi yang memiliki soal, sinkronkan Premium, atau klik Gunakan Soal Demo.`;
      setSetupIssue(message);
      showToast('Belum ada soal untuk pilihan ini. Klik Gunakan Soal Demo.');
      return;
    }
    const freshState=R.init(names);
    const freshRetry=RETRY.createSession(names.length,2);
    clearInterval(timerHandle);timerHandle=null;
    $('quizOverlay').hidden=true;
    $('diceRevealOverlay').hidden=true;
    state=freshState;retrySession=freshRetry;
    selectedBank=filter;subject=bankDescription(filter);
    phase='idle';lastRoll=1;quizNumber=0;deck=[];deckIndex=0;usedQuestionKeys.clear();
    activeQuestion=null;activeChoices=[];choiceSelected=-1;isRetryQuestion=false;
    $('diceImage').src=PATH('dice',0);$('diceNumber').textContent='?';
    $('gameStatus').textContent=`Giliran pertama: ${state.teams[0].name}. Lempar dadu, lihat hasilnya, lalu buka soal.`;
    setSetupIssue();
    showView('game');
    showToast(`Pertandingan ${names.length} tim dimulai. Selamat bermain!`);
  }catch(e){
    const message='Pertandingan belum dapat dimulai: '+(e?.message||'kesalahan tidak dikenal')+'. Pastikan semua file game sudah diekstrak dan coba lagi.';
    setSetupIssue(message);
    showToast(message);
    console.error('[SLKB] Gagal memulai pertandingan:',e);
  }finally{setupLoadBusy=false;btn.disabled=false;btn.textContent=btnText;}
}
function buildBoard(){const grid=$('boardGrid');grid.replaceChildren();for(let row=0;row<10;row++)for(let col=0;col<10;col++){
  const n=R.squareAt(row,col);const sq=el('div','board-tile');sq.dataset.square=n;const note=R.LADDERS[n]?`Tangga ke ${R.LADDERS[n]}`:R.SNAKES[n]?`Ular ke ${R.SNAKES[n]}`:'';
  if(note)sq.classList.add('tile-important');if(n===1)sq.classList.add('tile-start');if(n===100)sq.classList.add('tile-finish');sq.title=`Kotak ${n}${note?' • '+note:''}`;
  sq.append(el('span','tile-number',String(n)));grid.append(sq);
}}
function coord(n){const p=R.squareOf(n);return {x:(248+360*(p.col+.5))/4096*100,y:(248+360*(p.row+.5))/4096*100}}
function renderPieces(preview={}) {
  const layer=$('pawnLayer');layer.replaceChildren();const rack=$('startPieces');rack.replaceChildren();
  if(!state)return;
  for(let i=0;i<state.teams.length;i++){
    const t=state.teams[i],pos=Object.prototype.hasOwnProperty.call(preview,i)?preview[i]:t.position;
    if(pos===0){const im=img(PATH('players',i),`${t.name} di START`);im.title=t.name; rack.append(im);continue}
    const im=img(PATH('players',i),`${t.name} di kotak ${pos}`,'pawn'+(i===state.current?' current':''));
    const xy=coord(pos);im.style.left=xy.x+'%';im.style.top=xy.y+'%';im.title=`${t.name}: Kotak ${pos}`;im.style.zIndex=String(20+i);layer.append(im);
  }
}
function renderScoresRows(){const target=$('scoreboardRows');target.replaceChildren();if(!state)return;
  state.teams.forEach((t,i)=>{const row=el('div','score-row'+(i===state.current&&!state.finished?' now':''));row.append(img(PATH('players',i),t.name));const label=el('span',null,t.name);label.title=t.name;row.append(label,el('span','pos',String(t.position)),el('span','right',String(t.correct)));target.append(row)})
}
function renderGame(){
  if(!state)return;
  renderPieces();renderScoresRows();$('turnCounter').textContent=`Giliran ${state.turn+1}`;$('subjectBadge').textContent=subject;
  const t=state.teams[state.current];const box=$('activeTeam');box.replaceChildren(img(PATH('players',t.id),t.name),el('span',null,t.name));
  $('rollBtn').disabled=phase!=='idle'||state.finished;
  $('rollBtn').textContent=state.sixStreak?`🎲 Lempar Lagi • Bonus ${state.sixStreak}/2`:'🎲 Lempar Dadu';
  $('bonusBadge').hidden=!state.sixStreak;
  if(state.sixStreak)$('bonusBadge').textContent=`⭐ Angka 6 benar ${state.sixStreak}× • Kesempatan tambahan ${state.sixStreak}/2`;
  $('artToggleBtn').textContent=`🐍 Visual: ${settings.art?'ON':'OFF'}`;
  $('boardObjects').style.display=settings.art?'block':'none';
}
// Patch V1.5.10: satu antrean bersama untuk semua tim. Tidak ada soal berulang
// sebelum seluruh bank terpakai, termasuk saat siklus 20/50/100 berganti.
function resetDeck(){
  const unique=new Map();
  poolOf(selectedBank).forEach(q=>{const key=RETRY.questionKey(q);if(!unique.has(key))unique.set(key,q)});
  const available=[...unique.values()];
  if(!available.length){deck=[];deckIndex=0;return;}
  let remaining=available.filter(q=>!usedQuestionKeys.has(RETRY.questionKey(q)));
  if(!remaining.length){
    // Semua soal sudah terpakai; baru boleh mengawali putaran besar berikutnya.
    usedQuestionKeys.clear();
    remaining=available;
  }
  const reordered=settings.shuffle?shuffle(remaining):remaining;
  deck=settings.cycle>0?reordered.slice(0,settings.cycle):reordered;
  deckIndex=0;
}
function nextQuestion(){
  if(!deck.length||deckIndex>=deck.length)resetDeck();
  if(!deck.length)throw new Error('Tidak ada soal tersedia untuk dimainkan.');
  const question=deck[deckIndex++];
  usedQuestionKeys.add(RETRY.questionKey(question));
  isRetryQuestion=false;
  quizNumber++;
  return question;
}
function startRoll(){
  if(!state||phase!=='idle'||state.finished)return;
  phase='rolling';renderGame();window.SLAudio?.playEffect('dice');const final=rng();lastRoll=final;
  const frame=document.querySelector('.dice-frame');frame.classList.add('rolling');
  let ticks=0;const step=setInterval(()=>{ticks++;let k=rng();$('diceImage').src=PATH('dice',k-1);$('diceNumber').textContent=k;if(ticks>=14){clearInterval(step);frame.classList.remove('rolling');$('diceImage').src=PATH('dice',final-1);$('diceNumber').textContent=final;phase='reveal';showDiceReveal();}},90);
}
function showDiceReveal(){
  const t=state.teams[state.current];
  const third=lastRoll===6 && state.sixStreak===2;
  $('diceRevealTeam').textContent=`${t.name} • Kotak ${t.position} • ${state.sixStreak?`Bonus ${state.sixStreak}/2`:'Lemparan awal'}`;
  $('revealDiceImage').src=PATH('dice',lastRoll-1);
  $('revealDiceImage').alt=`Dadu angka ${lastRoll} pada sisi atas`;
  $('revealDiceNumber').textContent=String(lastRoll);
  $('revealDiceMessage').textContent=third
    ?'⚠ TIGA ANGKA 6 BERTURUT-TURUT! Lemparan ketiga hangus: tidak ada soal atau gerakan. Hasil dua lemparan 6 sebelumnya tetap berlaku.'
    :lastRoll===6
      ?'🎁 Angka 6! Jika benar, bidak bergerak 6 langkah, memantul mundur bila melewati 100, dan mendapat bonus dadu (maksimal dua bonus).'
      :'Hasil dadu sudah terlihat. Klik Lanjut ke Soal. Jika jawaban benar, bidak bergerak sesuai dadu dan memantul mundur bila melewati kotak 100.';
  $('diceRevealContinueBtn').textContent=third?'➡ Akhiri Giliran (6 Ketiga Hangus)':'📚 Lanjut ke Soal';
  $('diceRevealOverlay').hidden=false;
  $('gameStatus').textContent=third?`${t.name} mendapat angka 6 ketiga • lemparan hangus.`:`${t.name} mendapat angka ${lastRoll} • lanjutkan ke soal.`;
}
function proceedAfterDiceReveal(){
  if(phase!=='reveal'||!state)return;
  $('diceRevealOverlay').hidden=true;
  if(lastRoll===6 && state.sixStreak===2){
    const t=state.teams[state.current];
    const outcome=R.forfeitThirdSix(state);state=outcome.state;
    phase='idle';renderGame();
    $('gameStatus').textContent=`⚠ ${t.name}: angka 6 ketiga hangus. Posisi tetap; sekarang giliran ${state.teams[state.current].name}.`;
    showToast('Angka 6 ketiga hangus. Giliran berpindah.');
    return;
  }
  phase='quiz';showQuiz(nextQuestion());
}
function showQuiz(q){
  activeQuestion=q;choiceSelected=-1;isCorrect=false;
  const ind=state.current,t=state.teams[ind];
  $('quizTeam').textContent=`Giliran: ${t.name} • Kotak ${t.position}`;$('quizSubject').textContent=`${q.subject} • ${q.topic||'Materi'}`;
  $('quizDice').textContent=`🎲 Hasil dadu: ${lastRoll}`;$('quizSeq').textContent=isRetryQuestion?`🔁 Latihan Ulang • Soal ke-${quizNumber}`:`Soal ke-${quizNumber}`;$('quizText').textContent=q.question;
  const choices=q.choices.map((s,i)=>({label:s, correct:i===q.answer}));activeChoices=settings.shuffle?shuffle(choices):choices;
  const wrap=$('quizAnswers');wrap.replaceChildren();
  activeChoices.forEach((c,i)=>{const b=el('button','answer-btn');b.type='button';b.dataset.index=i;const letter=el('span','letter',String.fromCharCode(65+i));b.append(letter,el('span',null,c.label));b.addEventListener('click',()=>choose(i));wrap.append(b)});
  $('quizFeedback').hidden=true;$('quizSubmitBtn').hidden=false;$('quizSubmitBtn').disabled=true;$('quizContinueBtn').hidden=true;$('quizOverlay').hidden=false;
  if(settings.timer>0){timerLeft=settings.timer;$('quizTime').hidden=false;setTimerText();clearInterval(timerHandle);timerHandle=setInterval(()=>{timerLeft--;setTimerText();if(timerLeft<=0){clearInterval(timerHandle);timerHandle=null;evaluateAnswer(true)}},1000)} else $('quizTime').hidden=true;
}
function setTimerText(){$('quizTime').textContent=`⏱ ${Math.max(0,timerLeft)} detik`}
function choose(i){if(phase!=='quiz')return;choiceSelected=i;$$('.answer-btn').forEach((b,j)=>b.classList.toggle('selected',i===j));$('quizSubmitBtn').disabled=false}
function evaluateAnswer(timeout=false){
  if(phase!=='quiz')return;if(choiceSelected<0&&!timeout)return;
  clearInterval(timerHandle);timerHandle=null;phase='feedback';isCorrect= !timeout && activeChoices[choiceSelected].correct;
  // JANGAN tandai opsi benar atau ungkap kunci/pembahasan jika salah / timeout.
  $$('.answer-btn').forEach((b,i)=>{b.disabled=true;if(isCorrect&&i===choiceSelected)b.classList.add('correct');else if(!isCorrect&&!timeout&&i===choiceSelected)b.classList.add('incorrect')});
  const progress=retrySession.record(state.current,activeQuestion,isCorrect);
  const fb=$('quizFeedback');fb.hidden=false;fb.className='quiz-feedback '+(isCorrect?'good':'bad');
  if(isCorrect){
    fb.textContent=`✅ Tepat! ${isRetryQuestion?'Soal yang tadi belum dikuasai sekarang sudah berhasil dijawab. ':''}Bidak bergerak ${lastRoll} langkah; jika melewati kotak 100, ia memantul mundur.${activeQuestion.explanation?' '+activeQuestion.explanation:''}`;
  }else{
    fb.textContent=(timeout?'⏰ Waktu habis. ':'🌱 Belum tepat. ')+`Coba ingat kembali materi yang sudah dipelajari, ya! Bidak tetap di tempat. Pertanyaan berikutnya akan berbeda selama masih ada soal yang belum digunakan.`;
  }
  $('quizSubmitBtn').hidden=true;$('quizContinueBtn').hidden=false;
  $('quizContinueBtn').textContent=isCorrect&&lastRoll===6?'▶ Jalankan Bidak & Bonus Dadu':'▶ Lanjut Giliran';
  window.SLAudio?.playEffect(isCorrect ? 'correct' : 'wrong');
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function commitTurn(){
  if(phase!=='feedback')return;phase='animating';$('quizOverlay').hidden=true;
  const i=state.current, t=state.teams[i],from=t.position;
  const travel=isCorrect?R.movementPath(from,lastRoll):[];
  $('gameStatus').textContent=isCorrect?`${t.name}: jawaban benar. Bergerak ${lastRoll} langkah${from+lastRoll>100?' dan memantul di 100':''}…`:`${t.name}: tidak bergerak. Giliran beralih.`;
  if(travel.length){
    for(const position of travel){
      renderPieces({[i]:position});
      if(position===100 && from+lastRoll>100)$('gameStatus').textContent=`↩️ ${t.name} menyentuh kotak 100, lalu memantul mundur sampai langkah dadu habis.`;
      await sleep(190);
    }
    await sleep(260);
  }
  const {state:next,events}=R.applyTurn(state,{roll:lastRoll,correct:isCorrect});state=next;
  const jump=events.find(e=>e.type==='snake'||e.type==='ladder');if(jump){renderPieces();await sleep(500)}
  const messages=[];for(const e of events){if(e.type==='ladder')messages.push(`🪜 Naik tangga ${e.from} → ${e.to}`);if(e.type==='snake')messages.push(`🐍 Turun ular ${e.from} → ${e.to}`);if(e.type==='collision')messages.push(`💥 ${state.teams[e.bumped].name} tertabrak dan kembali ke START`);if(e.type==='bounce')messages.push(`↩️ Melewati 100, bidak memantul mundur ke kotak ${e.to}`);}
  $('gameStatus').textContent=messages.length?messages.join(' • '):isCorrect?`${t.name} maju ke kotak ${state.teams[i].position}.`:`${t.name} tetap di kotak ${from}.`;
  phase='idle';renderGame();
  if(state.sixStreak&&!state.finished){
    $('gameStatus').textContent=`🎁 ${t.name} menjawab benar saat dadu 6! ${messages.length?messages.join(' • ')+' • ':''}Lempar lagi (bonus ${state.sixStreak}/2).`;
    showToast(`${t.name} mendapat kesempatan lempar dadu lagi!`);
  } else if(!state.finished){
    const next=state.teams[state.current];
    $('gameStatus').textContent+=` • Giliran berikut: ${next.name}.`;
    if(messages.length)showToast(messages.join(' • '));
  }
  if(state.finished){if(state.winner!==null)window.SLAudio?.playEffect('victory');showView('results')}
}
function scoresTable(teams){const table=el('table','score-table');const h=el('thead');const tr=el('tr');['#','Tim','Posisi','Benar','Salah','Tertabrak','Progres'].forEach(t=>tr.append(el('th',null,t)));h.append(tr);table.append(h);
  const tbody=el('tbody');R.rankTeams(teams).forEach((t,i)=>{const row=el('tr');row.append(el('td',null,String(i+1)));const td=el('td');td.append(img(PATH('players',t.id),''),document.createTextNode(t.name));row.append(td);
    [t.position,t.correct,t.wrong,t.hits].forEach(n=>row.append(el('td',null,String(n))));const prog=el('td');const track=el('div','progress-track');const bar=el('div','progress-fill');bar.style.width=t.position+'%';track.append(bar);prog.append(track);row.append(prog);tbody.append(row)});table.append(tbody);return table;}
function renderScores(){if(!state)return;const box=$('fullScores');box.replaceChildren(scoresTable(state.teams));}
function renderResults(){if(!state)return;const ranking=R.rankTeams(state.teams);const winner=state.winner!=null?state.teams[state.winner]:null;
  $('winnerBanner').textContent=winner?`🎊 Selamat! ${winner.name} berhenti tepat di kotak 100!`:'⏹ Pertandingan diakhiri sebelum ada tim mencapai 100.';
  $('replayVictoryBtn').hidden=!winner;
  const pod=$('podium');pod.replaceChildren();const ranks=[ranking[1],ranking[0],ranking[2]];
  ranks.forEach((t,i)=>{if(!t)return;const box=el('div','podium-item '+(i===1?'first':i===0?'second':'third'));box.append(el('div','podium-rank',i===1?'🥇':i===0?'🥈':'🥉'),img(PATH('players',t.id),t.name),el('b',null,t.name),el('span',null,`Kotak ${t.position}`));pod.append(box)});
  $('finalScores').replaceChildren(scoresTable(state.teams));
  const review=$('retrySummary');review.replaceChildren();
  const heading=el('h3',null,'📚 Evaluasi Soal');review.append(heading);
  state.teams.forEach((t,i)=>{const st=retrySession?.stats(i);review.append(el('p',null,`${t.name}: ${st?.wrongAttempts||0} jawaban salah/perlu dipelajari kembali.`))});
  review.append(el('p','hint','Soal salah tidak menampilkan kunci jawaban. Selama bank masih memiliki soal baru, pertanyaan tidak diulang dalam pertandingan ini.'));
}
function endGame(){if(!state)return;if(['rolling','reveal','quiz','feedback','animating'].includes(phase)){showToast('Selesaikan soal dan giliran yang berlangsung dahulu.');return;}if(!confirm('Akhiri permainan dan lihat hasil sementara?'))return;state.finished=true;state.winner=null;showView('results')}
function normalQuestion(raw,id){
  const level=CAT.LEVELS.includes(raw.level)?raw.level:'Umum';
  const rawGrade=Number(raw.grade), grade=level==='Umum'?null:(levelGrades(level).includes(rawGrade)?rawGrade:null);
  const q={id:String(id||raw.id||'custom-'+Date.now()),level,grade,subject:canonicalSubject(raw.subject||'Soal Buatan Guru').slice(0,60),topic:String(raw.topic||'Umum').trim().slice(0,60),question:String(raw.question||'').trim().slice(0,600),choices:raw.choices,answer:typeof raw.answer==='string'&& /^[A-Da-d]$/.test(raw.answer)?raw.answer.toUpperCase().charCodeAt(0)-65:Number(raw.answer),explanation:String(raw.explanation||'').trim().slice(0,400)};
  if(level!=='Umum'&&!grade)throw new Error('Pilih kelas sesuai jenjang.');
  if([q.topic,q.question,...(Array.isArray(q.choices)?q.choices:[])].some(x=>typeof x==='string'&&x.includes('GANTI_')))throw new Error('Ganti seluruh teks GANTI_* pada template sebelum mengimpor soal.');
  const reqCount=level==='SD'&&grade>=1&&grade<=3?3:4;
  if(!q.question||q.question.length<5||!Array.isArray(q.choices)||q.choices.length!==reqCount||q.choices.some(x=>typeof x!=='string'||!x.trim()||x.length>200)||!Number.isInteger(q.answer)||q.answer<0||q.answer>=reqCount)throw new Error(`Kelas ini memerlukan ${reqCount} pilihan ${reqCount===3?'A–C':'A–D'} beserta kuncinya.`);
  if(new Set(q.choices.map(x=>x.trim().toLowerCase())).size!==reqCount)throw new Error('Pilihan jawaban tidak boleh sama.');
  q.choices=q.choices.map(s=>s.trim());return q;
}
function renderBank(){syncBankAccess();cascadeFilters('bank','init')}
function renderBankEntries(filtered,startIndex=0){
  const list=$('bankList');list.replaceChildren();
  filtered.forEach((q,idx)=>{const item=el('div','bank-item');const txt=el('div');txt.append(el('h4',null,`${startIndex+idx+1}. ${q.question}`),el('small',null,`${q.level||'Umum'}${q.grade?' • Kelas '+q.grade:''} • ${q.subject} • ${q.topic}${canManageBank()?' • Kunci: '+ 'ABCD'[q.answer]:''}${q.cloudId?' • ☁ '+labelStatus(q.status):''}`));item.append(txt);
    if(q.premium){item.append(el('small',null,'👑 Master Premium • dibaca melalui Supabase; tidak bisa diedit dari akun guru.'));}
    else if(q.cloudId){
      const acts=el('div','bank-actions');
      if(q.ownerId===window.SLCloud?.user?.id && ['private','rejected'].includes(q.status)){
        const edit=el('button','edit-btn','Edit');edit.onclick=()=>beginEdit(q);acts.append(edit);
        const share=el('button','edit-btn','Ajukan ke Admin');share.onclick=()=>cloudAction(async()=>{await window.SLCloud.submit(q.cloudId)},'Soal diajukan untuk persetujuan admin.');acts.append(share);
        const del=el('button','remove-btn','Hapus');del.onclick=()=>{if(confirm('Hapus soal pribadi dari cloud?'))cloudAction(async()=>window.SLCloud.removeQuestion(q.cloudId),'Soal cloud dihapus.')};acts.append(del);
      } else acts.append(el('small',null,q.ownerId===window.SLCloud?.user?.id?'Menunggu / telah ditinjau':'Bersama • disetujui admin'));
      item.append(acts);
    }else if(!q.id.startsWith('demo-')){
      const actions=el('div','bank-actions');const edit=el('button','edit-btn','Edit');edit.onclick=()=>beginEdit(q);const b=el('button','remove-btn','Hapus');b.title='Hapus soal lokal';b.onclick=()=>{if(!confirm('Hapus soal lokal ini?'))return;customQuestions=customQuestions.filter(x=>x.id!==q.id);storage.set('slkb.custom.v1',customQuestions);if(editingQuestionId===q.id)cancelEdit();renderBank();showToast('Soal lokal dihapus')};actions.append(edit,b);item.append(actions)
    }else item.append(el('small',null,'Demo'));
    list.append(item)});
  if(!filtered.length)list.append(el('div','notice',canManageBank()?'Belum ada soal pada pilihan ini. Gunakan formulir untuk menambahkan soal pertama.':'Belum ada soal demo pada pilihan ini. Akun Premium dapat menggunakan Bank Soal lengkap.'));
}
async function renderBankList(){
  const seq=++bankRequestSeq;
  const f=currentFilter('bank'),local=getLocalQuestions().filter(q=>matches(q,f));
  const pager=$('bankPagination');
  pager.hidden=true;
  $('bankCount').textContent='⏳ Memuat...';
  $('bankList').replaceChildren(el('div','notice','Memuat halaman soal yang dipilih…'));
  try{
    let masterCount=0;
    if(canManageBank())masterCount=await window.SLCloud.countMasterQuestions(f);
    if(seq!==bankRequestSeq || currentView!=='questions')return;
    const total=local.length+masterCount;
    const pages=Math.max(1,Math.ceil(total/bankPageSize));
    bankPage=Math.max(1,Math.min(pages,bankPage));
    const offset=(bankPage-1)*bankPageSize;
    const own=local.slice(offset,offset+bankPageSize);
    const needed=bankPageSize-own.length;
    let remote=[];
    if(needed>0 && canManageBank() && offset+own.length>=local.length){
      const cloudOffset=Math.max(0,offset-local.length);
      const result=await window.SLCloud.masterPage(f,cloudOffset,needed);
      remote=result.rows.map(q=>({...q,premium:true}));
    }
    if(seq!==bankRequestSeq || currentView!=='questions')return;
    renderBankEntries([...own,...remote],offset);
    $('bankCount').textContent=`${total} soal`;
    $('bankPageInfo').textContent=`Halaman ${bankPage} dari ${pages} • ${total} soal`;
    $('bankPrevBtn').disabled=bankPage<=1;
    $('bankNextBtn').disabled=bankPage>=pages;
    pager.hidden=total<=bankPageSize;
  }catch(e){if(seq!==bankRequestSeq)return;
    $('bankCount').textContent='Gagal memuat';
    $('bankList').replaceChildren(el('div','notice',`Gagal mengambil Bank Master dari Cloud: ${e.message}. Silakan Refresh Cloud.`));
    pager.hidden=true;
  }
}
function syncAddSubjects(){const level=$('newLevel').value;options($('newGrade'),levelGrades(level).map(g=>[String(g),`Kelas ${g}`]),$('newGrade').value, String(levelGrades(level)[0]||''));const subs=subjectOptions(level);options($('newSubject'),[...subs.map(t=>[t,t]),['__other__','Lainnya (tulis sendiri)']],$('newSubject').value,subs[0]||'__other__');syncOtherSubject();syncChoiceCount()}
function syncChoiceCount(){
  const lower=$('newLevel').value==='SD' && Number($('newGrade').value)<=3;
  const d=$('newD');d.closest('label').hidden=lower;d.required=!lower;if(lower)d.value='';
  const key=$('newAnswer');for(const option of key.options){if(option.value==='3')option.hidden=lower;}
  if(lower&&key.value==='3')key.value='0';
  $('choiceCountHint').textContent=lower?'Kelas 1–3: 3 pilihan A–C.':'Kelas 4–12: 4 pilihan A–D.';
}
function syncOtherSubject(){const other=$('newSubject').value==='__other__';$('newSubjectOther').hidden=!other;$('newSubjectOther').required=other;}
function beginEdit(q){
 if(!requireBankPremium())return;
 editingQuestionId=q.id;
 $('saveTarget').value=q.cloudId?'cloud':'local';$('saveTarget').disabled=true;
 $('newLevel').value=CAT.GRADES[q.level]?q.level:'SMA';syncAddSubjects();
 $('newGrade').value=String(q.grade||10);syncChoiceCount();
 const known=[...$('newSubject').options].some(o=>o.value===q.subject);
 $('newSubject').value=known?q.subject:'__other__';syncOtherSubject();
 $('newSubjectOther').value=known?'':q.subject;
 $('newTopic').value=q.topic;$('newQuestion').value=q.question;
 ['newA','newB','newC','newD'].forEach((id,i)=>$(id).value=q.choices[i]||'');
 $('newAnswer').value=String(q.answer);$('newExplanation').value=q.explanation||'';
 $('saveQuestionBtn').textContent='✓ Simpan Perubahan';$('cancelEditBtn').hidden=false;
 $('addQuestionForm').scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelEdit(){editingQuestionId=null;$('saveTarget').disabled=false;$('addQuestionForm').reset();$('newLevel').value='SD';syncAddSubjects();$('saveQuestionBtn').textContent='+ Simpan Soal';$('cancelEditBtn').hidden=true;}
async function addQuestion(evt){evt.preventDefault();
  if(!requireBankPremium())return;
  if(cloudBusy)return;
  try{
    const r={level:$('newLevel').value,grade:Number($('newGrade').value),subject:$('newSubject').value==='__other__'?$('newSubjectOther').value:$('newSubject').value,topic:$('newTopic').value,question:$('newQuestion').value,choices:[$('newA').value,$('newB').value,$('newC').value,...(($('newLevel').value==='SD'&&Number($('newGrade').value)<=3)?[]:[$('newD').value])],answer:Number($('newAnswer').value),explanation:$('newExplanation').value};
    if(!r.subject.trim())throw new Error('Masukkan nama mata pelajaran.');
    const record=normalQuestion(r,editingQuestionId||'user-'+Date.now()+'-'+Math.random().toString(36).slice(2,7));
    const editingCloud=cloudQuestions.find(q=>q.id===editingQuestionId);
    if($('saveTarget').value==='cloud'){
      if(!window.SLCloud?.user)throw new Error('Masuk dengan akun guru dahulu untuk menyimpan di Cloud.');
      cloudBusy=true;$('saveQuestionBtn').disabled=true;
      try{await window.SLCloud.saveQuestion(record,editingCloud?.cloudId||null);await loadCloudQuestions();cancelEdit();renderBank();showToast('☁ Soal tersimpan otomatis di Bank Pribadi Cloud.');}
      finally{cloudBusy=false;$('saveQuestionBtn').disabled=false;}
    }else{
      if(editingCloud)throw new Error('Soal Cloud hanya dapat diedit ke Cloud.');
      if(editingQuestionId)customQuestions=customQuestions.map(q=>q.id===editingQuestionId?record:q);else customQuestions.push(record);
      storage.set('slkb.custom.v1',customQuestions);cancelEdit();renderBank();showToast('Soal tersimpan di browser ini.');
    }
  }catch(e){showToast('Gagal menyimpan soal: '+e.message)}
}
// GID v1.5.13: Template spreadsheet yang aman dan dapat dibaca tanpa dependensi online.
const QUESTION_COLUMNS=['id','level','grade','subject','topic','question','option_a','option_b','option_c','option_d','answer','explanation'];
function csvEscapeValue(value){
  const str=String(value??'');
  return /[",\r\n;]/.test(str)?'"'+str.replace(/"/g,'""')+'"':str;
}
function downloadTextFile(name,content,mime){
  const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);
  const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function downloadCSVTemplate(){
  const f=currentFilter('bank');
  if(!['SD','SMP','SMA'].includes(f.level)||f.grade==='all'||f.subject==='all'){
    showToast('Pilih jenjang, kelas, dan mata pelajaran sebelum mengunduh template CSV.');return;
  }
  const lower=f.level==='SD'&&Number(f.grade)<=3;
  const example=['',f.level,f.grade,f.subject,f.topic==='all'?'GANTI_NAMA_MATERI':f.topic,
    'GANTI_PERTANYAAN','GANTI_OPSI_A','GANTI_OPSI_B','GANTI_OPSI_C',lower?'':'GANTI_OPSI_D','A','GANTI_PEMBAHASAN'];
  const csv='\ufeff'+[QUESTION_COLUMNS,example].map(r=>r.map(csvEscapeValue).join(',')).join('\r\n');
  downloadTextFile(`template-soal-${f.level}-kelas-${f.grade}.csv`,csv,'text/csv;charset=utf-8');
  showToast('Template CSV diunduh. Isi satu baris untuk satu soal, lalu impor dari Bank Soal.');
}
function parseDelimitedText(text){
  const input=String(text||'').replace(/^\ufeff/,'');
  const firstLine=input.split(/\r?\n/,1)[0]||'';
  const delimiter=firstLine.split(';').length>firstLine.split(',').length?';':',';
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(quoted){if(c==='"'&&input[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;}else{field+=c;}}
    else if(c==='"'){if(field.trim())throw new Error('Format CSV tidak valid: tanda kutip tidak pada awal kolom.');quoted=true;}
    else if(c===delimiter){row.push(field);field='';}
    else if(c==='\n'||c==='\r'){
      if(c==='\r'&&input[i+1]==='\n')i++;
      row.push(field);if(row.some(v=>String(v).trim()))rows.push(row);
      row=[];field='';
    }else{field+=c;}
  }
  if(quoted)throw new Error('CSV memiliki tanda kutip yang belum ditutup.');
  row.push(field);if(row.some(v=>String(v).trim()))rows.push(row);
  if(rows.length<2)throw new Error('CSV harus memuat judul kolom dan setidaknya 1 soal.');
  const aliases={jenjang:'level',kelas:'grade',mata_pelajaran:'subject',mapel:'subject',materi:'topic',bab:'topic',pertanyaan:'question',soal:'question',pilihan_a:'option_a',pilihan_b:'option_b',pilihan_c:'option_c',pilihan_d:'option_d',opsi_a:'option_a',opsi_b:'option_b',opsi_c:'option_c',opsi_d:'option_d',kunci:'answer',kunci_jawaban:'answer',pembahasan:'explanation'};
  const heads=rows.shift().map(v=>{const k=String(v).toLowerCase().trim().replace(/\s+/g,'_');return aliases[k]||k;});
  const required=['level','grade','subject','topic','question','option_a','option_b','option_c','answer'];
  const missing=required.filter(k=>!heads.includes(k));
  if(missing.length)throw new Error('Kolom CSV wajib belum ada: '+missing.join(', '));
  if(new Set(heads).size!==heads.length)throw new Error('Ada judul kolom CSV yang duplikat.');
  return rows.map((cells,i)=>{
    if(cells.length>heads.length)throw new Error(`Baris ${i+2}: jumlah kolom melebihi header. Periksa koma atau titik koma dalam teks.`);
    const fields={};heads.forEach((h,j)=>fields[h]=String(cells[j]??'').trim());
    const grade=Number(fields.grade);
    const low=fields.level.toUpperCase()==='SD'&&grade>=1&&grade<=3;
    return {id:fields.id||'',level:fields.level.toUpperCase(),grade,subject:fields.subject,topic:fields.topic,
      question:fields.question,choices:[fields.option_a,fields.option_b,fields.option_c,...(low?[]:[fields.option_d||''])],
      answer:fields.answer,explanation:fields.explanation||''};
  });
}
async function readQuestionFile(file){
  const name=String(file.name||'').toLowerCase();
  if(name.endsWith('.csv'))return parseDelimitedText(await file.text());
  if(name.endsWith('.json')){const data=JSON.parse(await file.text());return Array.isArray(data)?data:data.questions;}
  throw new Error('Gunakan .csv atau .json. File Excel .xlsx: pilih Simpan Sebagai → CSV UTF-8 terlebih dahulu.');
}
function downloadTopicTemplate(){
  const f=currentFilter('bank');
  if(!['SD','SMP','SMA'].includes(f.level)||f.grade==='all'||f.subject==='all'){
    showToast('Pilih jenjang, kelas, dan mata pelajaran dahulu untuk mengunduh template materi.');return;
  }
  const lower=f.level==='SD'&&Number(f.grade)<=3;
  const targetCount=f.level==='SD'?50:f.level==='SMP'?75:100;
  const template={version:3,
    petunjuk:`Template mengikuti filter game. Ganti semua teks GANTI_*, isi materi, dan tambah hingga ${targetCount} soal. Kunci ${lower?'A-C':'A-D'}. Kolom id boleh dikosongkan; saat impor MASTER Admin, aplikasi membuat ID stabil berdasarkan metadata dan nomor urut.`,
    questions:[{
    level:f.level,grade:Number(f.grade),subject:f.subject,topic:f.topic==='all'?'GANTI_NAMA_MATERI':f.topic,
    question:'GANTI_DENGAN_PERTANYAAN_LENGKAP',choices:['GANTI_PILIHAN_A','GANTI_PILIHAN_B','GANTI_PILIHAN_C',...(lower?[]:['GANTI_PILIHAN_D'])],answer:'A',explanation:'GANTI_DENGAN_PEMBAHASAN'
  }]};
  const blob=new Blob([JSON.stringify(template,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=el('a');a.href=url;
  a.download=`template-${f.level}-kelas-${f.grade}-${f.subject.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportLocalBank(){if(!requireBankPremium())return;const data=customQuestions;const blob=new Blob([JSON.stringify({version:2,questions:data},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='backup-soal-lokal-guruupgradeid.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);showToast(`${data.length} soal lokal dicadangkan ke JSON.`)}
function exportBank(){if(!requireBankPremium())return;const data=[...window.SLDemoQuestions,...(window.SLExpansionQuestions||[]),...customQuestions].map(fitLowGradeOptions); /* Premium dan Bank Bersama tidak boleh diekspor massal. */const blob=new Blob([JSON.stringify({version:2,questions:data},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='bank-soal-per-jenjang-snake-ladder.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function importBank(evt){const f=evt.target.files?.[0];if(!f)return;try{
 if(!requireBankPremium())return;const arr=await readQuestionFile(f);if(!Array.isArray(arr)||arr.length<1||arr.length>1000)throw new Error('File harus berisi 1–1000 soal.');
  const unknown=arr.filter(q=>CAT.SUBJECTS[q.level] && !(CAT.SUBJECTS[q.level]||[]).some(s=>canonicalSubject(s)===canonicalSubject(q.subject)));
  if(unknown.length){
    const samples=[...new Set(unknown.map(q=>`${q.level}: ${q.subject}`))].slice(0,5).join('\n');
    if(!confirm(`${unknown.length} soal memiliki nama mapel di luar katalog bawaan game:\n${samples}\n\nMapel baru akan tetap diimpor sebagai kategori tersendiri. Jika sebenarnya mapel yang sama, pilih Batal lalu sesuaikan kolom subject dengan dropdown template Excel. Lanjutkan?`))return;
  }
  const imported=arr.filter(q=>!String(q.id||'').startsWith('demo-')).map((q,i)=>normalQuestion(fitLowGradeOptions(q),'import-'+Date.now()+'-'+i));
  // Cegah duplikasi DEMO dari hasil ekspor. Soal impor lama tanpa jenjang masuk kategori Umum.
  customQuestions.push(...imported);storage.set('slkb.custom.v1',customQuestions);renderBank();showToast(`${imported.length} soal buatan berhasil diimpor.`)
 }catch(err){showToast('Gagal impor: '+err.message)}finally{evt.target.value=''}}
function renderSettings(){ $('musicToggle').checked=!!settings.music;$('bgmVolume').value=String(Math.max(0,Math.min(100,Number(settings.musicVolume) || 0)));$('bgmVolumeValue').textContent=$('bgmVolume').value+'%';$('sfxToggle').checked=!!settings.sfx;$('artToggle').checked=!!settings.art;$('shuffleToggle').checked=!!settings.shuffle;$('timerSelect').value=String(settings.timer);$('cycleSizeSelect').value=String([5,10,15,20,50,100,0].includes(settings.cycle)?settings.cycle:0);  }
function saveSettings(){settings={music:$('musicToggle').checked,musicVolume:Number($('bgmVolume').value),sfx:$('sfxToggle').checked,art:$('artToggle').checked,shuffle:$('shuffleToggle').checked,timer:Number($('timerSelect').value),cycle:Number($('cycleSizeSelect').value)};storage.set('slkb.settings.v1',settings);$('muteBtn').textContent=settings.sfx?'🔊':'🔇';updateMusic();showToast('Pengaturan disimpan.');showView(state?'game':'menu')}
function resetSettings(){settings={...DEFAULT_SETTINGS};renderSettings();window.SLAudio?.setMusicVolume(settings.musicVolume);showToast('Pengaturan direset. Tekan Simpan untuk menerapkan.')}
// CLOUD BANK V1.4 ---------------------------------------------------------
function labelStatus(status){return ({private:'Pribadi',pending:'Menunggu Persetujuan',approved:'Bersama',rejected:'Ditolak'})[status]||status}
function mapCloudQuestion(r){return {id:'cloud-'+r.id,cloudId:r.id,ownerId:r.owner_id,status:r.status,
  level:r.level,grade:r.grade,subject:r.subject,topic:r.topic,question:r.question,choices:r.choices,answer:r.answer,explanation:r.explanation||''};}
// Tampilan lisensi dihitung dari data Cloud, bukan ditebak dari status login.
function teacherLicenseState(userId, isPremium, requests){
  if(isPremium)return {key:'active',label:'👑 PREMIUM AKTIF',description:'Pembelian telah disetujui Admin. Bank Soal Master Premium dapat digunakan.'};
  const mine=(requests||[]).filter(r=>r.user_id===userId);
  const pending=mine.find(r=>r.status==='pending');
  if(pending)return {key:'pending',label:'⏳ MENUNGGU VERIFIKASI PEMBAYARAN',description:'Nomor pesanan '+pending.order_reference+' sudah diajukan. Admin akan mencocokkannya dengan transaksi Lynk.id. Premium belum aktif.'};
  const rejected=mine.find(r=>r.status==='rejected');
  return {key:'demo',label:'🔒 DEMO GRATIS',description:rejected?'Pengajuan terakhir ditolak. Periksa nomor pesanan dan ajukan kembali setelah pembayaran valid.':'Anda dapat mencoba game gratis. Belum ada pengajuan aktivasi Premium.'};
}
async function initCloud(){
  const box=$('cloudConnectionStatus');
  try{
    const ok=await window.SLCloud.init();
    if(!ok){box.textContent='☁ Cloud belum dikonfigurasi. Mode Demo tetap dapat dimainkan secara offline. Isi config/cloud-config.js.';renderCloudPanel();return;}
    await loadCloudQuestions();
    if(window.SLCloud.authReturnError?.()){
      showAuthForm('forgot');showView('cloud');showAuthMessage(window.SLCloud.authReturnError(),'error');
    }else if(window.SLCloud.isRecoveryVerified?.() && window.SLCloud.user){showAuthForm('reset');showView('cloud');}
    else if(window.SLCloud.isRecoveryFlow() && !window.SLCloud.user){showAuthForm('forgot');showView('cloud');showAuthMessage('Tautan pemulihan tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.','error');}
  }catch(e){
    cloudSyncWarnings=['Koneksi atau pemeriksaan peran gagal: '+(e?.message||String(e))];
    console.warn('[SLKB Cloud] Inisialisasi:',e);
  }
  renderCloudPanel();
  // Bila sesi sudah aktif sejak awal, layar login tidak boleh dibiarkan kosong.
  if(currentView==='cloud' && window.SLCloud?.user && !window.SLCloud?.isRecoveryFlow?.() && !window.SLCloud?.authReturnError?.()){
    showView('cloud'); // showView akan memilih Dashboard Admin/Ruang Guru berdasarkan role asli.
  }
}
async function loadCloudQuestions(){
  // Kegagalan modul pendukung tidak boleh menghilangkan data Master atau menyembunyikan Admin.
  premiumQuestions=[];gameMasterFilterKey='';facetCache.clear();
  facetSequence.setup++;facetSequence.bank++;
  const warnings=[];
  const C=window.SLCloud;
  if(C?.user){
    // Hitung Master lebih dulu: permintaan terpisah dan TANPA mengunduh isi soal.
    try{
      if(C.role==='admin' && !C.premium)throw new Error('Hak Admin belum dapat diverifikasi untuk akses Master.');
      masterTotalCount=await C.countMasterQuestions();
    }catch(e){masterTotalCount=null;warnings.push('Hitung Master: '+(e?.message||String(e)));}
    try{cloudQuestions=(await C.listQuestions()).map(mapCloudQuestion);}
    catch(e){cloudQuestions=[];warnings.push('Bank Pribadi/Bersama: '+(e?.message||String(e)));}
    try{activationRequests=await C.listActivationRequests();}
    catch(e){activationRequests=[];warnings.push('Antrean aktivasi: '+(e?.message||String(e)));}
  }else{cloudQuestions=[];premiumQuestions=[];masterTotalCount=0;activationRequests=[];}
  cloudSyncWarnings=warnings;
  if(currentView==='questions')renderBank();
  if(currentView==='setup')renderSetup();
  renderCloudPanel();
  return warnings;
}
function renderCloudPanel(){
  const C=window.SLCloud;
  const ready=!!C?.available, signed=!!C?.user, isAdmin=signed && C.role==='admin';
  const canUse=!!(signed && C.premium);
  // BUGFIX V1.5.11c: sesi Admin/Guru aktif tidak boleh terjebak pada halaman login kosong.
  if(signed && currentView==='cloud' && !C?.isRecoveryFlow?.() && !C?.authReturnError?.()){
    showView(isAdmin?'admin':'teacher');
    return;
  }
  const warningText=cloudSyncWarnings.length?'⚠ Sinkronisasi belum lengkap: '+cloudSyncWarnings.join(' | '):'';
  const adminWarn=$('adminCloudSyncWarning'),teacherWarn=$('teacherCloudSyncWarning');
  if(adminWarn){adminWarn.textContent=warningText;adminWarn.hidden=!warningText;}
  if(teacherWarn){teacherWarn.textContent=warningText;teacherWarn.hidden=!warningText;}
  $('cloudAuthPanel').hidden=signed && !((C?.isRecoveryVerified?.() || C?.authReturnError?.()) && currentView==='cloud');
  $('cloudLoggedIn').hidden=!signed||isAdmin;
  $('cloudLoginBtn').disabled=!ready;$('cloudRegisterBtn').disabled=!ready;
  $('cloudForgotBtn').disabled=!ready;$('cloudResetBtn').disabled=!ready;$('authResendBtn').disabled=!ready;
  $('cloudConnectionStatus').textContent=!C?.configured()?'⚠ Cloud belum dikonfigurasi. Mode Demo masih aktif.':!ready?'⚠ Supabase tidak terhubung; periksa koneksi dan konfigurasi.':!C.schemaReady?'⚠ Migrasi lisensi V1.5 belum siap. Jangan publikasikan game.':signed?'✅ Cloud aktif • '+(isAdmin?'Admin':'Guru')+' • '+C.user.email:'☁ Cloud aktif. Silakan login atau daftar.';
  syncBankAccess();
  $('importCloudLabel').hidden=!canUse;
  if(!canUse && $('saveTarget').value==='cloud')$('saveTarget').value='local';
  if(canUse && !$('saveTarget').disabled)$('saveTarget').value='cloud';
  $('saveTarget').querySelector('option[value="cloud"]').disabled=!canUse;
  $('cloudBankInfo').textContent=signed?(canUse?'👑 Premium aktif • kelola soal dan Bank Master tersedia.':'🔒 Demo • tambah soal manual, impor, dan Bank Premium terkunci hingga aktivasi disetujui admin.'):'🔒 Demo Gratis • bank soal contoh tersedia, fitur kelola soal khusus Premium.';
  const license=signed ? teacherLicenseState(C.user.id,canUse,activationRequests) : null;
  const hasPending=license?.key==='pending';
  $('activationForm').hidden=!signed||isAdmin||canUse||hasPending;
  $('cloudAdminPanel').hidden=!isAdmin;
  $('cloudAdminImportBlock').hidden=!isAdmin;
  $('accountMenuBtn').textContent=isAdmin?'🛡 Dashboard Admin':signed?'🎓 Ruang Guru':'☁ Akun Guru & Cloud';
  $('menuBuyPremiumBtn').hidden=canUse;
  if(!signed){
    $('teacherLicenseBadge').textContent='🔒 DEMO GRATIS';
    $('teacherLicenseBadge').classList.remove('is-active','is-pending');
    $('teacherLicenseDescription').textContent='Daftar akun atau masuk untuk mengajukan akses Premium.';
    return;
  }
  const own=cloudQuestions.filter(q=>q.ownerId===C.user.id);
  const privateCount=own.filter(q=>q.status==='private').length;
  const submittedCount=own.filter(q=>q.status==='pending').length;
  const sharedCount=cloudQuestions.filter(q=>q.status==='approved').length;
  $('cloudAccountName').textContent=C.user.user_metadata?.display_name || C.user.email;
  $('cloudStats').textContent=`${C.user.email} • Soal pribadi: ${privateCount} • Diajukan: ${submittedCount} • Bersama: ${sharedCount} • Master: ${masterTotalCount==null?'gagal dimuat':masterTotalCount}`;
  $('teacherPrivateCount').textContent=String(privateCount);
  $('teacherSubmittedCount').textContent=String(submittedCount);
  $('teacherSharedCount').textContent=String(sharedCount);
  $('teacherMasterCount').textContent=masterTotalCount==null?'—':String(masterTotalCount);
  $('teacherLicenseBadge').textContent=license.label;
  $('teacherLicenseBadge').classList.toggle('is-active',license.key==='active');
  $('teacherLicenseBadge').classList.toggle('is-pending',license.key==='pending');
  $('teacherLicenseDescription').textContent=license.description;
  $('cloudActivationPendingCount').textContent=license.key==='pending'?'⏳ Pengajuan Anda sedang diperiksa. Formulir pengajuan baru tersedia kembali jika pengajuan ini ditolak.':license.key==='active'?'✅ Lisensi Premium aktif.':'Belum ada pembayaran yang sedang menunggu pemeriksaan.';
  if(isAdmin){
    $('adminAccountName').textContent=C.user.user_metadata?.display_name || C.user.email;
    $('adminPendingActivationCount').textContent=String(activationRequests.filter(r=>r.status==='pending').length);
    $('adminPendingQuestionCount').textContent=String(cloudQuestions.filter(q=>q.status==='pending').length);
    $('adminMasterQuestionCount').textContent=masterTotalCount==null?'—':String(masterTotalCount);
    $('adminApprovedQuestionCount').textContent=String(sharedCount);
    renderModeration();renderActivationQueue();
  }
}
function renderModeration(){
  const pane=$('cloudPendingList');pane.replaceChildren();
  const pending=cloudQuestions.filter(q=>q.status==='pending');
  if(!pending.length){pane.append(el('p','hint','Belum ada pengajuan menunggu persetujuan.'));return;}
  for(const q of pending){const row=el('div','cloud-review-item');
    const meta=el('small',null,`${q.level} • Kelas ${q.grade} • ${q.subject} • ${q.topic}`);
    const question=el('strong',null,q.question);
    const opts=el('p','hint',q.choices.map((v,i)=>'ABCD'[i]+'. '+v).join(' | ')+' • Kunci: '+'ABCD'[q.answer]);
    const actions=el('div','bank-actions');
    for(const [label,d] of [['✓ Setujui','approved'],['✗ Tolak','rejected']]){
      const b=el('button',d==='approved'?'edit-btn':'remove-btn',label);
      b.onclick=()=>cloudAction(async()=>{await window.SLCloud.review(q.cloudId,d)},d==='approved'?'Soal diterbitkan di Bank Bersama.':'Soal dikembalikan kepada pemilik.');actions.append(b);
    }row.append(meta,question,opts,actions);pane.append(row);
  }
}
function renderActivationQueue(){
 const box=$('cloudActivationQueue');box.replaceChildren();
 const pending=activationRequests.filter(r=>r.status==='pending');
 if(!pending.length){box.append(el('p','hint','Belum ada pembayaran yang menunggu pemeriksaan.'));return;}
 pending.forEach(r=>{const item=el('div','bank-item');item.append(el('strong',null,`Nomor Lynk.id: ${r.order_reference}`),el('small',null,`User ID: ${r.user_id} • ${new Date(r.created_at).toLocaleString('id-ID')}`));
 const buttons=el('div','bank-actions');for(const [label,decision] of [['✓ Aktivasi','approved'],['✗ Tolak','rejected']]){
 const b=el('button',decision==='approved'?'edit-btn':'remove-btn',label);
 b.onclick=()=>{if(!confirm(`Sudah cek transaksi ${r.order_reference} di dashboard Lynk.id? ${label}`))return;
 cloudAction(async()=>window.SLCloud.reviewActivation(r.id,decision),decision==='approved'?'Premium diaktifkan.':'Pengajuan ditolak.');};buttons.append(b);}
 item.append(buttons);box.append(item);});
}
async function submitActivation(){const ref=$('activationOrderRef').value.trim();if(!ref)return showToast('Isi nomor transaksi Lynk.id terlebih dahulu.');
 await cloudAction(async()=>{await window.SLCloud.requestActivation(ref);$('activationOrderRef').value='';},'Pengajuan dikirim. Admin akan mengecek pembayaran di Lynk.id.');}
// V1.5.10: Stable, namespaced IDs for JSON files without explicit IDs.
// Same material + same order => safe reimport/update. Different material => different IDs.
function autoMasterId(raw, index){
  const meta=[String(raw.level||'').trim().toUpperCase(),String(raw.grade||'').trim(),
    canonicalSubject(raw.subject||'').toLowerCase().replace(/\s+/g,' '),
    String(raw.topic||'').trim().toLowerCase().replace(/\s+/g,' '),String(index+1)].join('\u001f');
  function digest(seed){
    let h=seed>>>0;
    for(let i=0;i<meta.length;i++){h=Math.imul(h^meta.charCodeAt(i),16777619)>>>0;}
    return h.toString(16).padStart(8,'0');
  }
  return `slkb-${String(raw.level||'x').toLowerCase()}${Number(raw.grade)||0}-${digest(2166136261)}${digest(2246822519)}-${String(index+1).padStart(3,'0')}`;
}
async function importPremiumMaster(evt){
 const file=evt.target.files?.[0];if(!file)return;
 try{
   if(window.SLCloud.role!=='admin')throw new Error('Impor master hanya untuk admin.');
   if(cloudBusy)throw new Error('Cloud sedang memproses permintaan sebelumnya.');
   const rows=await readQuestionFile(file);
   if(!Array.isArray(rows)||!rows.length||rows.length>1000)throw new Error('File harus berisi 1–1000 soal.');
   let generated=0;
   const items=rows.map((raw,i)=>{
     try{
       if(!raw||!raw.level||!raw.grade||!String(raw.subject||'').trim()||!String(raw.topic||'').trim())
         throw new Error('Jenjang, kelas, mata pelajaran, dan materi harus diisi pada setiap soal.');
       const explicit=raw.id==null?'':String(raw.id).trim();
       const id=explicit||autoMasterId(raw,i);
       if(!explicit)generated++;
       if(id.length<5||id.length>100)throw new Error('ID soal harus memiliki 5–100 karakter.');
       const q=normalQuestion(raw,id);
       return {...q,id};
     }catch(e){throw new Error(`Soal nomor ${i+1}: ${e.message}`)}
   });
   const ids=new Set();for(const q of items){
     if(ids.has(q.id))throw new Error(`ID duplikat dalam file: ${q.id}. Beri ID unik untuk setiap soal.`);
     ids.add(q.id);
   }
   if(!confirm(`Impor ${items.length} soal MASTER PREMIUM?\n\n${generated} soal tanpa ID akan memperoleh ID stabil berdasarkan jenjang, kelas, mapel, materi, dan urutan.\n\nImpor ulang paket yang sama akan memperbarui, sedangkan materi lain akan menambah soal.\n\nFile premium jangan ditempatkan dalam game publik.`))return;
   cloudBusy=true;
   const stats=await window.SLCloud.saveMasterQuestions(items);
   await loadCloudQuestions();
   const message=`Impor Master berhasil!\n\nSoal baru: ${stats.added}\nDiperbarui: ${stats.updated}\nDiproses: ${stats.total}\nTotal Master yang termuat: ${masterTotalCount}\n\nBila ada selisih, periksa metadata materi dan ID lama di Supabase.`;
   alert(message);showToast(`${stats.added} soal baru • ${stats.updated} diperbarui • total ${masterTotalCount} Master.`);
 }catch(e){alert('Impor Master gagal: '+e.message);showToast('Impor Premium gagal: '+e.message)}
 finally{cloudBusy=false;renderCloudPanel();evt.target.value='';}
}
// V1.5.12 — Monitoring Kelengkapan Bank Master, hanya Admin.
// Rekap dari RPC server: tidak pernah memuat pertanyaan / kunci Premium.
const monitorState={page:0,size:25,total:0,rows:[],summary:null,seq:0,busy:false,ready:false};
const MONITOR_STATES={missing:'Belum tersedia',partial:'Dalam proses',ready:'Target tercapai',verified:'Terverifikasi',uncatalogued:'Belum masuk katalog'};
const monitorTargetFor=level=>({SD:50,SMP:75,SMA:100}[level]||50);
function monitorNotice(message,error=false){
  const e=$('monitorNotice');if(!e)return;e.textContent=message;e.classList.toggle('is-error',!!error);
}
function monitorUpdateGrades(selectId,level,keep=''){
  const select=$(selectId);
  options(select,[['','Semua Kelas'],...(CAT.GRADES[level]||[]).map(g=>[String(g),`Kelas ${g}`])],keep,'');
}
function monitorUpdateAddGrade(){
  const level=$('monitorAddLevel').value;
  const s=$('monitorAddGrade');
  options(s,(CAT.GRADES[level]||[]).map(g=>[String(g),`Kelas ${g}`]),s.value,String((CAT.GRADES[level]||[1])[0]));
  $('monitorAddTarget').value=String(monitorTargetFor(level));
  monitorUpdateSuggestions();
}
function monitorUpdateSuggestions(){
  const dl=$('monitorSubjectSuggestions');dl.replaceChildren();
  const level=$('monitorAddLevel').value;
  const all=new Set([...(CAT.SUBJECTS[level]||[]),...$$('#monitorSubjectFilter option').map(o=>o.value).filter(Boolean)].map(canonicalSubject));
  [...all].sort((a,b)=>a.localeCompare(b,'id')).forEach(s=>{const o=el('option');o.value=s;dl.append(o)});
}
function monitorGetFilters(){
  return {level:$('monitorLevelFilter').value||null,
          grade:$('monitorGradeFilter').value?Number($('monitorGradeFilter').value):null,
          subject:$('monitorSubjectFilter').value||null,
          status:$('monitorStatusFilter').value||null};
}
async function monitorLoadSubjects(){
  if(window.SLCloud?.role!=='admin')return;
  const level=$('monitorLevelFilter').value||null,grade=$('monitorGradeFilter').value||null;
  const old=$('monitorSubjectFilter').value;
  try{
    const remote=await window.SLCloud.monitorSubjects(level,grade);
    if(level!==($('monitorLevelFilter').value||null)||grade!==($('monitorGradeFilter').value||null))return;
    const subjects=[...new Set([...(level?CAT.SUBJECTS[level]||[]:[]),...remote].map(canonicalSubject))].sort((a,b)=>a.localeCompare(b,'id'));
    options($('monitorSubjectFilter'),[['','Semua Mapel'],...subjects.map(s=>[s,s])],old,'');
    monitorUpdateSuggestions();
  }catch(e){
    monitorNotice('Gagal memuat pilihan mapel: '+e.message+'. Pastikan migrasi 004 sudah dijalankan.',true);
  }
}
function monitorStat(id,value){$(id).textContent=Number(value||0).toLocaleString('id-ID')}
function monitorRender(){
  const s=monitorState.summary||{};
  monitorStat('monitorStatMaterials',s.material_count);
  monitorStat('monitorStatQuestions',s.question_count);
  monitorStat('monitorStatMissing',s.missing);
  monitorStat('monitorStatPartial',s.partial);
  monitorStat('monitorStatReady',s.ready);
  monitorStat('monitorStatVerified',s.verified);
  const body=$('monitorRows');body.replaceChildren();
  if(!monitorState.rows.length){const tr=el('tr'),td=el('td',null,'Belum ada materi yang cocok. Daftarkan materi dari Master atau tambahkan target materi baru.');td.colSpan=6;tr.append(td);body.append(tr);}
  for(const row of monitorState.rows){
    const tr=el('tr');
    tr.append(el('td',null,`${row.level} • Kelas ${row.grade}`));
    tr.append(el('td',null,row.subject));
    tr.append(el('td','monitor-row-title',row.topic));
    const num=el('td');num.append(el('b',null,`${Number(row.question_count).toLocaleString('id-ID')} / ${Number(row.target_count).toLocaleString('id-ID')}`));
    const track=el('span','monitor-progress');const done=el('span');done.style.width=Math.min(100,Math.round(100*Number(row.question_count)/Math.max(1,Number(row.target_count))))+'%';track.append(done);num.append(track);tr.append(num);
    const statusCell=el('td');statusCell.append(el('span',`monitor-status ${row.status}`,MONITOR_STATES[row.status]||row.status));tr.append(statusCell);
    const actionCell=el('td');const buttons=el('div','monitor-row-actions');
    function addAction(key,text){const btn=el('button',null,text);btn.type='button';btn.dataset.monitorAction=key;btn.dataset.catalogId=row.catalog_id||'';btn.dataset.level=row.level;btn.dataset.grade=row.grade;btn.dataset.subject=row.subject;btn.dataset.topic=row.topic;btn.dataset.target=row.target_count;btn.dataset.count=row.question_count;btn.dataset.verified=String(row.quality_verified);btn.dataset.notes=row.notes||'';buttons.append(btn)}
    if(!row.catalog_id)addAction('register','+ Daftarkan');
    else{
      addAction('target','🎯 Target');
      addAction('note','✎ Catatan');
      if(row.quality_verified)addAction('unverify','↩ Batalkan QA');
      else if(Number(row.question_count)>=Number(row.target_count))addAction('verify','✓ Verifikasi');
      addAction('delete','Hapus katalog');
    }
    actionCell.append(buttons);tr.append(actionCell);body.append(tr);
  }
  const max=Math.max(1,Math.ceil(monitorState.total/monitorState.size));
  $('monitorPageInfo').textContent=`Halaman ${monitorState.page+1} / ${max} • ${Number(monitorState.total).toLocaleString('id-ID')} materi`;
  $('monitorPrevBtn').disabled=monitorState.page<=0;
  $('monitorNextBtn').disabled=monitorState.page+1>=max;
}
async function monitorRefresh(){
  const seq=++monitorState.seq;
  monitorNotice('Menghitung kelengkapan materi di Supabase...');
  try{
    const result=await window.SLCloud.monitorMaster({...monitorGetFilters(),offset:monitorState.page*monitorState.size,limit:monitorState.size});
    if(seq!==monitorState.seq || currentView!=='monitor')return;
    monitorState.rows=result?.rows||[];
    monitorState.total=Number(result?.total||0);
    monitorState.summary=result?.summary||{};
    if(monitorState.page>0&&!monitorState.rows.length&&monitorState.total>0){
      monitorState.page=Math.max(0,Math.ceil(monitorState.total/monitorState.size)-1);
      return monitorRefresh();
    }
    monitorState.ready=true;
    monitorRender();
    monitorNotice(`Data sinkron. ${monitorState.total.toLocaleString('id-ID')} materi pada filter saat ini. ${Number(monitorState.summary.uncatalogued||0)} materi sudah punya soal tetapi belum terdaftar di katalog.`);
  }catch(e){
    if(seq!==monitorState.seq)return;
    monitorState.ready=false;
    monitorNotice('Monitoring belum bisa digunakan: '+e.message+'. Jalankan file supabase/004_master_monitor_v1512.sql di SQL Editor (sekali), kemudian Refresh.',true);
  }
}
async function monitorChangeFilters(){
  monitorState.page=0;
  await monitorRefresh();
}
async function monitorMutate(action,notice){
  if(monitorState.busy)return;
  monitorState.busy=true;
  monitorNotice('Menyimpan perubahan katalog...');
  try{const result=await action();await monitorLoadSubjects();await monitorRefresh();showToast(typeof notice==='function'?notice(result):notice||'Katalog diperbarui.');}
  catch(e){monitorNotice('Gagal menyimpan katalog: '+e.message,true);showToast('Gagal: '+e.message)}
  finally{monitorState.busy=false}
}
async function monitorPerformAction(event){
  const button=event.target.closest('button[data-monitor-action]');if(!button)return;
  const x=button.dataset,subject=x.subject,topic=x.topic,level=x.level,grade=Number(x.grade);
  const title=`${level} Kelas ${grade} • ${subject} • ${topic}`;
  if(x.monitorAction==='register'){
    if(!confirm(`Daftarkan materi yang sudah mempunyai soal ini ke Katalog?\n\n${title}`))return;
    return monitorMutate(()=>window.SLCloud.addMasterCatalog([{level,grade,subject,topic,target_count:Number(x.target)}]),'Materi masuk ke Katalog.');
  }
  if(x.monitorAction==='target'){
    const input=prompt(`Ubah target soal untuk:\n${title}\n\nStandar: SD 50, SMP 75, SMA 100.`,String(x.target));
    if(input===null)return;
    const target=Number(input);
    if(!Number.isInteger(target)||target<1||target>1000)return showToast('Target harus bilangan bulat 1–1000.');
    if(x.verified==='true' && target>Number(x.count) && !confirm('Target baru lebih besar dari jumlah soal, sehingga status verifikasi akan dibatalkan. Lanjutkan?'))return;
    return monitorMutate(()=>window.SLCloud.updateCatalog(x.catalogId,{target_count:target,...(x.verified==='true'&&target>Number(x.count)?{quality_verified:false}:{})}),'Target diperbarui.');
  }
  if(x.monitorAction==='note'){
    const note=prompt(`Catatan produksi / peninjauan untuk:\n${title}`,x.notes||'');if(note===null)return;
    return monitorMutate(()=>window.SLCloud.updateCatalog(x.catalogId,{notes:note}),'Catatan diperbarui.');
  }
  if(x.monitorAction==='verify'){
    if(!confirm(`Pastikan Anda sudah memeriksa kesesuaian materi, kunci jawaban, dan kualitas pengecoh.\n\nTandai TERVERIFIKASI?\n${title}`))return;
    return monitorMutate(()=>window.SLCloud.updateCatalog(x.catalogId,{quality_verified:true}),'Materi ditandai Terverifikasi oleh Admin.');
  }
  if(x.monitorAction==='unverify'){
    if(!confirm(`Batalkan status verifikasi kualitas?\n${title}`))return;
    return monitorMutate(()=>window.SLCloud.updateCatalog(x.catalogId,{quality_verified:false}),'Verifikasi dibatalkan.');
  }
  if(x.monitorAction==='delete'){
    if(!confirm(`Hapus TARGET MATERI dari katalog?\n${title}\n\nSoal Premium di Supabase TIDAK dihapus. Jika masih punya soal, judul akan muncul sebagai Belum masuk katalog.`))return;
    return monitorMutate(()=>window.SLCloud.removeCatalog(x.catalogId),'Target materi dihapus; soal Master tetap aman.');
  }
}
async function monitorAdd(event){
  event.preventDefault();
  const row={level:$('monitorAddLevel').value,grade:Number($('monitorAddGrade').value),subject:canonicalSubject($('monitorAddSubject').value),topic:$('monitorAddTopic').value,target_count:Number($('monitorAddTarget').value),notes:$('monitorAddNotes').value};
  await monitorMutate(()=>window.SLCloud.addMasterCatalog([row]),n=>n?'Materi baru tersimpan di Katalog.':'Materi tersebut sudah ada di Katalog.');
  $('monitorAddTopic').value='';$('monitorAddNotes').value='';
}
async function monitorSeed(){
  if(!confirm('Daftarkan semua materi yang SUDAH memiliki soal Master ke Katalog?\n\nMateri kosong harus ditambahkan kemudian. Soal dan katalog yang telah ada tidak dihapus.'))return;
  await monitorMutate(()=>window.SLCloud.seedMasterCatalog(),n=>`${n} judul materi baru ditambahkan ke Katalog tanpa mengubah Bank Master.`);
}
function monitorDownload(name,text,mime){
  const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=el('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function monitorTemplate(){
  const level=$('monitorAddLevel').value,grade=Number($('monitorAddGrade').value),subject=canonicalSubject($('monitorAddSubject').value)||'PAI & Budi Pekerti';
  const sample={version:'1.5.12',petunjuk:'Daftar materi target, BUKAN isi soal. Sesuaikan level,grade,subject,topic pada setiap baris.',topics:[{level,grade,subject,topic:'GANTI_NAMA_MATERI_01',target_count:monitorTargetFor(level),notes:''},{level,grade,subject,topic:'GANTI_NAMA_MATERI_02',target_count:monitorTargetFor(level),notes:''}]};
  monitorDownload('template-katalog-materi-v1512.json',JSON.stringify(sample,null,2),'application/json');
}
async function monitorImport(event){
  const file=event.target.files?.[0];if(!file)return;
  try{
    const json=JSON.parse(await file.text());const rows=Array.isArray(json)?json:json.topics;
    if(!Array.isArray(rows)||!rows.length||rows.length>500)throw new Error('JSON harus memiliki array topics berisi 1–500 materi.');
    if(!confirm(`Daftarkan ${rows.length} materi target dari berkas ${file.name}?\nData yang sudah ada tidak ditimpa. Soal Master tidak diubah.`))return;
    await monitorMutate(()=>window.SLCloud.addMasterCatalog(rows),n=>`${n} materi baru didaftarkan. Item yang sudah ada tidak ditimpa.`);
  }catch(e){monitorNotice('Impor Katalog gagal: '+e.message,true);showToast('Impor katalog gagal.');}
  finally{event.target.value=''}
}
function monitorCSVValue(value){
  let s=String(value??'');
  // Cegah formula injection saat CSV dibuka di aplikasi spreadsheet.
  if(/^[\s]*[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
async function monitorExportCSV(){
  try{
    if(!monitorState.ready)throw new Error('Klik Refresh Monitoring terlebih dahulu.');
    monitorNotice('Menyiapkan rekap CSV dari server...');
    const filters=monitorGetFilters(),rows=[];
    let total=null;
    for(let i=0;i<1000;i++){
      const result=await window.SLCloud.monitorMaster({...filters,offset:i*100,limit:100});
      if(total===null)total=Number(result?.total||0);
      rows.push(...(result?.rows||[]));
      if(rows.length>=total||(result?.rows||[]).length<100)break;
    }
    if(total>rows.length)throw new Error('Laporan terlalu besar untuk satu ekspor. Pilih jenjang/kelas/mapel lebih spesifik.');
    const columns=['jenjang','kelas','mata_pelajaran','materi','jumlah_soal','target_soal','status','terverifikasi','catatan'];
    const lines=[columns.join(',')];
    for(const r of rows)lines.push([r.level,r.grade,r.subject,r.topic,r.question_count,r.target_count,MONITOR_STATES[r.status]||r.status,r.quality_verified?'Ya':'Tidak',r.notes||''].map(monitorCSVValue).join(','));
    const stamp=new Date().toISOString().slice(0,10);
    monitorDownload(`monitoring-master-${stamp}.csv`,'\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8');
    monitorNotice(`Rekap ${rows.length} materi berhasil disiapkan; file CSV diunduh.`);
  }catch(e){monitorNotice('Ekspor CSV gagal: '+e.message,true)}
}
function monitorWire(){
  monitorUpdateGrades('monitorGradeFilter','SD','');
  monitorUpdateAddGrade();
  $('monitorLevelFilter').addEventListener('change',async()=>{monitorUpdateGrades('monitorGradeFilter',$('monitorLevelFilter').value);await monitorLoadSubjects();monitorChangeFilters()});
  $('monitorGradeFilter').addEventListener('change',async()=>{await monitorLoadSubjects();monitorChangeFilters()});
  $('monitorSubjectFilter').addEventListener('change',monitorChangeFilters);
  $('monitorStatusFilter').addEventListener('change',monitorChangeFilters);
  $('monitorPageSize').addEventListener('change',()=>{monitorState.size=Number($('monitorPageSize').value)||25;monitorState.page=0;monitorRefresh()});
  $('monitorPrevBtn').addEventListener('click',()=>{if(monitorState.page>0){monitorState.page--;monitorRefresh()}});
  $('monitorNextBtn').addEventListener('click',()=>{if((monitorState.page+1)*monitorState.size<monitorState.total){monitorState.page++;monitorRefresh()}});
  $('monitorAddLevel').addEventListener('change',monitorUpdateAddGrade);
  $('monitorRows').addEventListener('click',monitorPerformAction);
  $('monitorRefreshBtn').addEventListener('click',async()=>{await monitorLoadSubjects();monitorRefresh()});
  $('monitorSeedBtn').addEventListener('click',monitorSeed);
  $('monitorTemplateBtn').addEventListener('click',monitorTemplate);
  $('monitorImportInput').addEventListener('change',monitorImport);
  $('monitorAddForm').addEventListener('submit',monitorAdd);
  $('monitorExportCsvBtn').addEventListener('click',monitorExportCSV);
}

function openLynk(){const url=window.SLStoreConfig?.lynkProductUrl;
 if(typeof url==='string' && /^https:\/\/(?:www\.)?lynk\.id\//i.test(url)){window.open(url,'_blank','noopener,noreferrer');}
 else showToast('URL produk Lynk.id belum tersedia. Pengembang akan memasukkannya saat publikasi.');}
async function cloudAction(work,success){
  if(cloudBusy)return;cloudBusy=true;
  try{await work();await loadCloudQuestions();showToast(success)}catch(e){showToast('Cloud: '+e.message)}
  finally{cloudBusy=false;renderCloudPanel();}
}
function showAuthMessage(text='',kind='info'){
  const box=$('authMessage');box.textContent=text;box.hidden=!text;
  box.classList.toggle('is-error',kind==='error');box.classList.toggle('is-success',kind==='success');
}
function showAuthForm(mode){
  authMode=mode;
  const types=['login','register','forgot','reset'];
  for(const type of types){
    const key=type==='login'?'cloudLoginForm':type==='register'?'cloudRegisterForm':type==='forgot'?'cloudForgotForm':'cloudResetForm';
    $(key).hidden=mode!==type;
  }
  $('authVerifyBox').hidden=mode!=='verify';
  $('authTabLogin').classList.toggle('active',mode==='login');
  $('authTabRegister').classList.toggle('active',mode==='register');
  $('authTabLogin').setAttribute('aria-selected',String(mode==='login'));
  $('authTabRegister').setAttribute('aria-selected',String(mode==='register'));
  document.querySelector('.auth-tabs').hidden=mode==='reset'||mode==='verify';
  if(mode!=='forgot')$('authRecoverySentBox').hidden=true;
  if(mode==='forgot'){
    const host=window.location.hostname;
    const local=/^(localhost|127\.0\.0\.1)$/i.test(host);
    $('authRecoveryDeviceHint').textContent=local
      ? '💻 Pengujian lokal: buka email reset pada perangkat yang SAMA dengan server game, di port yang sama. Tautan localhost tidak dapat dibuka dari HP lain. Untuk pembeli nantinya gunakan hosting HTTPS.'
      : '📱 Buka email reset pada perangkat yang bisa mengakses alamat website game. Jangan bagikan tautan atau token pemulihan.';
  }
  // Pesan sebelumnya direset saat berpindah formulir; pesan sukses eksplisit ditetapkan oleh pemanggil.
  showAuthMessage();
}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())}
function validatePassword(value){return value.length>=8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value)}
async function authRun(btn,work){
  if(cloudBusy)return;cloudBusy=true;btn.disabled=true;
  const old=btn.textContent;btn.textContent='Memproses…';showAuthMessage();
  try{await work();}
  catch(e){console.warn('[SLKB Auth]',e);showAuthMessage('Gagal: '+(e?.message||'Periksa koneksi dan coba lagi.'),'error');}
  finally{cloudBusy=false;btn.textContent=old;renderCloudPanel();}
}
async function cloudLogin(){
  const email=$('cloudEmail').value.trim().toLowerCase(),pwd=$('cloudPassword').value;
  await authRun($('cloudLoginBtn'),async()=>{
    if(!validEmail(email)||!pwd)throw new Error('Isi alamat email yang valid dan kata sandi.');
    await window.SLCloud.login(email,pwd);
    $('cloudPassword').value='';
    await loadCloudQuestions();
    showView('cloud');
    showToast('Berhasil masuk. Selamat datang!');
  });
}
async function cloudRegister(){
  const email=$('cloudRegisterEmail').value.trim().toLowerCase(),pwd=$('cloudRegisterPassword').value;
  const name=$('cloudDisplayName').value.trim(),confirm=$('cloudRegisterConfirm').value;
  await authRun($('cloudRegisterBtn'),async()=>{
    if(name.length<3)throw new Error('Masukkan nama lengkap minimal 3 karakter.');
    if(!validEmail(email))throw new Error('Masukkan email aktif yang valid.');
    if(!validatePassword(pwd))throw new Error('Kata sandi minimal 8 karakter dan terdiri dari huruf serta angka.');
    if(pwd!==confirm)throw new Error('Konfirmasi kata sandi belum sama.');
    const data=await window.SLCloud.register(email,pwd,name);
    $('cloudRegisterPassword').value='';$('cloudRegisterConfirm').value='';
    if(data?.session){
      await loadCloudQuestions();showView('cloud');showToast('Akun Guru berhasil dibuat. Status awal Demo Gratis.');
    }else{
      authVerificationEmail=email;
      $('cloudEmail').value=email;
      showAuthForm('verify');
      showAuthMessage('Pendaftaran diproses. Jika email verifikasi diterima, klik tautannya terlebih dahulu. Setelah itu pilih Masuk.','success');
    }
  });
}
async function cloudResendVerification(){
  await authRun($('authResendBtn'),async()=>{
    if(!validEmail(authVerificationEmail))throw new Error('Email pendaftaran tidak tersedia. Ulangi pendaftaran terlebih dahulu.');
    await window.SLCloud.resendVerification(authVerificationEmail);
    showAuthMessage('Jika akun masih memerlukan verifikasi, email baru akan dikirim. Periksa inbox dan spam.','success');
  });
}
async function cloudForgotPassword(){
  const email=$('cloudForgotEmail').value.trim().toLowerCase();
  await authRun($('cloudForgotBtn'),async()=>{
    if(!validEmail(email))throw new Error('Masukkan alamat email yang valid.');
    await window.SLCloud.requestPasswordReset(email);
    $('authRecoverySentBox').hidden=false;
    showAuthMessage('Jika email terdaftar, tautan reset telah diminta. Periksa Inbox dan Spam.','success');
  });
}
async function cloudResetPassword(){
  const pwd=$('cloudNewPassword').value,confirm=$('cloudNewPasswordConfirm').value;
  await authRun($('cloudResetBtn'),async()=>{
    if(!validatePassword(pwd))throw new Error('Kata sandi baru minimal 8 karakter, mengandung huruf dan angka.');
    if(pwd!==confirm)throw new Error('Konfirmasi kata sandi belum sama.');
    await window.SLCloud.changeRecoveredPassword(pwd);
    $('cloudNewPassword').value='';$('cloudNewPasswordConfirm').value='';
    window.SLCloud.finishPasswordRecovery();
    await window.SLCloud.logout();
    cloudQuestions=[];premiumQuestions=[];masterTotalCount=0;cloudSyncWarnings=[];facetCache.clear();activationRequests=[];
    showAuthForm('login');showView('cloud');
    showAuthMessage('Kata sandi berhasil diperbarui. Silakan Masuk menggunakan kata sandi baru.','success');
  });
}
async function cloudLogout(){await cloudAction(async()=>{await window.SLCloud.logout();cloudQuestions=[];premiumQuestions=[];masterTotalCount=0;cloudSyncWarnings=[];facetCache.clear();activationRequests=[];deck=[];deckIndex=0;usedQuestionKeys.clear();retrySession=null;activeQuestion=null;state=null;phase='idle';cancelEdit();monitorState.rows=[];monitorState.total=0;monitorState.summary=null;monitorState.ready=false;$('monitorRows').replaceChildren();showView('cloud');},'Keluar akun. Soal pribadi dihapus dari memori perangkat.');}
async function importCloudBank(evt){const file=evt.target.files?.[0];if(!file)return;
  try{if(!canManageBank())throw new Error('Impor Bank Soal Cloud hanya untuk Premium/Admin.');
    const arr=await readQuestionFile(file);
    if(!Array.isArray(arr)||arr.length<1||arr.length>100)throw new Error('Untuk impor cloud, pilih 1–100 soal per file.');
    const imported=arr.filter(q=>!String(q.id||'').startsWith('demo-')).map((q,i)=>normalQuestion(fitLowGradeOptions(q),'cloud-import-'+i));
    if(imported.some(q=>!['SD','SMP','SMA'].includes(q.level)))throw new Error('Setiap soal Cloud harus mempunyai jenjang SD/SMP/SMA dan kelas.');
    if(!confirm(`Impor ${imported.length} soal sebagai PRIVATE pada akun ${window.SLCloud.user.email}?`))return;
    await cloudAction(async()=>{await window.SLCloud.saveMany(imported)},`${imported.length} soal tersimpan di Bank Pribadi Cloud.`);
  }catch(e){showToast('Gagal impor ke Cloud: '+e.message)}finally{evt.target.value='';}
}
function wire(){
  monitorWire();
  updateMusic();buildBoard();renderSetup();renderSettings();$('newLevel').value='SD';syncAddSubjects();$('muteBtn').textContent=settings.sfx?'🔊':'🔇';
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>{
    if(!$('quizOverlay').hidden||!$('diceRevealOverlay').hidden)return;
    const v=b.dataset.view;
    if(['rolling','reveal','animating'].includes(phase)&&v!=='game'){showToast('Selesaikan animasi giliran dahulu.');return;}
    showView(v);
  }));
  [['setupLevel','level'],['setupGrade','grade'],['subjectSelect','subject'],['setupTopic','topic']].forEach(([id,changed])=>$(id).addEventListener('change',()=>cascadeFilters('setup',changed)));
  [['bankLevel','level'],['bankGrade','grade'],['bankFilter','subject'],['bankTopic','topic']].forEach(([id,changed])=>$(id).addEventListener('change',()=>cascadeFilters('bank',changed)));
  $('newLevel').addEventListener('change',syncAddSubjects);$('newGrade').addEventListener('change',syncChoiceCount);$('newSubject').addEventListener('change',syncOtherSubject);$('cancelEditBtn').addEventListener('click',cancelEdit);

  $('startGameBtn').addEventListener('click',startGame);
  $('useDemoBankBtn').addEventListener('click',useDemoBank);
  $('rollBtn').addEventListener('click',startRoll);
  $('diceRevealContinueBtn').addEventListener('click',proceedAfterDiceReveal);
  $('artToggleBtn').addEventListener('click',()=>{settings.art=!settings.art;storage.set('slkb.settings.v1',settings);renderGame()});
  $('quizSubmitBtn').addEventListener('click',()=>evaluateAnswer(false));$('quizContinueBtn').addEventListener('click',commitTurn);
  $('endGameBtn').addEventListener('click',endGame);$('playAgainBtn').addEventListener('click',()=>{state=null;phase='idle';showView('setup')});
  $('questionBackBtn').addEventListener('click',()=>showView(previousView==='questions'?'menu':previousView));
  $('helpBackBtn').addEventListener('click',()=>showView(previousView==='help'?'menu':previousView));
  $('helpProceedBtn').addEventListener('click',()=>showView(previousView==='help'?'menu':previousView));
  $('addQuestionForm').addEventListener('submit',addQuestion);
  $('buyPremiumBtn').addEventListener('click',openLynk);$('menuBuyPremiumBtn').addEventListener('click',openLynk);$('cloudActivationRequestBtn').addEventListener('click',submitActivation);$('cloudMasterImportInput').addEventListener('change',importPremiumMaster);
  $('cloudLoginForm').addEventListener('submit',e=>{e.preventDefault();cloudLogin()});
  $('cloudRegisterForm').addEventListener('submit',e=>{e.preventDefault();cloudRegister()});
  $('cloudForgotForm').addEventListener('submit',e=>{e.preventDefault();cloudForgotPassword()});
  $('cloudResetForm').addEventListener('submit',e=>{e.preventDefault();cloudResetPassword()});
  $('authTabLogin').addEventListener('click',()=>showAuthForm('login'));
  $('authTabRegister').addEventListener('click',()=>showAuthForm('register'));
  $('authForgotLink').addEventListener('click',()=>{$('cloudForgotEmail').value=$('cloudEmail').value;showAuthForm('forgot')});
  $('authBackLogin').addEventListener('click',()=>showAuthForm('login'));
  $('authResendBtn').addEventListener('click',cloudResendVerification);
  $('authVerifiedLoginBtn').addEventListener('click',()=>showAuthForm('login'));
  $$('[data-toggle-password]').forEach(button=>button.addEventListener('click',()=>{
    const input=$(button.dataset.togglePassword);const reveal=input.type==='password';
    input.type=reveal?'text':'password';button.textContent=reveal?'Sembunyi':'Lihat';
    button.setAttribute('aria-label',reveal?'Sembunyikan kata sandi':'Tampilkan kata sandi');
  }));
  window.addEventListener('slkb-password-recovery',()=>{showAuthForm('reset');showView('cloud')});
  $('cloudLogoutBtn').addEventListener('click',cloudLogout);
  const syncAccount=()=>cloudAction(async()=>{await window.SLCloud.refreshAuth()},'Status lisensi dan Bank Soal diperbarui.');
  $('cloudRefreshBtn').addEventListener('click',syncAccount);
  $('adminRefreshBtn').addEventListener('click',syncAccount);
  $('adminLogoutBtn').addEventListener('click',cloudLogout);
  $('teacherBuyBtn').addEventListener('click',openLynk);$('refreshCloudBankBtn').addEventListener('click',()=>cloudAction(async()=>{await window.SLCloud.refreshAuth()},'Status lisensi dan Bank Soal diperbarui.'));
  $('importCloudInput').addEventListener('change',importCloudBank);
  $('bankPageSize').addEventListener('change',()=>{bankPageSize=Number($('bankPageSize').value)||25;bankPage=1;renderBankList()});
  $('bankPrevBtn').addEventListener('click',()=>{if(bankPage>1){bankPage--;renderBankList()}});
  $('bankNextBtn').addEventListener('click',()=>{bankPage++;renderBankList()});
  $('downloadTopicTemplateBtn').addEventListener('click',downloadTopicTemplate);$('downloadCsvTemplateBtn').addEventListener('click',downloadCSVTemplate);$('exportLocalBankBtn').addEventListener('click',exportLocalBank);$('exportBankBtn').addEventListener('click',exportBank);$('importBankInput').addEventListener('change',importBank);
  $('saveSettingsBtn').addEventListener('click',saveSettings);$('resetSettingsBtn').addEventListener('click',resetSettings);
  $('bgmVolume').addEventListener('input',()=>{$('bgmVolumeValue').textContent=$('bgmVolume').value+'%';window.SLAudio?.setMusicVolume(Number($('bgmVolume').value));});
  $('previewCorrectBtn').addEventListener('click',()=>window.SLAudio?.playEffect('correct',true));
  $('previewWrongBtn').addEventListener('click',()=>window.SLAudio?.playEffect('wrong',true));
  $('previewDiceBtn').addEventListener('click',()=>window.SLAudio?.playEffect('dice',true));
  $('previewClickBtn').addEventListener('click',()=>window.SLAudio?.playEffect('click',true));
  $('previewVictoryBtn').addEventListener('click',()=>window.SLAudio?.playEffect('victory',true));
  $('replayVictoryBtn').addEventListener('click',()=>window.SLAudio?.playEffect('victory',true));
  $('muteBtn').addEventListener('click',()=>{settings.sfx=!settings.sfx;storage.set('slkb.settings.v1',settings);$('muteBtn').textContent=settings.sfx?'🔊':'🔇';window.SLAudio?.configure(settings);if(settings.sfx)window.SLAudio?.playEffect('click')});
  $('fullscreenBtn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{showToast('Layar penuh tidak didukung pada perangkat ini.')}});
  document.addEventListener('keydown',evt=>{if(evt.key==='Escape'&&(!$('quizOverlay').hidden||!$('diceRevealOverlay').hidden)){evt.preventDefault();showToast('Lihat hasil dadu dan selesaikan soal sebelum beralih giliran.')}});
  window.addEventListener('beforeunload',ev=>{if(state&&!state.finished&&state.turn>0){ev.preventDefault();ev.returnValue=''}});
  // Exposes readonly status for automated QA; no in-game cheating controls.
  Object.defineProperty(window,'SLGameDebug',{get:()=>Object.freeze({phase,view:currentView,turn:state?.turn,positions:state?.teams.map(t=>t.position),winner:state?.winner,roll:lastRoll,sixStreak:state?.sixStreak,dieVisible:!$('diceRevealOverlay').hidden,quizOpen:!$('quizOverlay').hidden})});
  showView('menu');
  initCloud();
}
document.addEventListener('DOMContentLoaded',()=>{
  try{wire();}
  catch(e){
    console.error('[SLKB] Inisialisasi gagal:',e);
    const toast=document.getElementById('toast');
    if(toast){toast.hidden=false;toast.textContent='⚠ Berkas game belum lengkap atau tidak cocok. Ekstrak ulang V1.5.12 dan pastikan folder js, config, css, dan assets tetap utuh.';}
  }
});
})();
