/* Pengujian data demo semua kelas dan mapel pada V1.3. Jalankan: node tests/questions.test.cjs */
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
require(path.join(root,'js/catalog.js'));
require(path.join(root,'js/questions.js'));
require(path.join(root,'js/questions-expanded.js'));
const all=[...globalThis.SLDemoQuestions,...globalThis.SLExpansionQuestions];
assert.equal(all.length,426);
assert.equal(globalThis.SLDemoQuestions.length,57);
assert.equal(globalThis.SLExpansionQuestions.length,369);
const ids=new Set();
for(const q of all){
  assert(!ids.has(q.id),`ID duplikat: ${q.id}`);ids.add(q.id);
  assert(q.question.trim().length>=5);
  assert.equal(q.choices.length,4);
  assert.equal(new Set(q.choices).size,4);
  assert(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<=3);
  assert(q.choices[q.answer]);
}
let combos=0;
for(const level of ['SD','SMP','SMA']){
  for(const grade of globalThis.SLCatalog.GRADES[level]){
    for(const subject of globalThis.SLCatalog.SUBJECTS[level]){
      const matched=all.filter(q=>q.level===level&&q.grade===grade&&q.subject===subject);
      assert(matched.length>=3,`Kurang 3 soal: ${level} kelas ${grade}: ${subject}`);
      combos++;
    }
  }
}
assert.equal(combos,123);
console.log('PASS 426 soal DEMO, 123 kombinasi kelas/mapel, semua pertanyaan valid.');
