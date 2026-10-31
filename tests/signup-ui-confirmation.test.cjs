/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing CommonJS Node test harness. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync('app/signup/page.tsx','utf8');
const ast=ts.createSourceFile('signup.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions={};
function visit(node){
 if(ts.isFunctionDeclaration(node)&&['handleSignup','handleSendVerificationCode'].includes(node.name?.text))functions[node.name.text]=node.getText(ast);
 ts.forEachChild(node,visit);
}
visit(ast);
function harness(result, status=200, role='student'){
 const events=[], requests=[],timers=[];
 const h={
  exports:{}, signupCompleted:false,loading:false,sendingCode:false,resendLocked:false,
  name:'Synthetic QA',email:'qa@example.invalid',phone:'01000000000',password:'test-password',passwordConfirm:'test-password',
  phoneVerified:true,verificationToken:'synthetic-proof',role,safeNextPath:'/talkly-ai',loginHref:'/login?next=%2Ftalkly-ai',
  normalizePhone:v=>v.replace(/[^0-9]/g,''),
  console:{error(){}},
  fetch:async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return Response.json(result,{status});},
  window:{setTimeout:(fn,ms)=>timers.push({fn,ms})},
  router:{replace:path=>events.push(['replace',path]),refresh:()=>events.push(['refresh'])},
 };
 for(const [setter,key] of [['setLoading','loading'],['setSignupCompleted','signupCompleted'],['setSendingCode','sendingCode'],['setPhoneVerified','phoneVerified'],['setVerificationToken','verificationToken'],['setResendLocked','resendLocked']])h[setter]=value=>{h[key]=value;events.push([key,value]);};
 h.setErrorMessage=value=>events.push(['error',value]);
 h.setSuccessMessage=value=>events.push(['success',value]);
 const code=ts.transpileModule(Object.values(functions).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code+';exports.signup=handleSignup;exports.send=handleSendVerificationCode;',h);
 return {h,events,requests,timers,signup:()=>h.exports.signup({preventDefault(){}}),send:()=>h.exports.send()};
}
for(const role of ['student','parent'])test(`${role} signup waits for email confirmation and cannot submit twice`,async()=>{
 const t=harness({ok:true,requiresEmailConfirmation:true,confirmationEmailSent:true},200,role);
 await t.signup();assert.equal(t.requests[0].path,'/api/auth/signup');assert.equal(t.requests[0].body.role,role);
 assert.ok(t.events.some(e=>e[0]==='success'&&e[1].includes('이메일의 인증 링크')));
 assert.equal(t.timers.length,0);assert.equal(t.h.loading,false);assert.equal(t.h.signupCompleted,true);
 await t.signup();await t.send();assert.equal(t.requests.length,1,'created account must not repeat signup or OTP send');
});
test('failed confirmation delivery explains that account exists without navigating',async()=>{
 const t=harness({ok:true,requiresEmailConfirmation:true,confirmationEmailSent:false});await t.signup();
 assert.ok(t.events.some(e=>e[0]==='success'&&e[1].includes('다시 가입하지 말고')));assert.equal(t.timers.length,0);
});
test('already confirmed signup navigates with TALKLY AI next path',async()=>{
 const t=harness({ok:true,requiresEmailConfirmation:false});await t.signup();assert.equal(t.timers.length,1);
 t.timers[0].fn();assert.ok(t.events.some(e=>e[0]==='replace'&&e[1]==='/login?next=%2Ftalkly-ai'));
 assert.ok(!t.events.some(e=>e[0]==='success'&&e[1].includes('레벨테스트')));
});
test('signup errors and malformed success do not claim account creation',async()=>{
 for(const [body,status] of [[{error:'invalid proof'},400],[{},200]]){
  const t=harness(body,status);await t.signup();assert.equal(t.h.signupCompleted,false);assert.equal(t.timers.length,0);
  assert.ok(t.events.some(e=>e[0]==='error'&&e[1]));
 }
});
test('SMS success stays in SMS flow and applies resend cooldown',async()=>{
 const t=harness({ok:true,requiresEmailConfirmation:true,confirmationEmailSent:true});await t.send();
 assert.equal(t.requests[0].path,'/api/auth/phone/send');assert.equal(t.h.resendLocked,true);
 assert.ok(t.events.some(e=>e[0]==='success'&&e[1].includes('인증번호를 발송')));
 assert.ok(!t.events.some(e=>e[0]==='success'&&e[1].includes('회원가입이 완료')));
});
test('malformed SMS success does not start resend cooldown',async()=>{
 const t=harness({});await t.send();assert.equal(t.h.resendLocked,false);assert.equal(t.timers.length,0);assert.ok(t.events.some(e=>e[0]==='error'));
});
test('verification notices appear before password fields',()=>{
 assert.ok(source.indexOf('{errorMessage && (')<source.indexOf('id="password"'));
 assert.ok(source.indexOf('{successMessage && (')<source.indexOf('id="password"'));
});
