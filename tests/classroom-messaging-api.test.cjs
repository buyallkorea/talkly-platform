const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const test = require('node:test');
const teacher = '11111111-1111-4111-8111-111111111111';
const thread = '22222222-2222-4222-8222-222222222222';
function chain(result, calls = []) {
  return new Proxy({}, {get(_, key) {
    if (key === 'then') return resolve => resolve(result);
    return (...args) => { calls.push([key, ...args]); return chain(result, calls); };
  }});
}
function load(file, mocks) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(js, {exports, console, process, Buffer, require(name) {
    if (name === 'next/server') return {NextResponse: {json: (data, opts = {}) => ({status: opts.status ?? 200, data})}};
    if (name in mocks) return mocks[name];
    throw new Error(`Missing mock: ${name}`);
  }});
  return exports;
}
const helpers = {UUID: /^[0-9a-f-]{36}$/i, sameOrigin: r => r.headers.get('origin') === new URL(r.url).origin, validMessage: v => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 5000};
function request(body, origin = 'https://www.talkly.co.kr') {return new Request('https://www.talkly.co.kr/api/teacher-messages', {method: 'POST', headers: {'content-type':'application/json',origin},body:JSON.stringify(body)});}
function routes(actor, admin, detail = false) {
  return load(detail ? 'app/api/teacher-messages/[id]/route.ts' : 'app/api/teacher-messages/route.ts', {
    '@/lib/teacher-messages': {...helpers, messageActor: async () => actor},
    '@/lib/supabase-admin': {createAdminClient: () => admin},
  });
}
test('message creation denies anonymous and teacher authors', async () => {
  for (const actor of [null, {role:'teacher', userId:teacher}]) assert.equal((await routes(actor, {}).POST(request({teacherId:teacher,subject:'Hello',body:'Hi'}))).status,403);
});
test('message mutations reject cross-site requests before database access', async () => {
  assert.equal((await routes(null, {}).POST(request({},'https://evil.example'))).status,403);
});
test('admin creation validates body limits and inactive recipients', async () => {
  const r=routes({role:'admin',userId:'admin'}, {from:()=>chain({data:{is_active:false}})});
  for(const body of ['', ' '.repeat(3), 'x'.repeat(5001)]) assert.equal((await r.POST(request({teacherId:teacher,subject:'Hello',body}))).status,400);
  assert.equal((await r.POST(request({teacherId:teacher,subject:'Hello',body:'Valid'}))).status,400);
});
test('sender identity comes from verified session, ignoring spoofed request fields', async () => {
  let sent;
  const r=routes({role:'admin',userId:'verified-admin'}, {from:()=>chain({data:{is_active:true}}),rpc:async(name,args)=>{sent={name,args};return {data:thread};}});
  const response=await r.POST(request({teacherId:teacher,subject:' Hello ',body:' Valid ',sender:'attacker',p_actor:'attacker'}));
  assert.equal(response.status,201);assert.equal(sent.args.p_actor,'verified-admin');assert.equal(sent.args.p_body,'Valid');assert.equal(sent.args.p_thread,null);
});
test('thread read and reply deny unrelated conversations hidden by RLS', async () => {
  const r=routes({role:'teacher',userId:teacher,db:{from:()=>chain({data:null})}}, {}, true);
  const context={params:Promise.resolve({id:thread})};
  assert.equal((await r.GET(new Request('https://www.talkly.co.kr/api/teacher-messages/'+thread),context)).status,404);
  assert.equal((await r.POST(request({body:'Reply'}),context)).status,404);
});
test('read receipts constrain both thread and recipient direction to returned IDs', async () => {
  const calls=[];
  const r=routes({role:'teacher',userId:teacher,db:{from:()=>chain({data:{id:thread}})}},{from:()=>chain({data:null,error:null},calls)},true);
  assert.equal((await r.POST(request({action:'read',ids:[teacher]}),{params:Promise.resolve({id:thread})})).status,200);
  assert(calls.some(x=>x[0]==='eq'&&x[1]==='thread_id'&&x[2]===thread));
  assert(calls.some(x=>x[0]==='neq'&&x[1]==='sender_role'&&x[2]==='teacher'));
  assert(calls.some(x=>x[0]==='in'&&x[1]==='id'));
});
function selection({role='teacher',verified=false,assigned=true,owner='me',pages=true,active=true}={}) {
  const calls=[];
  const data={profiles:{role},class_sessions:{id:1,enrollment_id:2,teacher_user_id:owner,status:active?'in_progress':'completed',ended_at:null},enrollments:{id:2,teacher_user_id:owner},enrollment_textbooks:assigned?{id:3}:null,textbooks:{id:30},textbook_pages:pages?{id:1}:null};
  const db={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from:table=>chain({data:data[table],error:null},calls)};
  return {calls,...load('app/api/classroom/select-textbook/route.ts',{'@/lib/test-classroom-mode':{verifyTestStudentMode:async()=>verified},'@/lib/supabase-admin':{createAdminClient:()=>db},'@/lib/supabase-server':{createClient:async()=>db}})};
}
test('textbook selection enforces participant, ownership, assignment and rendered pages',async()=>{
  for(const options of [{role:'student'},{role:'admin',verified:false},{owner:'another-teacher'},{assigned:false},{pages:false},{active:false}]){
    const r=selection(options);const result=await r.POST(request({sessionId:1,textbookId:30}));assert(result.status>=400,JSON.stringify(options));
  }
});
test('verified admin test student can assign a rendered book without charging payment',async()=>{
  const r=selection({role:'admin',verified:true,assigned:false});await r.POST(request({sessionId:1,textbookId:30}));
  const insert=r.calls.find(c=>c[0]==='insert');assert(insert);assert.equal(insert[1].payment_required,false);assert.equal(insert[1].enrollment_id,2);
});

test('teacher with conversation history is protected before any account or storage deletion',async()=>{
  const calls=[];
  const userDb={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from:()=>chain({data:{role:'admin'}})};
  const admin={from:table=>{
    calls.push(table);
    if(table==='profiles')return chain({data:{id:teacher,role:'teacher'}});
    if(table==='teacher_profiles')return chain({data:{user_id:teacher}});
    return chain({count:table==='teacher_message_threads'?1:0,error:null});
  },auth:{admin:{getUserById:async()=>({data:{user:{id:teacher}}}),deleteUser:()=>{throw Error('must not delete user');}}},storage:{from:()=>{throw Error('must not delete image');}}};
  const r=load('app/api/admin/teachers/[id]/route.ts',{'@/lib/supabase-server':{createClient:async()=>userDb},'@/lib/supabase-admin':{createAdminClient:()=>admin}});
  const response=await r.DELETE(request({}),{params:Promise.resolve({id:teacher})});
  assert.equal(response.status,409);assert.equal(response.data.code,'TEACHER_HAS_HISTORY');assert(response.data.history.some(item=>item.label==='강사 전달사항'));
});
