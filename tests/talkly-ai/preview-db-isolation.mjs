import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../../lib/talkly-ai/server.ts",import.meta.url),"utf8");
const ast = ts.createSourceFile("server.ts",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const fn = ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==="requireIsolatedPreviewWrite");
assert.ok(fn);
class AiError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const js=ts.transpileModule("const AiError=globalThis.__previewAiError;\n"+fn.getText(ast),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
globalThis.__previewAiError=AiError;
const old = Object.fromEntries(["VERCEL_ENV","TALKLY_AI_PREVIEW_DB_PROJECT_REF","TALKLY_AI_PRODUCTION_DB_PROJECT_REF","NEXT_PUBLIC_SUPABASE_URL","TALKLY_AI_PREVIEW_AUTH_ISSUER"].map(k=>[k,process.env[k]]));
try {
 const { requireIsolatedPreviewWrite:guard } = await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
 const request=(method)=>new Request("https://example.invalid",{method});
 const production="aaaaaaaaaaaaaaaaaaaa", preview="bbbbbbbbbbbbbbbbbbbb";
 process.env.VERCEL_ENV="preview";
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://"+production+".supabase.co";
 delete process.env.TALKLY_AI_PREVIEW_DB_PROJECT_REF;
 delete process.env.TALKLY_AI_PRODUCTION_DB_PROJECT_REF;
 assert.throws(()=>guard(request("POST")),e=>e.status===503);
 guard(request("GET"));
 process.env.TALKLY_AI_PREVIEW_DB_PROJECT_REF=production;
 process.env.TALKLY_AI_PRODUCTION_DB_PROJECT_REF=production;
 assert.throws(()=>guard(request("POST")),e=>e.status===503,"same production and preview project must be blocked");
 process.env.TALKLY_AI_PREVIEW_DB_PROJECT_REF=preview;
 assert.throws(()=>guard(request("POST")),e=>e.status===503,"shared production URL must be blocked");
 process.env.NEXT_PUBLIC_SUPABASE_URL="not-a-url";
 assert.throws(()=>guard(request("POST")),e=>e.status===503);
 process.env.NEXT_PUBLIC_SUPABASE_URL="http://"+preview+".supabase.co";
 assert.throws(()=>guard(request("POST")),e=>e.status===503,"HTTP must not be accepted for Preview database");
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://"+preview+".supabase.co";
 assert.throws(()=>guard(request("POST")),e=>e.status===503,"missing auth issuer must block");
 process.env.TALKLY_AI_PREVIEW_AUTH_ISSUER="https://"+production+".supabase.co/auth/v1";
 assert.throws(()=>guard(request("POST")),e=>e.status===503,"production auth issuer must block");
 process.env.TALKLY_AI_PREVIEW_AUTH_ISSUER="https://"+preview+".supabase.co/auth/v1";
 guard(request("POST"));
 guard(request("PATCH"));
 process.env.VERCEL_ENV="production";
 delete process.env.TALKLY_AI_PREVIEW_DB_PROJECT_REF;
 delete process.env.TALKLY_AI_PRODUCTION_DB_PROJECT_REF;
 guard(request("POST"));
}finally{
 for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 delete globalThis.__previewAiError;
}
const [admin, serverClient] = await Promise.all([
 readFile(new URL("../../lib/supabase-admin.ts", import.meta.url),"utf8"),
 readFile(new URL("../../lib/supabase-server.ts", import.meta.url),"utf8")
]);
assert.match(admin, /const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL/);
assert.match(serverClient, /process.env.NEXT_PUBLIC_SUPABASE_URL!/);
assert.match(admin, /process.env.SUPABASE_SERVICE_ROLE_KEY/);
assert.match(serverClient, /process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!/);
console.log("PASS: Preview AI writes blocked until explicit distinct database refs match the configured Preview URL.");
