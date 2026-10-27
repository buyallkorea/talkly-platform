import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const compile = (s) =>
  ts.transpileModule(s, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
const url = (s) =>
  "data:text/javascript;base64," + Buffer.from(compile(s)).toString("base64");
const { TurnCoordinator } = await import(
  url(
    await readFile(
      new URL("../../lib/talkly-ai/turn-coordinator.ts", import.meta.url),
      "utf8",
    ),
  )
);
let gate = new TurnCoordinator();
assert.equal(gate.takeResponse(999999), false); // Idle cannot cause a question.
gate.event({ type: "input_audio_buffer.speech_started", item_id: "a" }, 0);
gate.event({ type: "input_audio_buffer.speech_stopped", item_id: "a" }, 100);
assert.equal(gate.takeResponse(10000), false); // End detection still needs commitment.
gate.event({ type: "input_audio_buffer.committed", item_id: "a" }, 200);
gate.event(
  {
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "a",
    transcript: "Coffee.",
  },
  300,
);
assert.equal(gate.responseDelay(2000), 700);
gate.event({ type: "input_audio_buffer.speech_started", item_id: "b" }, 2000);
assert.equal(gate.responseDelay(3000), null); // Restarting speech cancels automatic reply.
gate.event({ type: "input_audio_buffer.speech_stopped", item_id: "b" }, 3100);
gate.event({ type: "input_audio_buffer.committed", item_id: "a" }, 3200); // Old commit cannot complete new speech.
assert.equal(gate.takeResponse(10000), false);
gate.event({ type: "input_audio_buffer.committed", item_id: "b" }, 3300);
gate.event(
  {
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "b",
    transcript: "I like it because...",
  },
  3400,
);
assert.equal(gate.takeResponse(6799), false);
assert.equal(gate.takeResponse(6800), true);
assert.equal(gate.takeResponse(6800), false);
gate.event({ type: "response.done" }, 7000);
assert.equal(gate.takeResponse(99999), false);
gate.reset();
gate.queueText(0);
assert.equal(gate.takeResponse(0), true); // Explicit text submission has no added voice wait.
gate.event({ type: "input_audio_buffer.committed", item_id: "c" }, 10);
assert.equal(gate.responseDelay(10000), null);
gate.event({ type: "response.done" }, 10000);
assert.equal(gate.takeResponse(10000), true); // Pending response does not lose next input.
gate = new TurnCoordinator();
gate.event({ type: "input_audio_buffer.committed", item_id: "long" }, 0);
gate.event(
  {
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "long",
    transcript: "I usually enjoy making coffee at home every morning.",
  },
  100,
);
assert.equal(gate.takeResponse(799), false);
assert.equal(gate.takeResponse(800), true);
// Execute the real handler with a deterministic clock and scheduler, without a microphone/API call.
const studio = await readFile(
  new URL("../../app/talkly-ai/AiStudio.tsx", import.meta.url),
  "utf8",
);
assert.ok(!studio.includes("onClick={think}"));
assert.ok(!studio.includes("holdingRef"));
const ast = ts.createSourceFile(
  "studio.tsx",
  studio,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let handler, reply;
function walk(n) {
  if (ts.isBinaryExpression(n) && n.left.getText(ast) === "channel.onmessage")
    handler = n.right.getText(ast);
  if (ts.isFunctionDeclaration(n) && n.name?.text === "replyWhenReady")
    reply = n.getText(ast);
  ts.forEachChild(n, walk);
}
walk(ast);
assert.ok(handler && reply);
const factory = `export function create(TurnCoordinator,getNow){let timer=null;const sent=[];const channel={readyState:'open',send:s=>sent.push(JSON.parse(s))};const dc={current:channel},active={current:true},attempt=1,replyTimer={current:null};const connectionEpoch={current:{current:n=>n===attempt}};const turnCoordinator={current:new TurnCoordinator()};const add=()=>{},setError=()=>{},stop=()=>{active.current=false;timer=null;turnCoordinator.current.reset();};const setTimeout=(fn,delay)=>{timer={fn,at:getNow()+delay};return 1;},clearTimeout=()=>{timer=null;};${reply}\nreturn{handler:${handler},sent,runTimer(){if(timer&&timer.at<=getNow()){const fn=timer.fn;timer=null;fn();}},timer:()=>timer};}`;
let clock = 0;
class Clocked extends TurnCoordinator {
  event(e) {
    return super.event(e, clock);
  }
  responseDelay() {
    return super.responseDelay(clock);
  }
  takeResponse() {
    return super.takeResponse(clock);
  }
}
const { create } = await import(url(factory));
const h = create(Clocked, () => clock);
const event = (d) => h.handler({ data: JSON.stringify(d) });
event(null);
event({ unexpected: true });
event({ type: "input_audio_buffer.speech_started", item_id: "one" });
event({ type: "input_audio_buffer.speech_stopped", item_id: "one" });
assert.equal(h.timer(), null);
event({ type: "input_audio_buffer.committed", item_id: "one" });
clock = 1499;
h.runTimer();
assert.equal(h.sent.length, 0);
event({ type: "input_audio_buffer.speech_started", item_id: "two" });
clock = 10000;
h.runTimer();
assert.equal(h.sent.length, 0);
event({ type: "input_audio_buffer.speech_stopped", item_id: "two" });
assert.equal(h.timer(), null);
event({ type: "input_audio_buffer.committed", item_id: "two" });
clock = 11500;
h.runTimer();
assert.equal(h.sent.length, 1);
event({ type: "response.done" });
event({ type: "input_audio_buffer.committed", item_id: "two" });
clock = 99999;
h.runTimer();
assert.equal(h.sent.length, 1);
event({ type: "input_audio_buffer.committed", item_id: "three" });
event({ type: "error" });
clock = 999999;
h.runTimer();
assert.equal(h.sent.length, 1);
console.log(
  "PASS: automatic grace waits, short/incomplete/long reply timing, resumed speech cancels timers, new input requires its own commit, no idle prompts/duplicates, text has no extra wait, and actual handler stops safely.",
);
