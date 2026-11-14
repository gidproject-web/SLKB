/* Snake & Ladder Cloud Bank v1.4 — browser adapter, Model C */
(() => {
  'use strict';
  const cfg = window.SLCloudConfig || {};
  // V1.5.12a: normalisasi nama PAI, tidak mengubah ID atau isi soal.
  function canonicalSubject(value){
    const s=String(value??'').trim();
    return /^Pendidikan\s+Agama\s+Islam\s+dan\s+Budi\s+Pekerti$/i.test(s)?'PAI & Budi Pekerti':s;
  }
  let client = null;
  let user = null;
  let role = 'teacher';
  let premium = false;
  let schemaReady = true;
  let passwordRecovery = false;
  const isWebUrl = () => /^https?:$/.test(window.location.protocol);
  const emailRedirect = (recovery=false) => {
    if(!isWebUrl())return null;
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    if(recovery)url.searchParams.set('auth','recovery');
    return url.toString();
  };
  const recoveryInUrl = () => new URLSearchParams(window.location.search).get('auth') === 'recovery';
  const authReturnError = () => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams((window.location.hash||'').replace(/^#/,''));
    const code = query.get('error_code') || hash.get('error_code') || query.get('error') || hash.get('error');
    // Jangan pernah menampilkan atau mencatat token autentikasi.
    if(!code)return '';
    return 'Tautan email gagal digunakan atau sudah kedaluwarsa. Minta tautan baru dari halaman Lupa Kata Sandi.';
  };

  const err = (e) => { if (e) throw e; };
  const configured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test((cfg.url||'').trim()) && String(cfg.anonKey||'').length > 15;
  async function init(){
    if(!configured()) return false;
    if(!window.supabase?.createClient){
      await new Promise((resolve, reject)=>{
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload=resolve; s.onerror=()=>reject(new Error('Supabase SDK tidak dapat dimuat. Periksa koneksi internet.'));
        document.head.append(s);
      });
    }
    client=window.supabase.createClient(cfg.url.trim(),cfg.anonKey.trim(),{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    client.auth.onAuthStateChange((event) => {
      if(event==='PASSWORD_RECOVERY'){
        passwordRecovery = true;
        // Setelah Supabase memproses tautan, buang token dari address bar.
        if(isWebUrl()){
          const u = new URL(window.location.href);
          if(u.hash)window.history.replaceState(null,'',u.pathname+u.search);
        }
        // Callback harus sinkron; jangan memanggil Supabase secara await di sini.
        window.dispatchEvent(new Event('slkb-password-recovery'));
      }
    });
    await refreshAuth();return true;
  }
  async function refreshAuth(){
    if(!client) return null;
    const r=await client.auth.getUser();
    if(r.error && !/Auth session missing/i.test(r.error.message||'')) throw r.error;
    user=r.data?.user||null; role='teacher';premium=false;schemaReady=true;
    if(user){
      const roles=await client.from('slkb_user_roles').select('role').eq('user_id',user.id).maybeSingle();
      err(roles.error); role=roles.data?.role === 'admin'?'admin':'teacher';
      if(role==='admin'){premium=true;}else{
        const lic=await client.from('slkb_entitlements').select('status').eq('user_id',user.id).maybeSingle();
        if(lic.error){schemaReady=false;premium=false;}else premium=lic.data?.status==='active';
      }
    }
    return user;
  }
  async function login(email, password){ if(!client)throw new Error('Konfigurasi Supabase belum diisi.');
    const r=await client.auth.signInWithPassword({email,password});err(r.error);await refreshAuth();return user;
  }
  async function register(email, password, name){if(!client)throw new Error('Konfigurasi Supabase belum diisi.');
    const options={data:{display_name:name}};
    if(emailRedirect())options.emailRedirectTo=emailRedirect();
    const r=await client.auth.signUp({email,password,options});err(r.error);
    if(r.data?.session)await refreshAuth();return r.data;
  }
  async function resendVerification(email){if(!client)throw new Error('Koneksi Supabase belum tersedia.');
    const options={};if(emailRedirect())options.emailRedirectTo=emailRedirect();
    const r=await client.auth.resend({type:'signup',email,options});err(r.error);return true;
  }
  async function requestPasswordReset(email){if(!client)throw new Error('Koneksi Supabase belum tersedia.');
    if(!isWebUrl())throw new Error('Pemulihan kata sandi memerlukan alamat http://localhost atau hosting HTTPS. Jalankan game melalui server lokal untuk uji coba.');
    const r=await client.auth.resetPasswordForEmail(email,{redirectTo:emailRedirect(true)});
    err(r.error);return true;
  }
  async function changeRecoveredPassword(password){if(!client)throw new Error('Koneksi Supabase belum tersedia.');
    if(!user || !passwordRecovery)throw new Error('Sesi pemulihan belum terverifikasi. Buka tautan reset yang baru dari email pada browser ini.');
    const r=await client.auth.updateUser({password});err(r.error);return true;
  }
  function finishPasswordRecovery(){
    passwordRecovery=false;
    if(isWebUrl()){
      const u=new URL(window.location.href);u.searchParams.delete('auth');u.hash='';
      window.history.replaceState(null,'',u.pathname+u.search);
    }
  }
  function isRecoveryFlow(){return passwordRecovery || recoveryInUrl()}
  function isRecoveryVerified(){return passwordRecovery}
  async function logout(){if(!client)return;const r=await client.auth.signOut();err(r.error);user=null;role='teacher';premium=false}
  async function listQuestions(){if(!client||!user)return [];
    // RLS membatasi: pemilik + approved + antrean khusus admin.
    const out=[];for(let a=0;a<10000;a+=500){
      const r=await client.from('slkb_questions').select('*').order('updated_at',{ascending:false}).range(a,a+499);
      err(r.error);out.push(...(r.data||[]));if(!r.data||r.data.length<500)break;
    }return out;
  }
  async function saveQuestion(q, id=null){if(!user||!premium)throw new Error('Penyimpanan Cloud hanya untuk Premium/Admin.');
    const data={level:q.level,grade:q.grade,subject:canonicalSubject(q.subject),topic:q.topic||'Umum',question:q.question,choices:q.choices,answer:q.answer,explanation:q.explanation||''};
    if(id){const r=await client.from('slkb_questions').update(data).eq('id',id).select('id').single();err(r.error);return r.data;}
    const r=await client.from('slkb_questions').insert({...data, owner_id:user.id}).select('id').single();err(r.error);return r.data;
  }
  async function saveMany(questions){if(!user||!premium)throw new Error('Impor Cloud hanya untuk Premium/Admin.');
    if(!questions.length)return 0;
    const rows=questions.map(q=>({owner_id:user.id,level:q.level,grade:q.grade,subject:canonicalSubject(q.subject),topic:q.topic||'Umum',question:q.question,choices:q.choices,answer:q.answer,explanation:q.explanation||''}));
    let done=0;for(let i=0;i<rows.length;i+=50){
      const r=await client.from('slkb_questions').insert(rows.slice(i,i+50));
      if(r.error)throw new Error(`${r.error.message} (${done} soal sudah tersimpan di Cloud)`);done+=Math.min(50,rows.length-i);
    }return done;
  }
  async function removeQuestion(id){const r=await client.from('slkb_questions').delete().eq('id',id).select('id').single();err(r.error)}
  async function submit(id){const r=await client.rpc('slkb_submit_question',{p_id:id});err(r.error)}
  async function review(id,decision){const r=await client.rpc('slkb_review_question',{p_id:id,p_decision:decision});err(r.error)}
  // V1.5.11 — pembacaan Master berdasarkan filter, bukan seluruh koleksi.
  const MASTER_COLUMNS='id,level,grade,subject,topic,question,choices,answer,explanation';
  function masterQuery(filter={}, columns=MASTER_COLUMNS, opts={}){
    let q=client.from('slkb_master_questions').select(columns,opts);
    if(filter.level && filter.level!=='all')q=q.eq('level',filter.level);
    if(filter.grade!=null && filter.grade!=='all' && filter.grade!=='')q=q.eq('grade',Number(filter.grade));
    if(filter.subject && filter.subject!=='all')q=q.eq('subject',canonicalSubject(filter.subject));
    if(filter.topic && filter.topic!=='all')q=q.eq('topic',filter.topic);
    return q;
  }
  async function countMasterQuestions(filter={}){
    if(!client || !user || !premium || !schemaReady)return 0;
    const r=await masterQuery(filter,'id',{count:'exact',head:true});err(r.error);
    return Number(r.count||0);
  }
  async function masterPage(filter={},offset=0,pageSize=25){
    if(!client || !user || !premium || !schemaReady)return {rows:[],count:0};
    const off=Math.max(0,Math.floor(Number(offset)||0));
    const n=Math.min(50,Math.max(1,Math.floor(Number(pageSize)||25)));
    const r=await masterQuery(filter,MASTER_COLUMNS,{count:'exact'}).order('id').range(off,off+n-1);
    err(r.error);return {rows:r.data||[],count:Number(r.count||0)};
  }
  async function listMasterQuestions(filter={},maxRows=500){
    if(!client || !user || !premium || !schemaReady)return [];
    const max=Math.min(500,Math.max(1,Number(maxRows)||500));
    const total=await countMasterQuestions(filter);
    if(!total)return [];
    const result=[];
    // Ambil seluruh paket kecil, mis. satu materi 50/75/100 soal.
    // Untuk semua materi yang sangat besar, ambil sampel lintas rentang ID
    // daripada mengunduh puluhan ribu soal sekaligus.
    if(total<=max){
      for(let offset=0;offset<total;offset+=250){
        const r=await masterQuery(filter).order('id').range(offset,Math.min(total-1,offset+249));
        err(r.error);result.push(...(r.data||[]));
      }
    }else{
      const windows=5;const size=Math.floor(max/windows);
      const segmentSize=Math.floor(total/windows);
      for(let i=0;i<windows;i++){
        const low=i*segmentSize;
        const high=Math.min(total-size,(i+1)*segmentSize-size);
        const first=low+Math.floor(Math.random()*(Math.max(0,high-low)+1));
        const r=await masterQuery(filter).order('id').range(first,first+size-1);
        err(r.error);result.push(...(r.data||[]));
      }
    }
    return result;
  }
  async function masterFacets(level,grade){
    if(!client || !user || !premium || !schemaReady || !level || level==='all' || grade==='all')return [];
    const params={p_level:level,p_grade:Number(grade)};
    const r=await client.rpc('slkb_master_facets_v1511',params);
    if(!r.error)return r.data||[];
    // Migrasi SQL belum dijalankan: fallback terbatas, bukan operasi tulis.
    if(!['PGRST202','42883'].includes(String(r.error.code||'')) && !/slkb_master_facets_v1511|Could not find the function/i.test(r.error.message||''))throw r.error;
    const rows=[];for(let offset=0;offset<3000;offset+=500){
      const part=await client.from('slkb_master_questions').select('subject,topic')
        .eq('level',level).eq('grade',Number(grade)).order('subject').order('topic').range(offset,offset+499);
      err(part.error);rows.push(...(part.data||[]));if((part.data||[]).length<500)break;
    }
    const grouped=new Map();for(const row of rows){const k=JSON.stringify([row.subject,row.topic]);
      if(!grouped.has(k))grouped.set(k,{subject:row.subject,topic:row.topic,jumlah:0});grouped.get(k).jumlah++;}
    return [...grouped.values()];
  }
  async function saveMasterQuestions(questions){
    if(role!=='admin')throw new Error('Hanya admin dapat mengimpor Master Premium.');
    const rows=questions.map(q=>({id:q.id,level:q.level,grade:q.grade,subject:canonicalSubject(q.subject),topic:q.topic,question:q.question,choices:q.choices,answer:q.answer,explanation:q.explanation||''}));
    let added=0,updated=0;
    const existingById=new Map();
    // PRE-FLIGHT seluruh file SEBELUM upsert apa pun; tabrakan pada batch akhir
    // tidak boleh menyebabkan batch awal terlanjur disimpan.
    for(let i=0;i<rows.length;i+=50){
      const batch=rows.slice(i,i+50);
      const old=await client.from('slkb_master_questions').select('id,level,grade,subject,topic').in('id',batch.map(q=>q.id));
      err(old.error);
      for(const oldRow of old.data||[])existingById.set(oldRow.id,oldRow);
    }
    for(const row of rows){
      const prev=existingById.get(row.id);
      if(!prev){added++;continue;}
      const same=prev.level===row.level && Number(prev.grade)===Number(row.grade) &&
        prev.subject===row.subject && prev.topic===row.topic;
      if(!same)throw new Error(`ID ${row.id} SUDAH DIPAKAI oleh materi "${prev.topic}" (${prev.subject}, ${prev.level} ${prev.grade}). Impor dibatalkan sebelum menyimpan data baru.`);
      updated++;
    }
    // Jika materi yang sama sudah ada tetapi semua ID baru, waspadai duplikat
    // akibat migrasi dari master-0/master-1 atau generator ID versi lama.
    const groups=new Map();
    for(const row of rows){
      const key=[row.level,row.grade,row.subject,row.topic].join('');
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
    }
    for(const group of groups.values()){
      const first=group[0];
      const found=await client.from('slkb_master_questions').select('id')
        .eq('level',first.level).eq('grade',first.grade).eq('subject',first.subject)
        .eq('topic',first.topic).limit(2000);
      err(found.error);
      const saved=found.data||[];const ids=new Set(saved.map(q=>q.id));
      const overlap=group.some(q=>ids.has(q.id));
      if(saved.length && !overlap){
        throw new Error(`Materi "${first.topic}" sudah mempunyai ${saved.length} soal dengan ID berbeda. Untuk menghindari duplikat, periksa ID lama di Supabase sebelum impor ulang. Impor dibatalkan.`);
      }
    }
    // Semua pemeriksaan lolos; proses simpan per 50 baris.
    for(let i=0;i<rows.length;i+=50){
      const result=await client.from('slkb_master_questions').upsert(rows.slice(i,i+50),{onConflict:'id'});
      err(result.error);
    }
    return {total:rows.length,added,updated};
  }
  // V1.5.12 — rekap Admin hanya mengambil metadata & hitungan, bukan isi soal.
  function requireMonitorAdmin(){
    if(!client || !user || role!=='admin')throw new Error('Monitoring khusus Admin. Silakan login ulang sebagai Admin.');
  }
  async function monitorMaster({level=null,grade=null,subject=null,status=null,offset=0,limit=25}={}){
    requireMonitorAdmin();
    const r=await client.rpc('slkb_master_monitor_v1512',{
      p_level:level||null,p_grade:grade==null||grade===''?null:Number(grade),
      p_subject:subject?.trim()||null,p_status:status||null,
      p_offset:Math.max(0,Number(offset)||0),p_limit:Math.min(100,Math.max(1,Number(limit)||25))
    });err(r.error);return r.data;
  }
  async function monitorSubjects(level=null,grade=null){
    requireMonitorAdmin();
    const r=await client.rpc('slkb_master_monitor_subjects_v1512',{
      p_level:level||null,p_grade:grade==null||grade===''?null:Number(grade)
    });err(r.error);return r.data||[];
  }
  async function seedMasterCatalog(){
    requireMonitorAdmin();
    const r=await client.rpc('slkb_catalog_seed_from_master_v1512');err(r.error);return Number(r.data||0);
  }
  function cleanCatalog(row){
    const level=String(row.level||'').toUpperCase().trim(),grade=Number(row.grade);
    const subject=canonicalSubject(row.subject),topic=String(row.topic||'').trim();
    const ok=(level==='SD'&&grade>=1&&grade<=6)||(level==='SMP'&&grade>=7&&grade<=9)||(level==='SMA'&&grade>=10&&grade<=12);
    if(!ok||!Number.isInteger(grade))throw new Error('Jenjang atau kelas tidak sesuai.');
    if(!subject||subject.length>60||!topic||topic.length>100)throw new Error('Nama mata pelajaran/materi kosong atau terlalu panjang.');
    if(/^GANTI_/i.test(topic))throw new Error('Ganti nama materi pada template, jangan impor contoh GANTI_*.');
    const target=Number(row.target_count||({SD:50,SMP:75,SMA:100}[level]));
    if(!Number.isInteger(target)||target<1||target>1000)throw new Error('Target soal harus 1–1000.');
    const notes=String(row.notes||'').trim();if(notes.length>500)throw new Error('Catatan maksimal 500 karakter.');
    return {level,grade,subject,topic,target_count:target,notes};
  }
  async function addMasterCatalog(rows){
    requireMonitorAdmin();
    if(!Array.isArray(rows)||!rows.length||rows.length>500)throw new Error('Impor katalog maksimal 500 materi per file.');
    const cleaned=rows.map((r,i)=>{try{return cleanCatalog(r)}catch(e){throw new Error(`Materi ke-${i+1}: ${e.message}`)}});
    // ON CONFLICT DO NOTHING: tidak menghapus status verifikasi & catatan katalog lama.
    let inserted=0;
    for(let i=0;i<cleaned.length;i+=50){
      const r=await client.from('slkb_master_topics')
        .upsert(cleaned.slice(i,i+50),{onConflict:'level,grade,subject,topic',ignoreDuplicates:true})
        .select('id');err(r.error);inserted+=(r.data||[]).length;
    }
    return inserted;
  }
  async function updateCatalog(id,patch){
    requireMonitorAdmin();
    const allowed={};
    if(patch.target_count!==undefined){
      const target=Number(patch.target_count);
      if(!Number.isInteger(target)||target<1||target>1000)throw new Error('Target harus 1–1000.');
      allowed.target_count=target;
    }
    if(patch.quality_verified!==undefined)allowed.quality_verified=!!patch.quality_verified;
    if(patch.notes!==undefined){const notes=String(patch.notes).trim();if(notes.length>500)throw new Error('Catatan maksimal 500 karakter.');allowed.notes=notes;}
    const r=await client.from('slkb_master_topics').update(allowed).eq('id',id).select('id').single();err(r.error);return r.data;
  }
  async function removeCatalog(id){
    requireMonitorAdmin();
    // Hanya katalog target; TIDAK menghapus soal Premium dari Master.
    const r=await client.from('slkb_master_topics').delete().eq('id',id).select('id').single();err(r.error);
  }
  async function listActivationRequests(){
    if(!user || !schemaReady)return [];
    let query=client.from('slkb_activation_requests').select('id,user_id,order_reference,status,created_at,reviewed_at');
    if(role!=='admin')query=query.eq('user_id',user.id);
    const r=await query.order('created_at',{ascending:false}).limit(role==='admin'?500:50);
    if(r.error)throw new Error('Gagal membaca antrean aktivasi: '+r.error.message);return r.data||[];
  }
  async function requestActivation(ref){
    if(!user)throw new Error('Login terlebih dahulu.');
    const r=await client.rpc('slkb_request_activation',{p_order_reference:ref});err(r.error);return r.data;
  }
  async function reviewActivation(id,decision){
    if(role!=='admin')throw new Error('Hanya admin.');
    const r=await client.rpc('slkb_review_activation',{p_request_id:id,p_decision:decision});err(r.error);
  }
  window.SLCloud={configured,init,refreshAuth,login,register,resendVerification,requestPasswordReset,changeRecoveredPassword,finishPasswordRecovery,isRecoveryFlow,isRecoveryVerified,authReturnError,logout,listQuestions,saveQuestion,saveMany,removeQuestion,submit,review,
    listMasterQuestions,countMasterQuestions,masterPage,masterFacets,saveMasterQuestions,monitorMaster,monitorSubjects,seedMasterCatalog,addMasterCatalog,updateCatalog,removeCatalog,listActivationRequests,requestActivation,reviewActivation,
    get client(){return client},get user(){return user},get role(){return role},get premium(){return premium},get schemaReady(){return schemaReady},get available(){return !!client}
  };
})();
