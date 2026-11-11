const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
const block=source.slice(source.indexOf('function resetDeck(){'),source.indexOf('function startRoll(){'));
for(const cycle of [20,50,100,0]){
  const pool=Array.from({length:500},(_,i)=>({id:'q'+i}));
  const context={deck:[],deckIndex:0,usedQuestionKeys:new Set(),selectedBank:{},settings:{cycle,shuffle:true},RETRY:{questionKey:q=>q.id},poolOf:()=>pool,shuffle:arr=>[...arr].reverse(),quizNumber:0,isRetryQuestion:false,Error,Map,Set};
  vm.createContext(context);
  vm.runInContext(block,context);
  const first=vm.runInContext('nextQuestion()',context);
  assert.equal(context.deck.length,cycle||500);
  const ids=[first.id];
  for(let i=1;i<500;i++)ids.push(vm.runInContext('nextQuestion()',context).id);
  assert.equal(new Set(ids).size,500,`Duplikasi sebelum 500 habis pada siklus ${cycle}`);
  assert.equal(context.usedQuestionKeys.size,500);
  const next=vm.runInContext('nextQuestion()',context);
  assert(pool.some(q=>q.id===next.id));
  assert.equal(context.usedQuestionKeys.size,1);
  console.log('PASS siklus',cycle||'semua',': 500 soal unik sebelum pengulangan');
}
