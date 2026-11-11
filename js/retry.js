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
