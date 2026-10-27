import assert from "node:assert/strict";
import ts from "typescript";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../../lib/talkly-ai/checkpoint-queue.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {CheckpointQueue}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
let attempts=0;
const queue=new CheckpointQueue(async(id,turns)=>{attempts++;assert.equal(id,"session-a");assert.deepEqual(turns,[{role:"user",text:"Hello"}]);if(attempts===1)throw Error("temporary offline");});
await queue.save("session-a",[{role:"user",text:"Hello"}]);
assert.equal(attempts,2,"failed checkpoint retried once");
let fails=0;const permanent=new CheckpointQueue(async()=>{fails++;throw Error("offline");});
await assert.rejects(()=>permanent.save("session-b",[{role:"user",text:"Hello"}]),/offline/);
assert.equal(fails,2,"permanent failure not retried endlessly");
console.log("PASS: checkpoint retry retains identical content, succeeds after temporary failure and stops after repeated failure.");

let releaseFirst;
const transmitted=[];
let call=0;
const ordered=new CheckpointQueue(async(id,turns)=>{
 call++;
 transmitted.push(turns.map(t=>t.text).join("|"));
 if(call===1) await new Promise(resolve=>{releaseFirst=resolve;});
});
const first=ordered.save("session-c",[{role:"user",text:"First"}]);
const second=ordered.save("session-c",[{role:"user",text:"First"},{role:"assistant",text:"Second"}]);
releaseFirst();
await Promise.all([first,second]);
assert.deepEqual(transmitted,["First","First|Second"],"newer transcript is saved after an older pending write");

const versions=[];
let transient=0;
const versioned=new CheckpointQueue(async(id,turns,version)=>{
  versions.push(version);
  if(++transient===1) throw Error("network interrupted");
});
await versioned.save("session-versioned",[{role:"user",text:"Versioned"}],7);
assert.deepEqual(versions,[7,7],"both attempts must preserve checkpoint version");

let conflictAttempts=0;
const conflictQueue=new CheckpointQueue(async()=> {
  conflictAttempts++;
  throw Object.assign(new Error("STALE_CHECKPOINT"),{terminal:true});
});
await assert.rejects(()=>conflictQueue.save("session-conflict",[{role:"user",text:"Old"}],2),/STALE_CHECKPOINT/);
assert.equal(conflictAttempts,1,"deterministic conflict must not be retried");
console.log("PASS: checkpoint serialization preserves the latest conversation snapshot order.");
