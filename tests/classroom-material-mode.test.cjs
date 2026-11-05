const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code, {exports,URL,console,process,Date,Buffer,...globals,require(name){if(name === "@/lib/classroom-language") return require("./helpers/classroom-language.cjs");if(name==='next/server')return {NextResponse:{json:(data,options={})=>({data,status:options.status??200,headers:options.headers})}};if(name in mocks)return mocks[name];throw Error('Unexpected import: '+name);}});return exports;
}
function fixture(options={}) {
  const {role='teacher',uid='teacher',sessionTeacher='teacher',fallbackTeacher='teacher',external=false,status='scheduled',ended=null,expired=false,child=true,assignment=true,write=true}=options;
  const calls=[];
  const session={id:1,enrollment_id:2,teacher_user_id:sessionTeacher,is_external_teacher:external,status,ended_at:ended,scheduled_end:expired?'2000-01-01':'2099-01-01',material_mode:'screen',selected_textbook_id:30};
  function from(table, privileged) {
    let updating=false,values;
    const chain=new Proxy({}, {get:(_,key)=>{
      if(key==='then')return resolve=>{
        calls.push({table,privileged,updating,values});
        const data=table==='profiles'?{role}:table==='class_sessions'?(updating?(write?{material_mode:values.material_mode,selected_textbook_id:values.selected_textbook_id??30}:null):session):table==='enrollments'?{id:2,teacher_user_id:fallbackTeacher,student_user_id:'student',child_id:3}:table==='children'?(child?{id:3}:null):table==='enrollment_textbooks'?(assignment?{id:5}:null):null;
        resolve({data,error:null});
      };
      return (...args)=>{if(key==='update'){updating=true;values=args[0];}return chain;};
    }});return chain;
  }
  const route=load('app/api/classroom/material-mode/route.ts',{'@/lib/supabase-server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:uid?{id:uid}:null},error:null})},from:table=>from(table,false)})},'@/lib/supabase-admin':{createAdminClient:()=>({from:table=>from(table,true)})}});
  return {calls,get:()=>route.GET(new Request('https://talkly.test/api/classroom/material-mode?sessionId=1')),post:(body={sessionId:1,mode:'screen'})=>route.POST(new Request('https://talkly.test/api/classroom/material-mode',{method:'POST',body:JSON.stringify(body)}))};
}
test('assigned teacher changes screen mode through RLS client without erasing selected textbook',async()=>{
 const f=fixture();const r=await f.post();assert.equal(r.status,200);assert.equal(r.data.mode,'screen');assert.equal(r.headers['Cache-Control'],'private, no-store');
 const update=f.calls.find(c=>c.updating);assert.equal(update.privileged,false);assert.equal(update.values.selected_textbook_id,undefined);
});
for(const options of [{role:'student',uid:'student'},{role:'parent',uid:'parent'},{role:'admin',uid:'admin'},{uid:'other'},{external:true},{sessionTeacher:'substitute'}])test('mode writes reject '+JSON.stringify(options),async()=>{const f=fixture(options);assert.equal((await f.post()).status,403);assert(!f.calls.some(c=>c.updating));});
test('fallback teacher can write only if session has no overriding teacher',async()=>{assert.equal((await fixture({sessionTeacher:null}).post()).status,200);assert.equal((await fixture({uid:'teacher',sessionTeacher:'substitute'}).post()).status,403);});
for(const status of ['completed','cancelled','held','not_held','no_show'])test('terminal '+status+' cannot change mode',async()=>{const f=fixture({status});assert.equal((await f.post()).status,409);assert(!f.calls.some(c=>c.updating));});
test('ended, expired and concurrently closed lessons reject updates',async()=>{for(const options of [{ended:'2026-01-01'},{expired:true},{write:false}])assert.equal((await fixture(options).post()).status,409);});
test('anonymous, malformed mode/id and unassigned books are rejected',async()=>{
 assert.equal((await fixture({uid:null}).post()).status,401);
 for(const body of [{sessionId:0,mode:'screen'},{sessionId:1,mode:'other'},{sessionId:1,mode:'textbook',textbookId:'30'},null])assert.equal((await fixture().post(body)).status,400);
 assert.equal((await fixture({assignment:false}).post({sessionId:1,mode:'textbook',textbookId:99})).status,403);
});
test('selected assigned book is saved atomically with textbook mode',async()=>{const f=fixture();assert.equal((await f.post({sessionId:1,mode:'textbook',textbookId:30})).status,200);assert.equal(f.calls.find(c=>c.updating).values.selected_textbook_id,30);});
for(const options of [{role:'student',uid:'student'},{role:'parent',uid:'parent'},{role:'admin',uid:'admin'},{}])test('authorized viewer reads authoritative mode '+JSON.stringify(options),async()=>{assert.equal((await fixture(options).get()).status,200);});
test('unrelated student, parent and teacher cannot read modes',async()=>{for(const options of [{role:'student',uid:'other'},{role:'parent',uid:'parent',child:false},{role:'teacher',uid:'other'}])assert.equal((await fixture(options).get()).status,403);});

test('preparation saves before navigation and sends selected textbook only in textbook mode',async()=>{
 for(const mode of ['screen','textbook']){
  const requests=[],paths=[];let state=0;
  const jsx=(type,props)=>({type,props});
  const component=load('app/classroom/[sessionId]/ClassroomPreparation.tsx',{'react':{useState:value=>[state++===0?mode:value,()=>{}]},'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'Link'},'next/navigation':{useRouter:()=>({replace:path=>paths.push(path)})}}, {fetch:async(url,options)=>{assert.equal(paths.length,0);requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({success:true})};}}).default;
  const tree=component({sessionId:1,initialMode:mode,selectedTextbookId:30,textbooks:[],returnHref:'/teacher'});
  function find(node){if(Array.isArray(node))return node.map(find).find(Boolean);if(node&&typeof node==='object')return node.type==='button'?node:find(node.props?.children);}
  await find(tree).props.onClick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests[0].mode,mode);assert.equal(requests[0].textbookId,mode==='textbook'?30:undefined);assert.deepEqual(paths,['/classroom/1?materials=ready']);
 }
});
test('preparation failure leaves the teacher outside Zoom and offers retry',async()=>{
 const paths=[],states=[];const jsx=(type,props)=>({type,props});
 const component=load('app/classroom/[sessionId]/ClassroomPreparation.tsx',{'react':{useState:value=>[value,next=>states.push(next)]},'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'Link'},'next/navigation':{useRouter:()=>({replace:path=>paths.push(path)})}}, {fetch:async()=>({ok:false,json:async()=>({error:'Denied'})})}).default;
 const tree=component({sessionId:1,initialMode:'screen',selectedTextbookId:null,textbooks:[],returnHref:'/teacher'});
 function find(node){if(Array.isArray(node))return node.map(find).find(Boolean);if(node&&typeof node==='object')return node.type==='button'?node:find(node.props?.children);}
 find(tree).props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(paths,[]);assert(states.includes('Denied'));assert(states.includes(false));
});
function stageHarness(canControl=true) {
 const values=[],refs=[],effects=[],timers=[],events={},pending=[];let index=0,refIndex=0,first=true,removed=0;
 const children=[{type:'zoom',state:'connected'},{type:'book',page:79},{type:'chat',draft:'hello'}];
 const jsx=(type,props)=>({type,props});
 const chain={on(){return chain;},subscribe(){return chain;}};
 const component=load('app/classroom/[sessionId]/ClassroomMaterialStage.tsx',{'react':{
  useState:initial=>{const i=index++;if(!(i in values))values[i]=initial;return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];},
  useRef:initial=>{const i=refIndex++;return refs[i]??(refs[i]={current:initial});},useCallback:fn=>fn,useEffect:fn=>{if(first)effects.push(fn);}},
  'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},'@/lib/supabase-browser':{createClient:()=>({channel:()=>chain,removeChannel:()=>{removed++;}})}},
  {AbortController,window:{setTimeout:fn=>{timers.push(fn);return 1;},clearTimeout(){},setInterval:()=>2,clearInterval(){},addEventListener:(type,fn)=>{events[type]=fn;},removeEventListener:type=>{delete events[type];}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},fetch:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve:body=>resolve({ok:body.success!==false,json:async()=>body})}))}).default;
 function render(){index=0;refIndex=0;const tree=component({sessionId:1,initialMode:'textbook',canControl,children});first=false;return tree;}
 function find(node,type){if(Array.isArray(node))return node.map(n=>find(n,type)).find(Boolean);if(node&&typeof node==='object'){if(type==='stage'&&node.props?.className==='talkly-classroom-stage')return node;if(node.type===type)return node;return find(node.props?.children,type);}}
 const tree=render();const cleanup=effects.map(fn=>fn());
 return {tree,render,find,children,pending,timers,events,cleanup,values,removed:()=>removed};
}
test('material switching retains Zoom/book/chat instances and ignores a stale mode GET',async()=>{
 const h=stageHarness();h.timers[0]();assert.equal(h.pending.length,1);
 h.find(h.tree,'select').props.onChange({target:{value:'screen'}});assert.equal(h.pending.length,2);
 h.pending[1].resolve({success:true,mode:'screen'});await new Promise(resolve=>setImmediate(resolve));
 h.pending[0].resolve({success:true,mode:'textbook'});await new Promise(resolve=>setImmediate(resolve));
 const stage=h.find(h.render(),'stage');assert.equal(stage.props['data-material-mode'],'screen');assert.equal(stage.props.children,h.children);
 h.cleanup.forEach(fn=>fn?.());assert.equal(h.removed(),1);assert.equal(h.events['talkly-zoom-share-state'],undefined);
});
test('read-only viewers cannot switch; share events expand and release their viewing area',()=>{
 const h=stageHarness(false);assert.equal(h.find(h.tree,'select'),undefined);
 h.events['talkly-zoom-share-state']({detail:{sessionId:999,active:true}});assert.equal(h.find(h.render(),'stage').props['data-material-mode'],'textbook');
 h.events['talkly-zoom-share-state']({detail:{sessionId:1,active:true}});assert.equal(h.find(h.render(),'stage').props['data-material-mode'],'screen');
 h.events['talkly-zoom-share-state']({detail:{sessionId:1,active:false}});assert.equal(h.find(h.render(),'stage').props['data-material-mode'],'textbook');h.cleanup.forEach(fn=>fn?.());
});
test('active screen sharing disables material switching until Zoom sharing ends',()=>{
 const h=stageHarness();h.events['talkly-zoom-share-state']({detail:{sessionId:1,active:true}});
 const select=h.find(h.render(),'select');assert.equal(select.props.disabled,true);select.props.onChange({target:{value:'screen'}});assert.equal(h.pending.length,0);h.cleanup.forEach(fn=>fn?.());
});
function testCreation(materialMode, role='admin') {
 const calls=[],network=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},from:table=>{
  let action='select',values;const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>{
   calls.push({table,action,values});const data=table==='profiles'?{role}:table==='textbooks'?{id:30,textbook_pages:[{id:1}]}:table==='teacher_profiles'?{user_id:'teacher'}:table==='courses'?{id:1}:table==='enrollments'?{id:20}:table==='class_sessions'?(action==='select'?[]:{id:100}):null;resolve({data,error:null});
  }:(...args)=>{if(['insert','update','delete'].includes(key)){action=key;values=args[0];}return chain;}});return chain;
 }};
 const route=load('app/api/admin/test-classroom/route.ts',{'@/lib/supabase-server':{createClient:async()=>db},'@supabase/supabase-js':{createClient:()=>db}}, {
  process:{env:{TALKLY_ENABLE_TEST_CLASSROOM:'true',NEXT_PUBLIC_SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'fixture',ZOOM_ACCOUNT_ID:'fixture',ZOOM_CLIENT_ID:'fixture',ZOOM_CLIENT_SECRET:'fixture',ZOOM_HOST_EMAIL:'fixture@example.test'}},
  fetch:async(url,options)=>{network.push({url,method:options.method});return {ok:true,json:async()=>url.includes('oauth/token')?{access_token:'fixture'}:{id:'fixture-meeting',join_url:'https://example.test/join'}};}
 });
 return {calls,network,run:()=>route.POST(new Request('https://talkly.test/api/admin/test-classroom',{method:'POST',body:JSON.stringify({teacherUserId:'teacher',scheduledStart:'2099-01-01T00:00:00Z',textbookId:30,...(materialMode===undefined?{}:{materialMode})})}))};
}
test('admin screen-share test lesson needs no registered book, assignment or real service calls',async()=>{
 const h=testCreation('screen');const result=await h.run();assert.equal(result.status,200);assert.equal(result.data.classroomUrl,'/classroom/100');
 assert(!h.calls.some(c=>c.table==='textbooks'||c.table==='enrollment_textbooks'));
 const inserted=h.calls.find(c=>c.table==='class_sessions'&&c.action==='insert');assert.equal(inserted.values.material_mode,'screen');assert.equal(inserted.values.selected_textbook_id,null);assert.equal(inserted.values.is_test,true);
});
test('legacy admin test requests retain textbook assignment; invalid modes and non-admins cannot create',async()=>{
 const h=testCreation();assert.equal((await h.run()).status,200);assert(h.calls.some(c=>c.table==='enrollment_textbooks'&&c.action==='insert'));assert.equal(h.calls.find(c=>c.table==='class_sessions'&&c.action==='insert').values.material_mode,'textbook');
 for(const f of [testCreation('invalid'),testCreation('screen','teacher')]){assert([400,403].includes((await f.run()).status));assert.equal(f.network.length,0);assert(!f.calls.some(c=>c.action==='insert'));}
});
async function classroomPageFixture({status='scheduled',ended=null,materials,uid='teacher',assigned='teacher'}={}) {
 const session={id:1,enrollment_id:2,teacher_user_id:assigned,is_external_teacher:false,is_test:false,status,started_at:null,ended_at:ended,scheduled_end:'2099-01-01',material_mode:'screen',selected_textbook_id:null,meeting_provider:'zoom',meeting_id:null};
 const db={from:table=>{const data=table==='profiles'?{role:'teacher',name:'Teacher'}:table==='class_sessions'?session:table==='enrollments'?{id:2,teacher_user_id:'teacher',student_user_id:null,child_id:null,course_id:1}:table==='enrollment_textbooks'?[]:table==='teacher_profiles'?{display_name:'Teacher'}:{name:'English'};const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>resolve({data,error:null}):()=>chain});return chain;}};
 const mocks={'@/lib/server-user':{getCurrentUser:async()=>({data:{user:{id:uid}}})},'@/lib/supabase-server':{createClient:async()=>db},'@/lib/test-classroom-mode':{verifyTestStudentMode:async()=>false},'@/lib/test-classroom-options':{getTestClassroomOptions:async()=>({textbooks:[]})},'next/link':{default:'Link'},'next/navigation':{notFound:()=>{throw Error('notFound');},redirect:path=>{throw Error('redirect:'+path);}},'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}};
 for(const name of ['ClassroomPreparation','ClassroomMaterialStage','ClassroomZoomEmbed','ClassroomZoomFrame','ClassroomTextbookPanel','ClassSessionControls','ClassroomWaitingRoom','ClassSessionEndWatcher','StudentAttendanceRecorder','ClassroomChat','ClassroomTextbookSelectorRefresh','TestClassroomModeChooser','TestStudentStartWatcher'])mocks['./'+name]={default:name};
 return load('app/classroom/[sessionId]/page.tsx',mocks,{fetch:()=>{throw Error('Zoom API must not run before setup');}}).default({params:Promise.resolve({sessionId:'1'}),searchParams:Promise.resolve({materials})});
}
test('assigned teacher reaches preparation before any Zoom token/meeting API call',async()=>{const result=await classroomPageFixture();assert.equal(result.type,'ClassroomPreparation');assert.equal(result.props.initialMode,'screen');assert.equal(result.props.returnHref,'/teacher');});
test('terminal and ended lessons never offer material preparation',async()=>{for(const options of [{status:'completed'},{status:'cancelled'},{ended:'2026-01-01'}])assert.notEqual((await classroomPageFixture(options)).type,'ClassroomPreparation');});
test('ready marker bypasses only setup UI and cannot grant access to another teacher',async()=>{assert.notEqual((await classroomPageFixture({materials:'ready'})).type,'ClassroomPreparation');await assert.rejects(classroomPageFixture({materials:'ready',uid:'other'}),/notFound/);});
