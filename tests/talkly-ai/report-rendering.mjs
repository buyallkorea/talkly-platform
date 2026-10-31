import assert from 'node:assert/strict';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const source = await readFile(new URL('app/talkly-ai/reports/page.tsx', root), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'Reports');
const config = await readFile(new URL('lib/talkly-ai/config.ts', root), 'utf8');
const reports = await readFile(new URL('lib/talkly-ai/reports.ts', root), 'utf8');
const moduleJs = ts.transpileModule(config + '\n' + reports.replace(/^import .*from ["']\.\/config["'];$/m, ''), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers = await import('data:text/javascript;base64,' + Buffer.from(moduleJs).toString('base64'));
const valid = {topics:['Travel'],expressions:['A good trip'],corrections:[{before:'I go',after:'I went'}],nextPractice:'Talk about a trip'};
let deletionRecords;
const scoped = [];
const db = {from(table) {
  const q = {
    select(){return q}, eq(key,value){scoped.push([table,key,value]); return q},
    is(){return q},gt(){return q},gte(){return q},lt(){return q},order(){return q},limit(){return q},
    maybeSingle: async () => ({data:{status:'active',learning_summary_consent_at:'2026-10-01'},error:null}),
    then(resolve,reject) {return Promise.resolve({data:[
      {session_id:'valid',day:'2026-10-31',status:'ready',created_at:new Date().toISOString(),summary:valid},
      {session_id:'bad',day:'2026-10-31',status:'ready',created_at:new Date().toISOString(),summary:{...valid,topics:[{bad:'value'}]}},
    ],count:2,error:null}).then(resolve,reject)},
  };return q;
}};
const harness = {
  React, ...helpers, context:async()=>({user:{id:'owner'},db}),
  AiError:class extends Error {}, monthlyReportsEnabled:()=>false,
  loadReportHistory:async(db,user,periods)=>{
    assert.equal(user,'owner');
    return {publicationError:false,rows:periods.map(period=>({period,activity:{days:1,seconds:60,segments:2},publishedAt:null}))};
  },
  Link:({children})=>React.createElement('span',null,children),
  MemoryDeletion:()=>null,SummaryConsent:()=>null,
  SummaryDeletion:({records})=>{deletionRecords=records;return null},
};
globalThis.__reportRender = harness;
const js = ts.transpileModule('const {' + Object.keys(harness).join(',') + '} = globalThis.__reportRender;\n' + fn.getText(ast), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
try {
  const {default:Reports} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const html = renderToStaticMarkup(await Reports({searchParams:Promise.resolve({})}));
  assert.match(html,/Travel/);
  assert.match(html,/I went/);
  assert.match(html,/형식을 확인하지 못한 학습 요약 1개/);
  assert.doesNotMatch(html,/학습 기록을 불러오지 못했어요/);
  assert.equal(deletionRecords.length,2,'malformed summary remains deletable');
  assert.equal(deletionRecords.find(r=>r.session_id==='bad').label,'');
  assert.equal(deletionRecords.find(r=>r.session_id==='valid').label,'Travel');
  assert.ok(scoped.some(([table,key,value])=>table==='ai_learning_summaries'&&key==='user_id'&&value==='owner'));
} finally {delete globalThis.__reportRender;}
console.log('PASS: report renders valid content beside malformed JSON, preserves deletion access and scopes records to the member.');
