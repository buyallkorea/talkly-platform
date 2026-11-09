const {test}=require('node:test');const assert=require('node:assert/strict');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const {load}=require('./load.cjs');const schema=load('lib/assessments/schema.ts');
test('both replacement forms render document sections and accessible labels without numeric score buttons',()=>{
 const {default:Editor}=load('components/assessments/AssessmentEditor.tsx',{'@/lib/assessments/schema':schema,'next/navigation':{useRouter:()=>({refresh(){}})},'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}});
 for(const kind of ['initial','monthly']){
  const html=renderToStaticMarkup(React.createElement(Editor,{kind,sourceId:1,period:kind==='initial'?'initial':'period-1',initialValues:{studentName:'Example Learner'},initialRevision:0,initialStatus:'draft',administrator:false}));
  assert.match(html,/Example Learner/);assert.match(html,/Save draft/);assert.match(html,/Submit for review/);assert.match(html,/NYO/);
  assert.match(html,/for="assessment-studentName"/);
  assert.doesNotMatch(html,/participationScore|speakingLevel/);
  if(kind==='initial'){assert.match(html,/Primary textbook/);assert.match(html,/Level Test Evaluation/);assert.match(html,/Native language/);assert.match(html,/Focus for first 4 lessons/);assert.match(html,/Responds to greetings/);}else{assert.match(html,/Notes for next instructor/);assert.match(html,/Parent feedback/);assert.match(html,/Success indicator|success indicator/)}
 }
});
test('save handler prevents rapid duplicate saves, preserves edits on uncertain responses and advances only acknowledged revisions',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../components/assessments/AssessmentEditor.tsx'),'utf8');const ast=ts.createSourceFile('editor.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let fn;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='save')fn=n.getText(ast);ts.forEachChild(n,visit)}visit(ast);
 let calls=0,resolveRequest,dirty=true,revision=0,status='draft',conflict=false;const guard={current:false};
 const harness={router:{refresh(){}},guard,conflict:false,values:{studentName:'Still here'},kind:'initial',sourceId:1,period:'initial',revision:0,validateAssessment:schema.validateAssessment,
  setMessage(){},setBusy(){},setRevision(value){revision=value},setStatus(value){status=value},setDirty(value){dirty=value},setConflict(value){conflict=value}};
 const js=ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;return new Promise(resolve=>{resolveRequest=resolve})};
 try{
  const save=new Function(...Object.keys(harness),js+';return save;')(...Object.values(harness));
  const first=save('draft');await save('draft');assert.equal(calls,1);
  resolveRequest(Response.json({success:false}));await first;assert.equal(dirty,true);assert.equal(revision,0);assert.equal(guard.current,false);assert.equal(harness.values.studentName,'Still here');
  const retry=save('draft');resolveRequest(Response.json({success:true,revision:1,status:'draft'}));await retry;assert.equal(dirty,false);assert.equal(revision,1);assert.equal(status,'draft');
  const stale=save('draft');resolveRequest(Response.json({error:'Other edit saved'},{status:409}));await stale;assert.equal(conflict,true);assert.equal(revision,1);
 }finally{globalThis.fetch=original}
});
test('existing review routes and class/level-test forms switch to replacement while legacy completion writes are blocked',()=>{
 const read=p=>fs.readFileSync(path.resolve(__dirname,'../..',p),'utf8');
 for(const file of ['app/teacher/reviews/page.tsx','app/admin/evaluations/page.tsx']){const src=read(file);assert.match(src,/TALKLY_ASSESSMENTS_ENABLED/);assert.match(src,/<AssessmentList/);assert.match(src,/legacy/)}
 assert.match(read('app/teacher/classes/[sessionId]/page.tsx'),/AssessmentEntry kind="monthly"/);
 assert.match(read('app/teacher/level-tests/[id]/LevelTestEvaluationForm.tsx'),/replacementEnabled && \["in_progress", "completed"\]/);
 assert.match(read('app/api/teacher/classes/[sessionId]/final-evaluation/route.ts'),/Use the new monthly observation review/);
 assert.match(read('app/api/teacher/level-tests/[id]/evaluation/route.ts'),/Use the new initial diagnostic assessment/);
});
