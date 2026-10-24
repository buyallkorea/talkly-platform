const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, console, process, URL, require(name) { if (name in mocks) return mocks[name]; throw Error('Unexpected import: ' + name); } });
  return exports;
}
const signing = load('lib/storage-signing.ts', {}).signStoragePaths;
function storage(result) {
  const calls = [];
  return { calls, client: { storage: { from: bucket => ({ createSignedUrls: async (paths, ttl) => { calls.push({bucket, paths: [...paths], ttl}); return result ? result(paths) : {data: paths.map(path => ({path, signedUrl: 'signed:' + path}))}; } }) } } };
}
test('101 textbook pages are signed in one request with paths, order and TTL preserved', async () => {
  const {calls, client} = storage();
  const paths = Array.from({length:101}, (_,i)=>'book/'+i+'.webp');
  const urls = await signing(client, 'textbook-pages', [...paths, paths[0], '']);
  assert.equal(calls.length, 1); assert.deepEqual(calls[0], {bucket:'textbook-pages',paths,ttl:3600});
  assert.equal(urls.size,101); assert.equal(urls.get(paths[100]), 'signed:'+paths[100]);
});
test('large books are bounded to 200 paths per request and empty audio sends no request', async () => {
  const {calls, client} = storage();
  await signing(client,'textbook-pages',Array.from({length:401},(_,i)=>String(i)));
  assert.deepEqual(calls.map(c=>c.paths.length),[200,200,1]);
  await signing(client,'textbook-audio',[]); assert.equal(calls.length,3);
});
test('missing individual objects are omitted and service failures are propagated', async () => {
  const {client} = storage(()=>({data:[{path:'ok',signedUrl:'url'},{path:'missing',error:'not found',signedUrl:''}]}));
  assert.equal((await signing(client,'textbook-pages',['ok','missing'])).size,1);
  await assert.rejects(signing(storage(()=>({error:new Error('storage unavailable')})).client,'textbook-pages',['x']),/storage unavailable/);
});
function middlewareHarness(names) {
  const calls = []; const requestCookies = names.map(name=>({name,value:'old'}));
  const request = {cookies:{getAll:()=>requestCookies,set:(name,value)=>calls.push(['request',name,value])}};
  const module = load('middleware.ts', {
    '@supabase/ssr':{createServerClient:(url,key,options)=>{calls.push(['client']);return {auth:{getClaims:async()=>{calls.push(['claims']);options.cookies.setAll([{name:'sb-project-auth-token.0',value:'renewed',options:{httpOnly:true}}]);}}};}},
    'next/server':{NextResponse:{next:()=>({cookies:{set:(...args)=>calls.push(['response',...args])}})}}
  });
  return {run:()=>module.middleware(request),calls};
}
test('anonymous navigation skips Auth network calls', async () => {
  const harness = middlewareHarness(['theme','unrelated']); await harness.run(); assert.deepEqual(harness.calls,[]);
});
for (const name of ['sb-project-auth-token','sb-project-auth-token.0']) test('session cookie validates claims and forwards renewal: '+name, async()=>{
  const harness=middlewareHarness([name]);await harness.run();
  assert.deepEqual(harness.calls.map(c=>c[0]),['client','claims','request','response']);
  assert.equal(harness.calls[3][2],'renewed'); assert.equal(harness.calls[3][3].httpOnly,true);
});
test('getCurrentUser deduplicates within a render and cannot reuse another request identity', async()=>{
  let scope = new Map(), identity='student',calls=0;
  const cache=fn=>()=>{if(!scope.has(fn))scope.set(fn,fn());return scope.get(fn);};
  const {getCurrentUser}=load('lib/server-user.ts',{'react':{cache},'@/lib/supabase-server':{createClient:async()=>({auth:{getUser:async()=>{calls++;return {data:{user:{id:identity}}};}}})}});
  const [layout,page]=await Promise.all([getCurrentUser(),getCurrentUser()]);
  assert.equal(calls,1); assert.equal(layout,page); assert.equal(page.data.user.id,'student');
  scope=new Map();identity='teacher'; assert.equal((await getCurrentUser()).data.user.id,'teacher');assert.equal(calls,2);
});
test('classroom batch output preserves page/audio mapping and saved progress for 101 pages',async()=>{
  const react={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  const pages=Array.from({length:101},(_,i)=>({id:i+1,page_number:i+1,page_image_url:'page/'+i}));
  const {calls,client}=storage();
  client.from=table=>{const data={textbooks:{id:1,title:'Book'},textbook_pages:pages,textbook_hotspots:[{id:7,page_id:80,type:'audio',audio_url:'sound/7',x_percent:'10',y_percent:'20',width_percent:'5',height_percent:'6'}],enrollment_textbooks:{last_page_id:80,last_page_number:80}}[table];const chain=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>resolve({data,error:null}):()=>chain});return chain;};
  const panel=load('app/classroom/[sessionId]/ClassroomTextbookPanel.tsx',{'@/lib/storage-signing':{signStoragePaths:signing},'@supabase/supabase-js':{createClient:()=>client},'./ClassroomTextbookPanelClient':{default:'viewer'},'react/jsx-runtime':react}).default;
  const env={url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
  try{const result=await panel({textbookId:1,sessionId:2,enrollmentId:3,viewerRole:'teacher'});assert.equal(calls.length,2);assert.equal(result.props.initialPageIndex,79);assert.equal(result.props.pages.length,101);assert.equal(result.props.pages[79].hotspots[0].audioUrl,'signed:sound/7');assert.equal(result.props.pages[79].hotspots[0].xPercent,10);assert.equal(result.props.pages[100].imageUrl,'signed:page/100');}finally{if(env.url===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=env.url;if(env.key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=env.key;}
});
function dashboard(role, wrongRole = false) {
  const calls=[];let release;const blocked=new Promise(resolve=>{release=resolve;});
  const data={profiles:{role:wrongRole?'other':role,name:'Fixture'},children:[{id:10,name:'Child',created_at:'2026-01-01'}],enrollments:[{id:1,child_id:10,course_id:2,teacher_user_id:'teacher',status:'active'}],class_sessions:[],teacher_reviews:[],courses:[{id:2,name:'English'}],teacher_profiles:[{user_id:'teacher',display_name:'Teacher'}],level_tests:[]};
  const db={from:table=>{const chain=new Proxy({}, {get:(_,key)=>key==='then'?async resolve=>{calls.push(table);if(table==='class_sessions')await blocked;resolve({data:data[table]??[],error:null});}:()=>chain});return chain;}};
  const mocks={'@/lib/server-user':{getCurrentUser:async()=>({data:{user:{id:role}}})},'@/lib/supabase-server':{createClient:async()=>db},'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'next/link':{default:'Link'},'next/navigation':{redirect:path=>{throw Error('redirect:'+path);}},'@/components/TalklyUserHeader':{default:'Header'},'@/components/parent/EnrollmentProgressCard':{default:'Progress'},'@/lib/student-enrollments':{getStudentEnrollments:async()=>data.enrollments},'@/lib/parent/get-enrollment-progress':{getEnrollmentProgress:async()=>{calls.push('progress');return null;}}};
  return {calls,release,run:()=>load('app/'+role+'/page.tsx',mocks).default()};
}
for(const role of ['student','parent']) {
  test(role+' dashboard starts independent metadata before slow sessions finish',async()=>{
    const h=dashboard(role);const rendering=h.run();await new Promise(resolve=>setImmediate(resolve));
    assert(h.calls.includes('class_sessions'));assert(h.calls.includes('courses'));assert(h.calls.includes('teacher_profiles'));
    if(role==='student')assert(h.calls.includes('teacher_reviews'));else {assert(h.calls.includes('progress'));assert(h.calls.includes('level_tests'));}
    h.release();assert((await rendering).props);
  });
  test(role+' dashboard rejects wrong role before reading account data',async()=>{
    const h=dashboard(role,true);await assert.rejects(h.run(),/redirect:\//);assert.deepEqual(h.calls,['profiles']);
  });
}
function loginHarness({role='student',next='/student',error=null,user=true,profileError=null,email='student@example.test'}={}) {
  const destinations=[],states=[],calls=[];let state=0;
  const jsx=(type,props)=>({type,props});
  const db={auth:{signInWithPassword:async()=>{calls.push('signIn');return {data:{user:user?{id:'u',email}:null},error};},getUser:()=>{throw Error('redundant getUser');}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{calls.push('profile');return {data:role?{role}:null,error:profileError};}})})})};
  const source=fs.readFileSync('app/login/page.tsx','utf8');const code=ts.transpileModule(source+'\nexport { LoginPageContent };',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const exports={};
  vm.runInNewContext(code,{exports,console,window:{location:{assign:path=>destinations.push(path)}},require:name=>({react:{useState:initial=>{const i=state++;return [i===0?email:i===1?'password':initial,v=>states.push([i,v])];},Suspense:'Suspense'},'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'Link'},'next/navigation':{useSearchParams:()=>({get:()=>next})},'@/lib/supabase-browser':{createClient:()=>db},'@/lib/safe-next-path':{getSafeNextPath:load('lib/safe-next-path.ts',{}).getSafeNextPath}}[name])});
  const tree=exports.LoginPageContent();
  function find(node){if(!node)return;if(Array.isArray(node)){for(const child of node){const found=find(child);if(found)return found;}}else if(typeof node==='object'){if(node.type==='form')return node;return find(node.props?.children);}}
  return {destinations,states,calls,run:()=>find(tree).props.onSubmit({preventDefault(){}})};
}
for(const role of ['student','parent','teacher','admin'])test('login reuses sign-in user and preserves '+role+' next-path guard',async()=>{
  const h=loginHarness({role,next:'/'+role});await h.run();assert.deepEqual(h.calls,['signIn','profile']);assert.deepEqual(h.destinations,['/'+role]);
});
test('login failures and missing profile never navigate; foreign role path is ignored',async()=>{
  for(const options of [{error:{message:'invalid'}},{user:false},{role:null},{profileError:{message:'denied'}},{role:'student',email:'always.talkly@gmail.com'}]){const h=loginHarness(options);await h.run();assert.deepEqual(h.destinations,[]);assert(h.states.some(([i,value])=>i===2&&value));}
  const h=loginHarness({role:'student',next:'/admin'});await h.run();assert.deepEqual(h.destinations,['/']);
});
