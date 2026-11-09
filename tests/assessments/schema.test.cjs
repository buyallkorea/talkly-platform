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
 assert.equal(assessmentSections('initial').length,6);assert.equal(assessmentSections('monthly').length,6);
 assert.equal(RATINGS.length,4);
});
test('reject malformed data, unknown fields, invalid ratings, oversized text, impossible dates and backwards periods',()=>{
 for(const value of [null,[],42])assert.throws(()=>validateAssessment('initial',value,'draft'));
 for(const value of [{studentName:[]},{unexpected:'x'},{skill0Rating:'10'},{goals:['Other','Other']},{goals:['invented']},{age:'7.5'},{age:'121'},{assessmentDate:'2026-02-30'},{bookReason:'x'.repeat(2001)}])assert.throws(()=>validateAssessment('initial',value,'draft'));
 assert.throws(()=>validateAssessment('monthly',{reviewFrom:'2026-11-30',reviewTo:'2026-11-01'},'draft'));
 assert.equal(validMonth('2026-13'),false);assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2028-02-29'),true);
});

test('2026-11-09 source document maps to six initial evaluation sections without changing monthly forms',()=>{
 const sections=assessmentSections('initial');
 assert.deepEqual(sections.map(section=>section.title),[
  '01 · Student & assessment information',
  '02 · Skill evaluation',
  '03 · Learner response & engagement',
  '04 · Level placement',
  '05 · Textbook recommendation — primary decision',
  '06 · Instructor summary & follow-up',
 ]);
 const fields=new Map(sections.flatMap(section=>section.fields).map(field=>[field.key,field]));
 for(const key of ['nativeLanguage','connectionQuality','exposureDetails','guardianPresent',
  'interaction','interactionExample','supportExample','feedbackExample','attentionExample','cameraExample',
  'estimatedCEFR','levelVsAge','placementConfidence','reassessmentLessons','textbookStartingLevel',
  'bookFitOther','keyStrengths','growthAreas','firstFourLesson1','firstFourLesson2','firstFourLesson3','instructorHandover'])assert.ok(fields.has(key),key);
 assert.deepEqual(fields.get('startingLevel').options,['Grade K','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Adult']);
 assert.deepEqual(fields.get('connectionQuality').options,['Stable','Minor issues','Unstable']);
 assert.deepEqual(fields.get('guardianPresent').options,['Yes, assisted during session','Yes, observed only','No']);
 assert.deepEqual(fields.get('estimatedCEFR').options,['Pre-A1','A1','A2','B1','B2 or above']);
 assert.ok(fields.get('support').options.includes('Gesture'));
 assert.equal(fields.get('skill6Rating').label,'Early literacy (age-appropriate)');
 assert.match(fields.get('skill6Rating').hint,/age-appropriate/);
 assert.match(fields.get('skill0Rating').hint,/greetings/);
 assert.equal(fields.get('participation').type,'multi');
 assert.equal(fields.get('interaction').type,'multi');
 assert.equal(assessmentSections('monthly').length,6);
 assert.doesNotThrow(()=>validateAssessment('initial',full('initial'),'submitted'));
 assert.throws(()=>validateAssessment('initial',{startingLevel:'Grade 11'},'draft'),/Invalid Suggested starting level/);
});
