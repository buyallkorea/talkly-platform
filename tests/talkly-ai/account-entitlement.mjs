import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";

const src = await readFile(new URL("../../app/api/talkly-ai/account/route.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("account.ts", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "GET");
assert.ok(fn);
let member = { status:"active", valid_until:null, trial_used_seconds:60, consent_version:"v1" };
let usage = { used_seconds:125 };
let role = "student";
const responses = {
  ai_members: () => ({ data:member, error:null }),
  ai_daily_usage: () => ({ data:usage, error:null }),
  ai_payments: () => ({ data:[], error:null }),
  profiles: () => ({ data:{role}, error:null }),
  ai_monthly_publications: () => ({ data:null, error:null }),
};
const db={ from(table) {
  const q={
    select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},gt(){return this;},
    maybeSingle(){return Promise.resolve(responses[table]());},
    then(resolve,reject){return Promise.resolve(responses[table]()).then(resolve,reject);}
  };
  return q;
}};
class AiError extends Error {constructor(message,status=400){super(message);this.status=status;}}
globalThis.__accountHarness = {
  context:async()=>({user:{id:"test-user",user_metadata:{name:"Learner"}},db}),
  failure:(e)=>Response.json({error:e.message},{status:e.status??500}),
  previewTestMode:()=>false,monthlyReportsEnabled:()=>false,
  summaryRetentionCutoff:()=>new Date().toISOString(),
  seoulDay:()=> "2026-10-27",
  PLAN:{dailySeconds:600},TRIAL_SECONDS:180,CONSENT_VERSION:"v2",
};
const body="const {context,failure,previewTestMode,monthlyReportsEnabled,summaryRetentionCutoff,seoulDay,PLAN,TRIAL_SECONDS,CONSENT_VERSION}=globalThis.__accountHarness;\n"+fn.getText(ast);
const executable=ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
try {
 const {GET}=await import("data:text/javascript;base64,"+Buffer.from(executable).toString("base64"));
 let res=await GET(), account=await res.json();
 assert.equal(res.headers.get("cache-control"),"no-store");
 assert.equal(account.remaining,120,"trial entitlement must decrease from 180 seconds");
 assert.equal(account.trialRemaining,120);
 assert.equal(account.activePass,false);
 assert.equal(account.needsAdultConsent,true);
 member={...member,trial_used_seconds:180};
 res=await GET();account=await res.json();
 assert.equal(account.remaining,0,"trial must not refill after 180 seconds");
 member={...member,valid_until:new Date(Date.now()+86400000).toISOString(),trial_used_seconds:180};
 res=await GET();account=await res.json();
 assert.equal(account.activePass,true);
 assert.equal(account.remaining,475,"paid daily balance must use 600-second allowance");
 usage={used_seconds:600};
 res=await GET();account=await res.json();
 assert.equal(account.remaining,0,"paid daily balance must reach zero");
 member={...member,valid_until:new Date(Date.now()-1000).toISOString()};
 res=await GET();account=await res.json();
 assert.equal(account.activePass,false,"expired pass cannot authorize daily minutes");
 assert.equal(account.remaining,0,"expired pass cannot replenish trial time");
} finally {delete globalThis.__accountHarness;}
console.log("PASS: account trial exhaustion, paid daily limits and expired pass transitions.");
