import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../../app/api/talkly-ai/test-readiness/route.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true);
const executable=ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n');
let isolated=false,reads=0,clients=0,authCalls=0,dbError=false,authStatus=200;
globalThis.readinessHarness={
 createAdminClient:()=>{clients++;return {from:()=>({select:()=>({limit:n=>{assert.equal(n,0);reads++;return Promise.resolve({data:[],error:dbError?{}:null});}})})};},
 requireIsolatedPreviewWrite:request=>{assert.equal(request.method,'POST');if(!isolated)throw Error('not isolated');},
 fetch:async()=>{authCalls++;return new Response(null,{status:authStatus});},
};
const js=ts.transpileModule('const {createAdminClient,requireIsolatedPreviewWrite,fetch}=globalThis.readinessHarness;\n'+executable,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {GET}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const names=['VERCEL_ENV','TALKLY_AI_TEST_MODE','TALKLY_AI_PAYMENTS_ENABLED','TALKLY_AI_ENABLED','OPENAI_API_KEY','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SOLAPI_API_KEY','SOLAPI_API_SECRET','SOLAPI_SENDER_NUMBER'];
const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));
const call=()=>GET(new Request('https://qa.vercel.app/api/talkly-ai/test-readiness'));
try{
 for(const k of names)delete process.env[k];
 process.env.VERCEL_ENV='production';assert.equal((await call()).status,404);
 process.env.VERCEL_ENV='preview';process.env.TALKLY_AI_TEST_MODE='true';
 assert.equal((await call()).status,404,'payments must explicitly be off');
 process.env.TALKLY_AI_PAYMENTS_ENABLED='false';
 let r=await call();assert.equal(r.status,503);assert.equal((await r.json()).stage,'database_isolation');assert.equal(clients,0);assert.equal(authCalls,0);
 isolated=true;r=await call();assert.equal((await r.json()).stage,'server_configuration');assert.equal(clients,0);
 for(const k of names.filter(k=>!['VERCEL_ENV','TALKLY_AI_TEST_MODE','TALKLY_AI_PAYMENTS_ENABLED'].includes(k)))process.env[k]=k==='TALKLY_AI_ENABLED'?'true':'synthetic-not-a-secret';
 r=await call();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 const result=await r.json();assert.equal(result.signupAndVoiceTest,'not_run');assert.equal(result.providerCalls,false);assert.equal(reads,4);assert.equal(authCalls,1);
 assert.ok(!JSON.stringify(result).includes('synthetic-not-a-secret'));
 dbError=true;r=await call();assert.equal((await r.json()).stage,'database_credentials_or_schema');assert.equal(authCalls,1);
 dbError=false;authStatus=403;r=await call();assert.equal((await r.json()).stage,'dependency_connection');
}finally{
 for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 delete globalThis.readinessHarness;
}
console.log('PASS: Preview-only read-only readiness, fail before DB on missing isolation/config, limit-zero schema checks, auth-key rejection, no secret output or voice/signup success claim');
