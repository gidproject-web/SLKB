const assert = require('node:assert/strict');
const R = require('../js/rules.js');
function run(name, fn) { try { fn(); console.log('OK',name); } catch(err) { console.error('FAIL',name); throw err; } }
run('100 kotak, pemetaan zigzag bijak',()=>{
 const coords=new Set();for(let n=1;n<=100;n++){const p=R.squareOf(n);assert.equal(R.squareAt(p.row,p.col),n);coords.add(`${p.row},${p.col}`)}
 assert.equal(coords.size,100);assert.deepEqual(R.squareOf(1),{row:9,col:0});assert.deepEqual(R.squareOf(20),{row:8,col:0});assert.deepEqual(R.squareOf(100),{row:0,col:0});
});
run('jumlah tim 2–6',()=>{for(let n=2;n<=6;n++)assert.equal(R.init(R.NAMES.slice(0,n)).teams.length,n);assert.throws(()=>R.init(['1']));});
run('jawaban salah tetap di tempat, pindah giliran',()=>{
 let s=R.init(['A','B']);let x=R.applyTurn(s,{roll:6,correct:false}); assert.equal(x.state.teams[0].position,0);assert.equal(x.state.current,1);assert.equal(x.state.teams[0].wrong,1);
});
run('jawaban benar maju sesuai dadu',()=>{
 let s=R.init(['A','B']);let {state}=R.applyTurn(s,{roll:2,correct:true});assert.equal(state.teams[0].position,2);assert.equal(state.current,1);assert.equal(s.teams[0].position,0);
});
run('tangga 3 -> 22',()=>{let s=R.init(['A','B']);let x=R.applyTurn(s,{roll:3,correct:true});assert.equal(x.state.teams[0].position,22);assert.ok(x.events.some(e=>e.type==='ladder'));});
run('ular 36 -> 6',()=>{let s=R.init(['A','B']);s.teams[0].position=33;let x=R.applyTurn(s,{roll:3,correct:true});assert.equal(x.state.teams[0].position,6);assert.ok(x.events.some(e=>e.type==='snake'));});
run('tabrakan mengembalikan bidak lama ke 0',()=>{
 let s=R.init(['A','B']);s.teams[0].position=6;s.current=1;let x=R.applyTurn(s,{roll:6,correct:true});assert.equal(x.state.teams[1].position,6);assert.equal(x.state.teams[0].position,0);assert.equal(x.state.teams[0].hits,1);
});
run('tabrakan diperiksa setelah tangga',()=>{
 let s=R.init(['A','B']);s.teams[0].position=22;s.current=1;let x=R.applyTurn(s,{roll:3,correct:true});assert.equal(x.state.teams[1].position,22);assert.equal(x.state.teams[0].position,0);
});
run('tabrakan diperiksa setelah ular',()=>{
 let s=R.init(['A','B']);s.teams[0].position=6;s.teams[1].position=33;s.current=1;let x=R.applyTurn(s,{roll:3,correct:true});assert.equal(x.state.teams[1].position,6);assert.equal(x.state.teams[0].position,0);
});
run('melebihi 100 tetap di posisi lama',()=>{
 let s=R.init(['A','B']);s.teams[0].position=98;let x=R.applyTurn(s,{roll:4,correct:true});assert.equal(x.state.teams[0].position,98);assert.equal(x.state.current,1);assert.ok(x.events.some(e=>e.type==='overshoot'));
});
run('tepat 100 menang dan permainan berakhir',()=>{
 let s=R.init(['A','B']);s.teams[0].position=96;let x=R.applyTurn(s,{roll:4,correct:true});assert.equal(x.state.teams[0].position,100);assert.equal(x.state.winner,0);assert.equal(x.state.finished,true);assert.throws(()=>R.applyTurn(x.state,{roll:2,correct:true}));
});
console.log('Semua tes mesin aturan berhasil.');
run('angka 6 benar: tim sama mendapatkan lempar tambahan',()=>{
 let s=R.init(['A','B']);let a=R.applyTurn(s,{roll:6,correct:true});
 assert.equal(a.state.current,0);assert.equal(a.state.sixStreak,1);assert.equal(a.state.teams[0].position,6);
 assert.ok(a.events.some(e=>e.type==='bonus-six'));
});
run('dua angka 6 berturut-turut boleh bergerak dan lempar lagi',()=>{
 let s=R.init(['A','B']);s=R.applyTurn(s,{roll:6,correct:true}).state;
 s=R.applyTurn(s,{roll:6,correct:true}).state;
 assert.equal(s.teams[0].position,12);assert.equal(s.current,0);assert.equal(s.sixStreak,2);
});
run('angka 6 ketiga hangus: tidak ada soal, tidak maju, tim berikut',()=>{
 let s=R.init(['A','B']);s=R.applyTurn(s,{roll:6,correct:true}).state;
 s=R.applyTurn(s,{roll:6,correct:true}).state;
 const original=s;
 let x=R.forfeitThirdSix(s);
 assert.equal(x.state.teams[0].position,12);assert.equal(x.state.teams[0].correct,2);
 assert.equal(x.state.current,1);assert.equal(x.state.sixStreak,0);
 assert.ok(x.events.some(e=>e.type==='third-six'));
 assert.equal(x.state.history.length,3);assert.equal(x.state.history[2].correct,null);
 assert.equal(original.current,0);assert.equal(original.sixStreak,2);
});
run('pemanggilan applyTurn pada 6 ketiga juga tetap menolak gerakan',()=>{
 let s=R.init(['A','B']);s=R.applyTurn(s,{roll:6,correct:true}).state;
 s=R.applyTurn(s,{roll:6,correct:true}).state;
 const x=R.applyTurn(s,{roll:6,correct:true});
 assert.equal(x.state.teams[0].position,12);assert.equal(x.state.current,1);
});
run('angka 6 salah tidak memberi bonus dan tidak bergerak',()=>{
 let s=R.init(['A','B']);let x=R.applyTurn(s,{roll:6,correct:false});
 assert.equal(x.state.current,1);assert.equal(x.state.sixStreak,0);assert.equal(x.state.teams[0].position,0);
});
run('jawaban salah setelah satu angka 6 membatalkan bonus berikutnya',()=>{
 let s=R.init(['A','B']);s=R.applyTurn(s,{roll:6,correct:true}).state;
 s=R.applyTurn(s,{roll:6,correct:false}).state;
 assert.equal(s.teams[0].position,6);assert.equal(s.current,1);assert.equal(s.sixStreak,0);
});
run('dadu 1–5 mengakhiri bonus setelah urutan 6,6',()=>{
 let s=R.init(['A','B']);s=R.applyTurn(s,{roll:6,correct:true}).state;
 s=R.applyTurn(s,{roll:6,correct:true}).state;
 s=R.applyTurn(s,{roll:4,correct:true}).state;
 assert.equal(s.teams[0].position,16);assert.equal(s.current,1);assert.equal(s.sixStreak,0);
});
run('kesempatan angka 6 baru dapat digunakan lagi pada giliran selanjutnya',()=>{
 let s=R.init(['A','B']);s=R.applyTurn(s,{roll:6,correct:true}).state;
 s=R.applyTurn(s,{roll:1,correct:true}).state;
 s=R.applyTurn(s,{roll:2,correct:false}).state;
 s=R.applyTurn(s,{roll:6,correct:true}).state;
 assert.equal(s.current,0);assert.equal(s.sixStreak,1);
});
