import assert from "node:assert/strict";
import ts from "typescript";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../../lib/talkly-ai/session.ts",import.meta.url),"utf8");
const ast=ts.createSourceFile("session.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="closeSession");
assert.ok(fn,"closeSession must exist");
let mode="hangup-fails",finishes=0,hangups=0,begin=0;
const fakeDb={
 rpc(name,args){
  if(name==="ai_begin_close"){
   begin++;
   return {abortSignal:async()=>({data:{state:"closing",call_id:"test-call"},error:null})};
  }
  if(name==="ai_finish"){
   finishes++;
   assert.equal(args.p_failed,false);
   return {abortSignal:async()=>({error:null})};
  }
  throw Error("unexpected RPC");
 }
};
const createAdminClient=()=>fakeDb;
const hangup=async()=>{hangups++;if(mode==="hangup-fails")throw Error("provider unavailable");};
const js=ts.transpileModule("const {createAdminClient,hangup}=globalThis.__sessionHarness;\n"+fn.getText(ast),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
globalThis.__sessionHarness={createAdminClient,hangup};
try{
 const {closeSession}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
 await assert.rejects(()=>closeSession("user","session"),/provider unavailable/);
 assert.equal(finishes,0,"failed provider hangup must not release reserved time");
 mode="success";
 await closeSession("user","session");
 assert.equal(finishes,1,"verified retry settles once");
 assert.equal(hangups,2);
 assert.equal(begin,2);
}finally{delete globalThis.__sessionHarness;}
console.log("PASS: failed provider hangup retains reservation; successful retry settles only after hangup.");
