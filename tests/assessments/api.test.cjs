const {test}=require('node:test');const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const schema=load('lib/assessments/schema.ts');
const full=kind=>Object.fromEntries(schema.assessmentSections(kind).flatMap(s=>s.fields).map(f=>[f.key,f.type==='multi'?[]:f.type==='select'?f.options[0]:f.type==='date'?'2026-11-01':f.type==='number'?'7':'Observed example']));
test('context rejects students, unauthenticated calls, cross-origin and production-backed preview writes',async()=>{
 let role='student',signedIn=true;
 const server=load('lib/assessments/server.ts',{
  '@/lib/supabase-server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:signedIn?{id:'teacher'}:null},error:null})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{role},error:null})})})},
  '@/lib/supabase-admin':{createAdminClient:()=>({})},
 });
 const old={...process.env};
 try{
  process.env.TALKLY_ASSESSMENTS_ENABLED='true';delete process.env.VERCEL_ENV;
  await assert.rejects(()=>server.assessmentContext(),e=>e.status===403);
  role='teacher';signedIn=false;await assert.rejects(()=>server.assessmentContext(),e=>e.status===401);
  signedIn=true;
  const req=(origin)=>new Request('https://test.example/api/assessments/initial/1',{method:'PUT',headers:{origin}});
  await assert.rejects(()=>server.assessmentContext(req('https://evil.example')),e=>e.status===403);
  process.env.VERCEL_ENV='preview';process.env.TALKLY_ASSESSMENTS_PREVIEW_DB_REF='nvotgdovtxfzvmrrhxge';process.env.NEXT_PUBLIC_SUPABASE_URL='https://nvotgdovtxfzvmrrhxge.supabase.co';
  await assert.rejects(()=>server.assessmentContext(req('https://test.example')),e=>e.status===503);
  process.env.TALKLY_ASSESSMENTS_PREVIEW_DB_REF='eakgtjoqumqfmiojlgjd';process.env.NEXT_PUBLIC_SUPABASE_URL='https://eakgtjoqumqfmiojlgjd.supabase.co';
  assert.equal((await server.assessmentContext(req('https://test.example'))).role,'teacher');
 }finally{for(const k of ['TALKLY_ASSESSMENTS_ENABLED','VERCEL_ENV','TALKLY_ASSESSMENTS_PREVIEW_DB_REF','NEXT_PUBLIC_SUPABASE_URL']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}}
});
test('source ownership is checked before learner details are read',async()=>{
 const server=load('lib/assessments/server.ts',{'@/lib/supabase-server':{},'@/lib/supabase-admin':{}});
 let reads=0;
 const db={from(table){reads++;assert.equal(table,'enrollments');return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:1,teacher_user_id:'other',is_test:false},error:null})}}};
 await assert.rejects(()=>server.assessmentSource({db,user:{id:'teacher'},role:'teacher'},'monthly',1),e=>e.status===404);
 assert.equal(reads,1);
});
test('save validates submissions, reports revision conflict, and never sends client-supplied actor identity',async()=>{
 const {AssessmentError,assessmentFailure}=load('lib/assessments/server.ts',{'@/lib/supabase-server':{},'@/lib/supabase-admin':{}});
 let error=null,calls=0,args;
 const {PUT}=load('app/api/assessments/[kind]/[sourceId]/route.ts',{
  '@/lib/assessments/schema':schema,
  '@/lib/assessments/server':{AssessmentError,assessmentFailure,assessmentContext:async()=>({user:{id:'server-actor'},db:{rpc:async(name,value)=>{calls++;args=value;return {data:error?null:{revision:1,status:'draft',updated_at:'2026-11-01'},error}}}}),assessmentSource:async()=>({started_at:'2026-11-01',status:'in_progress'}),progressPeriod:async()=>({from:'2026-11-01',to:'2026-11-28'})},
 });
 const request=async(kind,body)=>PUT(new Request('https://test.example/api/assessments/'+kind+'/1',{method:'PUT',body:JSON.stringify(body)}),{params:Promise.resolve({kind,sourceId:'1'})});
 assert.equal((await request('initial',{status:'submitted',revision:0,period:'initial',values:{}})).status,400);assert.equal(calls,0);
 assert.equal((await request('monthly',{status:'draft',revision:0,period:'period-1',values:{reviewFrom:'2026-10-01'}})).status,400);
 const response=await request('initial',{status:'draft',revision:0,period:'initial',values:{},actor:'forged'});
 assert.equal(response.status,200);assert.equal(args.p_actor,'server-actor');assert.equal((await response.json()).success,true);
 assert.equal((await request('initial',{status:'submitted',revision:1,period:'initial',values:full('initial')})).status,200);
 error={message:'ASSESSMENT_CONFLICT'};
 assert.equal((await request('initial',{status:'draft',revision:0,period:'initial',values:{}})).status,409);
});
test('progress reviews keep the existing four-week / final schedule and reject premature or invented periods',async()=>{
 const server=load('lib/assessments/server.ts',{'@/lib/supabase-server':{},'@/lib/supabase-admin':{}});
 let completed=false;
 const db={from(table){const q={select(){return q},eq(){return q},in(){return q},limit(){return q},
  maybeSingle:async()=>({data:table==='enrollments'?{id:1,teacher_user_id:'teacher',is_test:false,start_date:'2026-10-01',total_lessons:20}:table==='courses'?{name:'English'}:null,error:null}),
  then(resolve,reject){return Promise.resolve({data:table==='class_sessions'?[{id:11,enrollment_id:1,lesson_number:5,scheduled_start:'2026-10-29T01:00:00Z',status:completed?'completed':'scheduled'}]:[],error:null}).then(resolve,reject)}};return q}};
 const ctx={db,user:{id:'teacher'},role:'teacher'};
 await assert.rejects(()=>server.progressPeriod(ctx,1,'period-1'),e=>e.status===409);
 completed=true;
 const period=await server.progressPeriod(ctx,1,'period-1');
 assert.equal(period.from,'2026-10-01');assert.equal(period.to,'2026-10-28');
 await assert.rejects(()=>server.progressPeriod(ctx,1,'period-2'),e=>e.status===409);
 await assert.rejects(()=>server.progressPeriod(ctx,1,'final'),e=>e.status===409);
});
