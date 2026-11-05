const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript');
const language=require('./helpers/classroom-language.cjs');
function load(path,mocks={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,console,process,...globals,require:name=>name==='@/lib/classroom-language'?language:name in mocks?mocks[name]:require(name)});return exports;}
test('every translated classroom system label has authored English and preserves student copy',()=>{
 let count=0;
 for(const file of fs.readdirSync('app/classroom/[sessionId]').filter(f=>f.endsWith('.tsx'))){const path='app/classroom/[sessionId]/'+file,source=ts.createSourceFile(path,fs.readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function walk(node){if(ts.isCallExpression(node)&&node.expression.getText(source)==='ui'&&ts.isStringLiteral(node.arguments[0])){const text=node.arguments[0].text,en=language.classroomText(text,true);assert(!/[가-힣]/.test(en),file+':'+text);assert(!en.startsWith('Unable to complete'),file+':'+text);assert.equal(language.classroomText(text,false),text);count++;}ts.forEachChild(node,walk)}walk(source)}
 assert(count>100);
});
test('teacher language function is stable across renders and unknown Korean server errors remain English',()=>{assert.equal(language.getClassroomText(true),language.getClassroomText(true));assert.equal(language.getClassroomText(false),language.getClassroomText(false));assert.equal(language.classroomText('권한이 없습니다.',true),'Unable to complete this action. Please try again.');assert.equal(language.classroomText('Page 2',true),'Page 2');});
test('teacher setup, material mode, chat and textbook selector render English-only system UI',()=>{
 const jsx=require('react/jsx-runtime'),{renderToStaticMarkup}=require('react-dom/server');
 const mocks={'next/navigation':{useRouter:()=>({replace(){},refresh(){}})},'next/link':{default:({href,children})=>jsx.jsx('a',{href,children})},'@/lib/supabase-browser':{createClient:()=>({})}};
 for(const [name,props]of [
 ['ClassroomPreparation',{sessionId:1,initialMode:'screen',selectedTextbookId:null,textbooks:[],returnHref:'/teacher'}],
 ['ClassroomMaterialStage',{sessionId:1,initialMode:'screen',canControl:true,children:'Fixture classroom'}],
 ['ClassroomChat',{sessionId:1,currentUserId:'teacher',currentUserRole:'teacher',currentUserName:'Jennifer',classInProgress:true}],
 ['ClassroomTextbookSelector',{sessionId:1,selectedTextbookId:null,textbooks:[],canControl:true,onSelected(){}}]
 ]){const Component=load(`app/classroom/[sessionId]/${name}.tsx`,mocks).default;const html=renderToStaticMarkup(jsx.jsx(Component,props));assert(!/[가-힣]/.test(html),name+':'+html);}
});
class Element{constructor(){this.children=[];this.classNames=new Set();this.classList={contains:name=>this.classNames.has(name),add:name=>this.classNames.add(name)};}append(child){this.children.push(child);child.parentElement=this;return child;}get firstElementChild(){return this.children[0]}get lastElementChild(){return this.children.at(-1)}contains(child){for(let p=child;p;p=p.parentElement)if(p===this)return true;return false;}}
test('SDK layout adapter marks every sizing wrapper without moving camera/share media nodes',()=>{
 const root=new Element(),drag=root.append(new Element()),absolute=drag.append(new Element()),resizable=absolute.append(new Element()),widget=resizable.append(new Element()),paper=widget.append(new Element()),panel=paper.append(new Element()),row=panel.append(new Element()),share=row.append(new Element()),canvasWrap=share.append(new Element()),canvas=canvasWrap.append(new Element()),divider=row.append(new Element()),video=row.append(new Element());
 root.querySelector=()=>widget;widget.querySelector=()=>canvas;canvas.closest=()=>panel;
 const api=load('lib/zoom-layout.ts',{}, {HTMLElement:Element});api.markZoomLayout(root);
 for(const e of [drag,absolute,resizable])assert(e.classNames.has('talkly-sdk-container'));
 assert(row.classNames.has('talkly-sdk-row'));assert(share.classNames.has('talkly-sdk-share'));assert(video.classNames.has('talkly-sdk-cameras'));assert(divider.classNames.has('talkly-sdk-divider'));
 assert.equal(canvas.parentElement,canvasWrap);assert.equal(canvasWrap.parentElement,share);assert.equal(video.parentElement,row);
});
test('video sizing uses allocated pane dimensions and leaves a wide central share at desktop widths',()=>{
 const api=load('lib/zoom-layout.ts');for(const width of [900,1200,1500]){const size=api.zoomLayoutSize(width,600,true);assert(size.width>=240&&size.width<=320);assert.equal(size.height,500);assert(width-size.width>size.width);}assert.equal(api.zoomLayoutSize(300,450,false).width,300);
});
