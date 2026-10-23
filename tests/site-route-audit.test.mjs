import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import * as react from 'react/jsx-runtime';
function chain(data, calls=[], options={}){let single=false,method='select';const proxy=new Proxy({},{get(_,key){if(key==='then')return resolve=>resolve({data:options.result?options.result({single,method}):data,error:null});return (...args)=>{calls.push([key,...args]);if(key==='maybeSingle'||key==='single')single=true;if(['insert','update','upsert'].includes(key))method=key;return proxy;};}});return proxy;}
function load(file,mocks={}){const exports={};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(js,{exports,console,process,Date,Intl,require(name){if(name==='react/jsx-runtime')return react;if(name==='next/server')return {NextResponse:{json:(data,opts={})=>({status:opts.status??200,data})}};if(name==='next/navigation')return {redirect:url=>{throw Error('redirect:'+url);},notFound:()=>{throw Error('not-found');}};if(name in mocks)return mocks[name];return {default:()=>null};}});return exports;}
function walk(element,fn){if(!element||typeof element!=='object')return;if(fn(element))return element;for(const child of [element.props?.children].flat(Infinity)){const result=walk(child,fn);if(result)return result;}}
function dbFor(role,target=true){const calls=[];return {calls,auth:{getUser:async()=>({data:{user:{id:'viewer'}}})},from(table){let data=table==='profiles'?{id:'teacher',role,name:'Teacher'}:table==='teacher_profiles'?{user_id:'teacher',display_name:'Jennifer'}:null;return chain(target?data:table==='profiles'?{role}:null,calls);}};}
test('teacher editor reads login email from Auth after admin authorization',async()=>{
 const db=dbFor('admin');let lookups=0;
 const page=load('app/admin/teachers/[id]/edit/page.tsx',{'@/lib/supabase-server':{createClient:async()=>db},'@/lib/supabase-admin':{createAdminClient:()=>({auth:{admin:{getUserById:async id=>{lookups++;assert.equal(id,'teacher');return {data:{user:{email:'teacher@example.test'}}};}}}})}});
 const element=await page.default({params:Promise.resolve({id:'teacher'})});const form=walk(element,e=>e.props?.profile);assert.equal(form.props.profile.email,'teacher@example.test');assert.equal(lookups,1);
});
test('non-admin editor cannot resolve another account email',async()=>{
 const db=dbFor('teacher');const page=load('app/admin/teachers/[id]/edit/page.tsx',{'@/lib/supabase-server':{createClient:async()=>db},'@/lib/supabase-admin':{createAdminClient:()=>{throw Error('privileged client must not be created');}}});
 await assert.rejects(page.default({params:Promise.resolve({id:'teacher'})}),/redirect:\//);
});
function patch(role='admin',email='before@example.test'){
 let updates=[];const db=dbFor(role);const admin={from:()=>chain({id:'teacher',role:'teacher'},db.calls),auth:{admin:{getUserById:async()=>({data:{user:{email}}}),updateUserById:async(id,value)=>{updates.push({id,value});return {error:null};}}}};
 return {...load('app/api/admin/teachers/[id]/route.ts',{'@/lib/supabase-server':{createClient:async()=>db},'@/lib/supabase-admin':{createAdminClient:()=>admin}}),updates,calls:db.calls};
}
const request=body=>new Request('https://www.talkly.co.kr/api/admin/teachers/teacher',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('teacher email change updates Auth successfully without a nonexistent profile mirror',async()=>{
 const route=patch();const response=await route.PATCH(request({email:'AFTER@example.test'}),{params:Promise.resolve({id:'teacher'})});assert.equal(response.status,200);assert.equal(route.updates.length,1);assert.equal(route.updates[0].value.email,'after@example.test');assert(!route.calls.some(c=>c[0]==='update'));
});
test('unchanged email is idempotent and non-admin change is denied',async()=>{
 const route=patch();assert.equal((await route.PATCH(request({email:'before@example.test'}),{params:Promise.resolve({id:'teacher'})})).status,200);assert.equal(route.updates.length,0);
 const unauthorized=patch('student');assert.equal((await unauthorized.PATCH(request({email:'after@example.test'}),{params:Promise.resolve({id:'teacher'})})).status,403);assert.equal(unauthorized.updates.length,0);
});
test('linked child email is available only after active-child ownership lookup',async()=>{
 for(const owned of [true,false]){let lookups=0;const calls=[];const db={auth:{getUser:async()=>({data:{user:{id:'parent'}}})},from:table=>chain(table==='profiles'?{role:'parent'}:owned?{id:1,name:'Child',student_user_id:'student'}:null,calls)};
 const page=load('app/parent/children/[id]/page.tsx',{'@/lib/supabase-server':{createClient:async()=>db},'@/lib/supabase-admin':{createAdminClient:()=>({auth:{admin:{getUserById:async()=>{lookups++;return {data:{user:{email:'student@example.test'}}};}}}})},'@/lib/parent/get-enrollment-progress':{getEnrollmentProgress:async()=>null}});
 if(owned){const element=await page.default({params:Promise.resolve({id:'1'})});assert(walk(element,e=>e.props?.studentEmail==='student@example.test'));assert.equal(lookups,1);assert(calls.some(c=>c[0]==='eq'&&c[1]==='parent_user_id'&&c[2]==='parent'));}else{await assert.rejects(page.default({params:Promise.resolve({id:'1'})}),/not-found/);assert.equal(lookups,0);}
 }
});
test('new parent progress action goes to real form with child preselected',async()=>{
 const admin={from:table=>chain(table==='children'?{id:7,name:'Child',is_active:true}:[])};
 const lib=load('lib/parent/get-enrollment-progress.ts',{'@/lib/supabase-admin':{createAdminClient:()=>admin}});
 const result=await lib.getEnrollmentProgress({parentUserId:'parent',childId:7});assert.equal(result.ctaHref,'/parent/level-tests/new?childId=7');
});
test('evaluation page denies other roles and gracefully renders an empty date',async()=>{
 for(const role of ['teacher','admin']){const db={auth:{getUser:async()=>({data:{user:{id:'viewer'}}})},from:table=>chain(table==='profiles'?{role}:[])};
 const page=load('app/admin/evaluations/page.tsx',{'@/lib/supabase-server':{createClient:async()=>db}});
 const promise=page.default({searchParams:Promise.resolve({date:'2026-02-30'})});if(role==='teacher')await assert.rejects(promise,/redirect/);else{const element=await promise;assert(JSON.stringify(element).includes('해당 날짜에 완료된 수업이 없습니다.'));}
 }
});
test('interview scheduling resolves recipient Auth email and preserves successful schedule',async()=>{
 const sent=[];const db={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from:()=>chain({role:'admin'})};
 const admin={auth:{admin:{getUserById:async id=>{assert.equal(id,'parent');return {data:{user:{email:'parent@example.test'}}};}}},from:table=>chain(null,[],{result:({single,method})=>{
 if(table==='level_tests')return {id:1,parent_user_id:'parent',child_id:7,interview_required:true};
 if(table==='teacher_profiles')return {user_id:'teacher',display_name:'Jennifer',is_active:true};
 if(table==='teacher_availability')return [{start_time:'00:00:00',end_time:'23:59:59'}];
 if(table==='level_test_interviews')return single?null:[];
 if(table==='children')return {name:'Child'};
 return method==='select'?[]:null;
 }})};
 const route=load('app/api/admin/level-tests/[id]/interview-schedule/route.ts',{'@/lib/supabase-server':{createClient:async()=>db},'@/lib/supabase-admin':{createAdminClient:()=>admin},'@/lib/email':{sendEmail:async message=>sent.push(message)}});
 const response=await route.POST({json:async()=>({testerUserId:'teacher',scheduledAt:'2030-10-23T10:00:00+09:00',meetingProvider:'external',meetingUrl:'https://example.test/meeting'})},{params:Promise.resolve({id:'1'})});assert.equal(response.status,200,JSON.stringify(response.data));assert.equal(sent.length,1);assert.equal(sent[0].to,'parent@example.test');
});
