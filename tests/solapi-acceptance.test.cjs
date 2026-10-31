/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const src=fs.readFileSync('lib/solapi.ts','utf8').replace('import "server-only";','');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const accepted={groupInfo:{count:{total:1,registeredSuccess:1,registeredFailed:0}},failedMessageList:[]};
function setup(body,status=200){
 const logs=[]; const h={exports:{},require,process:{env:{SOLAPI_API_KEY:'synthetic-key',SOLAPI_API_SECRET:'synthetic-secret',SOLAPI_SENDER_NUMBER:'01000000000'}},console:{error:(...v)=>logs.push(v)},fetch:async()=>new Response(typeof body==='string'?body:JSON.stringify(body),{status})};
 vm.runInNewContext(js,h);return {send:()=>h.exports.sendTalklyVerificationSms('01000000001','000000'),logs};
}
test('one accepted SMS completes without logging recipient or OTP',async()=>{const h=setup(accepted);await h.send();assert.equal(h.logs.length,0);});
test('HTTP 200 with rejected or missing registration must fail',async()=>{
 for(const body of [{...accepted,failedMessageList:[{to:'private',text:'private'}]}, {groupInfo:{count:{total:1,registeredSuccess:0,registeredFailed:1}},failedMessageList:[]},{},{...accepted,groupInfo:{count:{total:2,registeredSuccess:2,registeredFailed:0}}},'not-json'])await assert.rejects(setup(body).send());
});
test('HTTP failure does not log raw provider payload',async()=>{const h=setup({phone:'private-recipient',otp:'private-code'},401);await assert.rejects(h.send());assert.equal(JSON.stringify(h.logs).includes('private'),false);});
