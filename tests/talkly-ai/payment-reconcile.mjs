import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../../app/api/talkly-ai/admin/payment-reconcile/route.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
const executable = ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast)).join("\n");
class AiError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
let role="admin", providerStatus="DONE", externalCalls=0;
const order={id:"order",order_id:"TALKLYAI-test",payment_key:"pay_test",amount:13900,status:"paid",activated_until:"2026-12-01T00:00:00Z",approved_at:"2026-10-26T00:00:00Z"};
const db={from(table) {return {select(){return this},eq(){return this},async maybeSingle(){return table==="profiles"?{data:{role},error:null}:{data:order,error:null}}};}};
globalThis.__paymentHarness={AiError, context:async()=>({user:{id:"admin"},db}), failure:(e)=>Response.json({error:e.message},{status:e.status||500})};
const js=ts.transpileModule("const { AiError, context, failure } = globalThis.__paymentHarness;\n"+executable,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {GET}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const originalFetch=globalThis.fetch, oldSecret=process.env.TOSS_SECRET_KEY;
try {
  process.env.TOSS_SECRET_KEY="test-only";
  globalThis.fetch=async()=>{externalCalls++;return Response.json({status:providerStatus,orderId:order.order_id,paymentKey:order.payment_key,totalAmount:order.amount,currency:"KRW"});};
  const request=(id)=>new Request("https://example.com/api/talkly-ai/admin/payment-reconcile?orderId="+id);
  role="student";
  assert.equal((await GET(request(order.order_id))).status,403);
  assert.equal(externalCalls,0);
  role="admin";
  assert.equal((await GET(request("bad"))).status,400);
  let r=await GET(request(order.order_id));
  assert.equal(r.status,200);
  assert.equal((await r.json()).requiresReview,false);
  providerStatus="CANCELED";
  r=await GET(request(order.order_id));
  assert.equal((await r.json()).requiresReview,true);
  assert.doesNotMatch(source,/\.update\(|\.delete\(|\.insert\(|\/cancel/);
  console.log("PASS: admin-only Toss read-only reconciliation flags status mismatch and rejects unauthorized requests.");
} finally {
  globalThis.fetch=originalFetch;
  if(oldSecret===undefined)delete process.env.TOSS_SECRET_KEY;else process.env.TOSS_SECRET_KEY=oldSecret;
  delete globalThis.__paymentHarness;
}
