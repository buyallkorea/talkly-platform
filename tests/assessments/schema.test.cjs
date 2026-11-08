const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const {assessmentSections,validateAssessment,validMonth,validDate,RATINGS}=load('lib/assessments/schema.ts');
function full(kind){return Object.fromEntries(assessmentSections(kind).flatMap(s=>s.fields).map(f=>[f.key,f.type==='multi'?[]:f.type==='select'?f.options[0]:f.type==='date'?'2026-11-01':f.type==='number'?'7':'Observed example']));}
module.exports={full};
test('both document forms accept complete observations, retain all major sections and allow partial drafts',()=>{
 for(const kind of ['initial','monthly']) {
  assert.ok(Object.keys(validateAssessment(kind,full(kind),'submitted')).length>30);
  assert.doesNotThrow(()=>validateAssessment(kind,{},'draft'));
  assert.throws(()=>validateAssessment(kind,{},'submitted'),/Please complete/);
 }
 assert.equal(assessmentSections('initial').length,5);assert.equal(assessmentSections('monthly').length,6);
 assert.equal(RATINGS.length,4);
});
test('reject malformed data, unknown fields, invalid ratings, oversized text, impossible dates and backwards periods',()=>{
 for(const value of [null,[],42])assert.throws(()=>validateAssessment('initial',value,'draft'));
 for(const value of [{studentName:[]},{unexpected:'x'},{skill0Rating:'10'},{goals:['Other','Other']},{goals:['invented']},{age:'7.5'},{age:'121'},{assessmentDate:'2026-02-30'},{bookReason:'x'.repeat(2001)}])assert.throws(()=>validateAssessment('initial',value,'draft'));
 assert.throws(()=>validateAssessment('monthly',{reviewFrom:'2026-11-30',reviewTo:'2026-11-01'},'draft'));
 assert.equal(validMonth('2026-13'),false);assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2028-02-29'),true);
});
