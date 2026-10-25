import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../app/talkly-ai/AiStudio.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "studio.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const functions = {},
  handlers = {};
function walk(n) {
  if (
    ts.isFunctionDeclaration(n) &&
    ["failConnection", "stop", "localClose"].includes(n.name?.text)
  )
    functions[n.name.text] = n.getText(ast);
  if (
    ts.isBinaryExpression(n) &&
    [
      "channel.onclose",
      "channel.onerror",
      "peer.onconnectionstatechange",
      "peer.ontrack",
      "track.onended",
    ].includes(n.left.getText(ast))
  )
    handlers[n.left.getText(ast)] = n.right.getText(ast);
  ts.forEachChild(n, walk);
}
walk(ast);
assert.equal(Object.keys(handlers).length, 5);
const factory = `export function make(live=true,stopFails=false){
 const events=[],errors=[];let generation=1,renewals=0,rejections=0,closed=0,stoppedTracks=0;
 const attempt=1,active={current:live},deadline={current:performance.now()+100000},stopping={current:false};
 const peer={connectionState:'connected',close(){closed++;}},channel={close(){closed++;}},pc={current:peer},dc={current:channel};
 const connectionEpoch={current:{current:id=>id===generation,cancel:()=>generation++}};
 const stream={current:{getTracks:()=>[{stop(){stoppedTracks++;}}]}},audio={current:{srcObject:null,play:()=>Promise.reject(Error('autoplay'))}};
 const timer={current:1},replyTimer={current:2},turnCoordinator={current:{reset(){events.push('turn-reset')}}};
 const session={current:'owned-session'},segmentTurns={current:[]};
 const setState=s=>events.push('state:'+s),setError=s=>errors.push(s);
 const clearInterval=()=>{},clearTimeout=()=>{},timeout=1,reject=()=>rejections++;
 const checkpoint=async id=>{assertId(id);events.push('checkpoint');};
 function assertId(id){if(id!=='owned-session')throw Error('wrong owner session');}
 const api=async(path,data)=>{assertId(data.sessionId);events.push(path);if(stopFails&&path==='session/stop')throw Error('offline');return {};};
 const refresh=async()=>({remaining:90}),renew=async()=>{renewals++;};
 ${functions.localClose}\n${functions.stop}\n${functions.failConnection}
 return {close:${handlers["channel.onclose"]},error:${handlers["channel.onerror"]},peerChange:${handlers["peer.onconnectionstatechange"]},trackEnd:${handlers["track.onended"]},ontrack:${handlers["peer.ontrack"]},stop,pc,peer,active,deadline,audio,events,errors,stats:()=>({renewals,rejections,closed,stoppedTracks})};
}`;
const js = ts.transpileModule(factory, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { make } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const flush = () => new Promise((r) => setImmediate(r));
for (const kind of ["close", "error", "trackEnd", "peerChange", "ontrack"]) {
  const h = make();
  if (kind === "peerChange") h.peer.connectionState = "disconnected";
  if (kind === "ontrack") h.ontrack({ streams: [{}] });
  else h[kind]();
  await flush();
  assert.equal(h.active.current, false, kind);
  assert.equal(h.stats().closed, 2, kind);
  assert.equal(h.stats().stoppedTracks, 1, kind);
  assert.equal(h.events.filter((x) => x === "session/stop").length, 1, kind);
  assert.ok(h.errors.length > 0, kind);
  assert.ok(
    h.events.indexOf("session/summary") > h.events.indexOf("session/stop"),
    kind,
  );
  h.close();
  h.error();
  h.trackEnd();
  await flush();
  assert.equal(
    h.events.filter((x) => x === "session/stop").length,
    1,
    "late events cannot settle again",
  );
}
const setup = make(false);
setup.error();
await flush();
assert.ok(setup.events.includes("state:paused"));
assert.equal(setup.events.filter((x) => x === "session/stop").length, 1);
const stale = make();
stale.pc.current = {};
stale.close();
stale.trackEnd();
await flush();
assert.equal(stale.events.length, 0);
assert.equal(stale.errors.length, 0);
const normal = make();
await normal.stop();
normal.close();
normal.trackEnd();
await flush();
assert.equal(normal.errors.length, 0);
assert.equal(normal.events.filter((x) => x === "session/stop").length, 1);
const lease = make();
lease.deadline.current = performance.now() + 500;
lease.close();
await flush();
assert.equal(lease.stats().renewals, 1);
assert.equal(lease.events.length, 0);
const network = make(true, true);
network.close();
await flush();
assert.equal(network.active.current, false);
assert.equal(network.stats().stoppedTracks, 1);
assert.ok(network.errors.some((x) => x.includes("종료 확인에 실패")));
assert.equal(network.events.includes("session/summary"), false);
const oldPlayback = make();
let rejectPlayback;
oldPlayback.audio.current.play = () =>
  new Promise((_, reject) => {
    rejectPlayback = reject;
  });
oldPlayback.ontrack({ streams: [{}] });
oldPlayback.pc.current = {};
rejectPlayback(Error("late autoplay"));
await flush();
assert.equal(oldPlayback.errors.length, 0);
assert.equal(oldPlayback.events.length, 0);
console.log(
  "PASS: actual dropout handlers stop peer/mic, settle once, handle setup/audio failures, ignore stale/normal-close events, and preserve renewal at lease expiry.",
);
