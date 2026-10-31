import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../app/admin/talkly-ai/SessionOperations.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('ui.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let fn;
function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='stop')fn=n.getText(ast);ts.forEachChild(n,visit)}visit(ast);
let requests=0,refreshes=0,resolveRequest,message='',selected='session-a';
const closed=new Set(),guard={current:false};
globalThis.__adminStop={guard,reason:'connection_issue',setBusy(){},setMessage(v){message=v},setSelected(v){selected=v},setClosed(update){for(const id of update(closed))closed.add(id)},router:{refresh(){refreshes++}}};
const js=ts.transpileModule('const {'+Object.keys(globalThis.__adminStop).join(',')+'}=globalThis.__adminStop;export '+fn,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const originalFetch=globalThis.fetch;
try{
 const {stop}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 globalThis.fetch=async()=>{requests++;return new Promise(resolve=>{resolveRequest=resolve})};
 const first=stop({id:'session-a'});
 await stop({id:'session-a'});
 assert.equal(requests,1,'rapid duplicate clicks must issue one stop request');
 resolveRequest(Response.json({success:false}));await first;
 assert.equal(closed.size,0);assert.equal(selected,'session-a');assert.equal(refreshes,0);
 assert.equal(guard.current,false,'failed result must permit retry');
 assert.match(message,/확인하지 못했어요/);
 for(const result of [null,{}, {success:'true'}]){
  const pending=stop({id:'session-a'});resolveRequest(Response.json(result));await pending;
  assert.equal(closed.size,0);assert.equal(refreshes,0);
 }
 const retry=stop({id:'session-a'});
 resolveRequest(Response.json({success:true,auditRecorded:false}));await retry;
 assert.ok(closed.has('session-a'));assert.equal(refreshes,1);assert.equal(selected,null);
 assert.match(message,/이력 갱신을 확인하지 못했습니다/);
 assert.equal(guard.current,false);
}finally{globalThis.fetch=originalFetch;delete globalThis.__adminStop}
console.log('PASS: admin close prevents concurrent clicks and hides a session only after explicit settlement success.');
