import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source=await readFile(new URL("../../app/api/talkly-ai/admin/refund-audit/route.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../../supabase/migrations/20261026113000_talkly_ai_refund_audit.sql",import.meta.url),"utf8");
const client=await readFile(new URL("../../app/admin/talkly-ai/RefundReviews.tsx",import.meta.url),"utf8");
const page=await readFile(new URL("../../app/admin/talkly-ai/page.tsx",import.meta.url),"utf8");
class AiError extends Error {constructor(message,status=400){super(message);this.status=status;}}
let role="student",count=0;
const id="11111111-1111-4111-8111-111111111111";
const db={from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:{role},error:null}}}},async rpc(){count++;return {data:id,error:null}}};
globalThis.__refundTest={AiError,body:async()=>({requestId:id,eventKey:id,eventType:"provider_checked",note:"Reviewed"}),context:async()=>({user:{id},db}),failure:e=>Response.json({error:e.message},{status:e.status||500})};
const ast=ts.createSourceFile("route.ts",source,ts.ScriptTarget.Latest,true);
const code="const {AiError,body,context,failure}=globalThis.__refundTest;\n"+ast.statements.filter(x=>!ts.isImportDeclaration(x)).map(x=>x.getText(ast)).join("\n");
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {POST}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
try{
 assert.equal((await POST(new Request("https://example.invalid",{method:"POST"}))).status,403);
 assert.equal(count,0);
 role="admin";
 const result=await POST(new Request("https://example.invalid",{method:"POST"}));
 assert.equal(result.status,200);
 assert.equal(count,1);
 assert.match(migration,/event_key uuid not null unique/);
 assert.match(migration,/on conflict\(event_key\) do nothing/);
 assert.match(migration,/IDEMPOTENCY_CONFLICT/);
 assert.match(migration,/actor_id is distinct from p_actor/);
 assert.match(migration,/request_id is distinct from p_request/);
 assert.match(migration,/revoke all on function public\.ai_record_refund_audit/);
 assert.match(client,/pendingAudit\.current\[row\.id\] \?\?/);
 assert.match(client,/const filtered = rows\.filter/);
 assert.match(client,/stateFilter === "all"/);
 assert.match(client,/filtered\.map\(\(row\)/);
 assert.match(client,/eventKey: entry\.eventKey/);
 assert.match(client,/delete pendingAudit\.current\[row\.id\]/);
 assert.match(page,/환불 요청별 정산 감사 이력/);
 assert.match(page,/log\.request_id === request\.id/);
 console.log("PASS: admin-only refund audit API; replay/conflict guard SQL and grouped admin display present.");
}finally{delete globalThis.__refundTest;}
