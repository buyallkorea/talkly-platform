const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),ts=require('typescript');
const js=ts.transpileModule(fs.readFileSync('app/classroom/[sessionId]/ClassroomZoomEmbed.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function run(hostMode,fail) {
 const refs=[],states=[],effects=[],requests=[],calls=[];let refIndex=0;
 const root={clientWidth:320,clientHeight:480,innerHTML:''};let initialized,resolveDone;
 const done=new Promise(resolve=>resolveDone=resolve);
 const client={init:async options=>{initialized=options;},join:async options=>{calls.push(options);if(fail)throw {errorCode:3008,reason:'Meeting has not started'};},leaveMeeting:async()=>{}};
 const exports={};const timers=[];
 vm.runInNewContext(js,{exports,console,ResizeObserver:class{observe(){} disconnect(){}},document:{querySelector:()=>({dataset:{loaded:'true'}})},fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({success:true,signature:'signed',zak:'host-zak'})};},window:{ZoomMtgEmbedded:{createClient:()=>client},setTimeout:callback=>{timers.push(callback);return timers.length;},clearTimeout(){}},require(name){
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='react')return {useRef:value=>{const ref={current:refIndex++===0?root:value};refs.push(ref);return ref;},useState:value=>[value,next=>{states.push(next);if(next==='joined'||next==='waiting'||next==='error')resolveDone();}],useCallback:fn=>fn,useEffect:fn=>effects.push(fn)};
  throw Error(name);
 }});
 exports.default({sessionId:48,meetingNumber:'123456789',password:'fixture',userName:'Admin (Test Student)',hostMode});
 const cleanup=effects.map(effect=>effect());timers[0]();
 await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(Error('Zoom mock timed out')),1000))]);
 cleanup.forEach(fn=>fn?.());
 return {requests,calls,states,initialized};
}
test('admin test participant receives participant signature and never host ZAK',async()=>{
 const r=await run(false);assert.equal(r.requests[0].url,'/api/zoom/sdk-signature');assert.equal(r.requests[0].body.role,0);assert.equal(r.calls[0].zak,undefined);assert(r.states.includes('joining'));assert(r.states.includes('joined'));assert.equal(r.initialized.customize.video.popper.disableDraggable,true);assert(r.initialized.customize.video.viewSizes.default.width>=240);
});
test('assigned host uses host endpoint and includes ZAK',async()=>{const r=await run(true);assert.equal(r.requests[0].url,'/api/zoom/host-auth');assert.equal(r.calls[0].zak,'host-zak');assert(r.states.includes('joined'));});
test('participant waiting for host shows waiting rather than opaque connection failure',async()=>{const r=await run(false,true);assert(r.states.includes('waiting'));assert(!r.states.includes('error'));});
