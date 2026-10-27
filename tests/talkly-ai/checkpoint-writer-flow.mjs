import assert from "node:assert/strict";
import ts from "typescript";
import {readFile} from "node:fs/promises";
const session=await readFile(new URL("../../app/api/talkly-ai/session/route.ts",import.meta.url),"utf8");
const checkpoint=await readFile(new URL("../../app/api/talkly-ai/session/checkpoint/route.ts",import.meta.url),"utf8");
const studio=await readFile(new URL("../../app/talkly-ai/AiStudio.tsx",import.meta.url),"utf8");
const sql=await readFile(new URL("../../supabase/migrations/20261027133000_talkly_ai_checkpoint_ordering.sql",import.meta.url),"utf8");
assert.match(session,/\.update\(\{ checkpoint_writer: data\.writerId \}\)/);
assert.match(session,/\.eq\("state", "connecting"\)/);
assert.match(session,/\.is\("checkpoint_writer", null\)/);
assert.ok(session.indexOf("checkpoint_writer: data.writerId") < session.indexOf('fetch("https://api.openai.com/v1/realtime/calls"'));
assert.match(studio,/writerId: writerId\(\)/);
assert.match(sql,/s\.checkpoint_writer is null or s\.checkpoint_writer <> p_writer/);
const ast=ts.createSourceFile("checkpoint.ts",checkpoint,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="POST");
assert.ok(fn);
class AiError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const failure=e=>Response.json({error:e.message},{status:e.status??500});
const writer="11111111-1111-4111-8111-111111111111";
const sessionId="22222222-2222-4222-8222-222222222222";
const requests=[];
let query;
function db(){
 return {
  from(table){assert.equal(table,"ai_sessions");return {
   select(){return this;},eq(){return this;},
   async single(){return {data:{id:sessionId,started_at:"2026-10-27T01:00:00Z"},error:null};}
  };},
  async rpc(name,args){requests.push({name,args});return {error:null,data:true};}
 };
}
let payload={sessionId,writerId:writer,version:3,turns:[{role:"user",text:"Hello"}]};
const harness={
 body:async()=>payload,
 context:async()=>({user:{id:"33333333-3333-4333-8333-333333333333"},db:db()}),
 cleanTurns:turns=>turns,
 AiError,failure
};
globalThis.__checkpointHarness=harness;
const executable=ts.transpileModule("const {body,context,cleanTurns,AiError,failure}=globalThis.__checkpointHarness;\n"+fn.getText(ast),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const old=process.env.TALKLY_AI_ORDERED_CHECKPOINTS_ENABLED;
try{
 const {POST}=await import("data:text/javascript;base64,"+Buffer.from(executable).toString("base64"));
 process.env.TALKLY_AI_ORDERED_CHECKPOINTS_ENABLED="true";
 const fake=()=>new Request("https://example.invalid",{method:"POST"});
 assert.equal((await POST(fake())).status,200);
 assert.equal(requests.length,1);
 assert.equal(requests[0].name,"ai_checkpoint_ordered");
 assert.equal(requests[0].args.p_writer,writer);
 assert.equal(requests[0].args.p_version,3);
 payload={...payload,writerId:"invalid"};
 assert.equal((await POST(fake())).status,400);
 assert.equal(requests.length,1,"invalid writer must not reach RPC");
 payload={...payload,writerId:writer,version:0};
 assert.equal((await POST(fake())).status,400);
 assert.equal(requests.length,1,"invalid version must not reach RPC");
}finally{
 if(old===undefined)delete process.env.TALKLY_AI_ORDERED_CHECKPOINTS_ENABLED;
 else process.env.TALKLY_AI_ORDERED_CHECKPOINTS_ENABLED=old;
 delete globalThis.__checkpointHarness;
}
console.log("PASS: session binds writer before provider request, checkpoint passes valid writer/version, and rejects invalid payloads.");
