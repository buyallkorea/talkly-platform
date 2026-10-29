/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing CommonJS Node test harness. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
function compile(file,env={},modules={}){
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,URL,process:{env},require:name=>{assert.ok(modules[name],name);return modules[name];}});
 return exports;
}
const safe=compile('lib/safe-next-path.ts');
const redirect=env=>compile('lib/auth/signup-redirect.ts',env,{'@/lib/safe-next-path':safe}).signupConfirmationRedirect;
test('production confirmation stays on TALKLY and preserves safe AI next path',()=>{
 assert.equal(redirect({VERCEL_ENV:'production'})('/talkly-ai'),'https://www.talkly.co.kr/login?next=%2Ftalkly-ai');
 assert.equal(redirect({VERCEL_ENV:'production'})('/parent/children/new'),'https://www.talkly.co.kr/login?next=%2Fparent%2Fchildren%2Fnew');
});
test('Preview confirmation stays on stable branch URL instead of production',()=>{
 assert.equal(redirect({VERCEL_ENV:'preview',VERCEL_BRANCH_URL:'talkly-git-qa-team.vercel.app',VERCEL_URL:'talkly-hash-team.vercel.app'})('/talkly-ai'),'https://talkly-git-qa-team.vercel.app/login?next=%2Ftalkly-ai');
 assert.equal(redirect({VERCEL_ENV:'preview',VERCEL_URL:'talkly-hash-team.vercel.app'})(null),'https://talkly-hash-team.vercel.app/login');
});
test('untrusted external next paths are discarded',()=>{
 for(const next of ['//evil.invalid','/\\evil.invalid','https://evil.invalid','/\n/evil.invalid',{},null]){
  assert.equal(redirect({})(next),'https://www.talkly.co.kr/login');
 }
});
test('Preview host must be a platform hostname with no URL injection',()=>{
 for(const host of [undefined,'www.talkly.co.kr','evil.invalid','trusted.vercel.app@evil.invalid','trusted.vercel.app/path','trusted.vercel.app:443','https://trusted.vercel.app']){
  assert.throws(()=>redirect({VERCEL_ENV:'preview',VERCEL_BRANCH_URL:host})(null),/Preview confirmation host/);
 }
});
