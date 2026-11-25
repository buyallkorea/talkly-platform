const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript');
const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/zoom-ui-controls.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api,requestAnimationFrame:callback=>callback()});
function button(name,{disabled=false,hidden=false}={}){return{disabled,clicks:0,focused:false,getAttribute:k=>k==='aria-label'?name:null,getClientRects:()=>hidden?[]:[{}],focus(){this.focused=true},click(){this.clicks++}}}
test('Zoom join does not imply audio connected; mute and missing media state are distinct',()=>{
 for(const [user,expected] of [[null,'unknown'],[{},'unknown'],[{audio:''},'disconnected'],[{audio:'computer',muted:true},'muted'],[{audio:'computer',muted:false},'ready'],[{audio:'phone',muted:false},'ready'],[{audio:'computer'},'unknown'],[{audio:'computer',muted:false,audioStatus:3},'failed'],[{audio:'computer',muted:false,audioStatus:1},'connecting'],[{audio:'computer',muted:false,audioStatus:0},'disconnected'],[{audio:'computer',muted:false,audioStatus:2},'ready'],[{audio:'computer',muted:false,audioConnectionStatus:3},'failed'],[{audio:'computer',muted:false,audioStatus:2,audioConnectionStatus:3},'ready']])assert.equal(api.zoomAudioState(user),expected);
});
test('visible native audio action is activated synchronously in the click gesture',()=>{
 for(const name of ['Join Audio','Join Audio by Computer','Join with Computer Audio','컴퓨터 오디오로 참가','오디오 연결']){const b=button(name);assert.equal(api.activateZoomControl({querySelectorAll:()=>[b]},'audio'),true);assert.equal(b.clicks,1);assert.equal(b.focused,true)}
});
test('unrelated, disabled and hidden SDK controls are never activated',()=>{
 const buttons=[button('Share Screen'),button('Join Audio',{disabled:true}),button('오디오 연결',{hidden:true})];assert.equal(api.activateZoomControl({querySelectorAll:()=>buttons},'audio'),false);assert(buttons.every(b=>!b.clicks));
});
test('native camera/share/settings controls have explicit labels and unknown SDK UI fails closed',()=>{
 for(const [action,name] of [['video','Start Video'],['video','비디오 시작'],['share','Share Screen'],['share','화면 공유'],['settings','Settings'],['settings','설정']]){const b=button(name);assert.equal(api.activateZoomControl({querySelectorAll:()=>[b]},action),true)}
 assert.equal(api.activateZoomControl({querySelectorAll:()=>[button('New SDK Label')]},'audio'),false);
});

test('overflow action opens only Zoom More then activates the matching visible menu item',async()=>{
 const more=button('More'),target=button('Share Screen'),other=button('Leave');let opened=false;
 more.click=()=>{opened=true;more.clicks++};
 const root={isConnected:true,querySelectorAll:()=>[more],ownerDocument:{querySelectorAll:()=>opened?[other,target]:[]}};
 assert.equal(await api.activateZoomControlWithOverflow(root,'share'),true);assert.equal(target.clicks,1);assert.equal(other.clicks,0);assert.equal(more.clicks,1);
});
test('closed iframe and disabled overflow items cannot trigger a media action',async()=>{
 for(const connected of [false,true]){const more=button('더보기'),target=button('화면 공유');target.getAttribute=k=>k==='aria-disabled'?'true':k==='aria-label'?'화면 공유':null;
 const root={isConnected:connected,querySelectorAll:()=>[more],ownerDocument:{querySelectorAll:()=>[target]}};
 assert.equal(await api.activateZoomControlWithOverflow(root,'share'),false);assert.equal(target.clicks,0);}
});

test('stop sharing targets the separate native presenter toolbar, never starts another share',async()=>{
 const stop=button('Stop Share'),start=button('Share Screen');const root={querySelectorAll:()=>[start],ownerDocument:{body:{querySelectorAll:()=>[stop]}}};assert.equal(await api.activateZoomControlWithOverflow(root,'stop-share'),true);assert.equal(stop.clicks,1);assert.equal(start.clicks,0);
});

test('join computer audio does not accidentally toggle Mute/Unmute',()=>{
 const mute=button('Mute'), unmute=button('Unmute'), join=button('Join Audio');
 const root={querySelectorAll:()=>[mute,unmute,join]};
 assert.equal(api.activateZoomControl(root,'join-audio'),true);
 assert.equal(join.clicks,1); assert.equal(mute.clicks,0); assert.equal(unmute.clicks,0);
 assert.equal(api.activateZoomControl({querySelectorAll:()=>[mute,unmute]},'join-audio'),false);
});
test('join-audio finds Zoom computer-audio confirmation in dialog portal only',async()=>{
 const join=button('Join with Computer Audio'),unrelated=button('OK');
 const root={isConnected:true,querySelectorAll:()=>[],
   ownerDocument:{querySelectorAll:selector=>selector.startsWith('[role="dialog"]')?[unrelated,join]:[]}};
 assert.equal(await api.activateZoomControlWithOverflow(root,'join-audio'),true);
 assert.equal(join.clicks,1);assert.equal(unrelated.clicks,0);
});
test('unknown Zoom popups are never clicked as an audio recovery fallback',async()=>{
 const unrelated=button('Agree'),root={isConnected:true,querySelectorAll:()=>[],
   ownerDocument:{querySelectorAll:()=>[unrelated]}};
 assert.equal(await api.activateZoomControlWithOverflow(root,'join-audio'),false);
 assert.equal(unrelated.clicks,0);
});
