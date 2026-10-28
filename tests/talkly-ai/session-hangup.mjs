import assert from "node:assert/strict";
import ts from "typescript";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../../lib/talkly-ai/session.ts",import.meta.url),"utf8");
const ast=ts.createSourceFile("session.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="closeSession");
assert.ok(fn,"closeSession must exist");
let mode="hangup-fails",finishes=0,hangups=0,begin=0;
let sessionState="closing",callId="test-call",beginError=null,finishError=null,lastFailed=null;
const fakeDb={
 rpc(name,args){
  if(name==="ai_begin_close"){
   begin++;
   return {abortSignal:async()=>({data:beginError?null:{state:sessionState,call_id:callId},error:beginError})};
  }
  if(name==="ai_finish"){
   finishes++;
   lastFailed=args.p_failed;
   return {abortSignal:async()=>({error:finishError})};
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
 // An already closed session must not issue a second provider hangup.
 sessionState="closed";callId="test-call";
 await closeSession("user","session");
 assert.equal(hangups,2,"closed session must not hang up twice");
 assert.equal(lastFailed,false);
 // A reservation without a provider call must be marked failed for settlement.
 sessionState="closing";callId=null;
 await closeSession("user","session");
 assert.equal(lastFailed,true,"call-less reservation must be marked failed");
 assert.equal(hangups,2);
 // A provider call that cannot be stopped must never be marked failed/refunded,
 // even if the upstream negotiation itself had already failed.
 sessionState="connecting";callId="rtc_live";mode="hangup-fails";
 const noRefundBefore=finishes;
 await assert.rejects(()=>closeSession("user","session",true),/provider unavailable/);
 assert.equal(finishes,noRefundBefore,"failed hangup must preserve reserved time");
 mode="success";
 await closeSession("user","session");
 assert.equal(lastFailed,false,"registered live calls settle according to actual usage");
 sessionState="closing";callId=null;
 // Database begin/finish errors must not be treated as successful settlement.
 const hangupsBeforeDbFailure=hangups;
 beginError={message:"offline"};
 await assert.rejects(()=>closeSession("user","session"),/Session not found/);
 assert.equal(hangups,hangupsBeforeDbFailure);
 beginError=null;
 finishError={message:"offline"};
 await assert.rejects(()=>closeSession("user","session"),e=>e?.message==="offline");
 finishError=null;
 // A successful retry after a DB settlement error must settle rather than silently succeed.
 callId="test-call";sessionState="closing";
 const beforeRetry=finishes;
 await closeSession("user","session");
 assert.equal(finishes,beforeRetry+1);
 assert.equal(lastFailed,false);
 // A failed close request with no registered provider call must never invoke hangup.
 callId=null;mode="hangup-fails";
 const beforeCalllessHangups=hangups;
 await closeSession("user","session",true);
 assert.equal(hangups,beforeCalllessHangups);
 assert.equal(lastFailed,true);
 // Passing failed=true must propagate to the database even for a registered call.
 mode="success";callId="test-call";
 await closeSession("user","session",true);
 assert.equal(lastFailed,true);
}finally{delete globalThis.__sessionHarness;}
console.log("PASS: failed provider hangup retains reservation; successful retry settles only after hangup.");
