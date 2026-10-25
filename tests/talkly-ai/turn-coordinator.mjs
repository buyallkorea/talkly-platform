import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const moduleSource = await readFile(
  new URL("../../lib/talkly-ai/turn-coordinator.ts", import.meta.url),
  "utf8",
);
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
const asUrl = (source) =>
  "data:text/javascript;base64," +
  Buffer.from(compile(source)).toString("base64");
const { TurnCoordinator } = await import(asUrl(moduleSource));
const gate = new TurnCoordinator();
assert.equal(gate.takeResponse(), false); // Silence never starts another question.
gate.reset(true);
gate.event({ type: "input_audio_buffer.speech_started" });
gate.event({ type: "input_audio_buffer.speech_stopped" });
assert.equal(gate.takeResponse(), false); // End detection alone is not committed input.
gate.event({ type: "input_audio_buffer.committed", item_id: "first" });
assert.equal(gate.takeResponse(), false); // Thinking has no response deadline.
gate.event({ type: "input_audio_buffer.speech_started" });
gate.holding = false;
assert.equal(gate.takeResponse(), false); // Releasing thinking while speaking waits.
gate.event({ type: "input_audio_buffer.speech_stopped" });
assert.equal(gate.takeResponse(), true);
assert.equal(gate.takeResponse(), false);
gate.event({ type: "input_audio_buffer.committed", item_id: "first" });
gate.event({ type: "response.done" });
assert.equal(gate.takeResponse(), false); // Duplicate commit is not another question.
gate.beginResponse();
gate.event({ type: "input_audio_buffer.committed", item_id: "second" });
assert.equal(gate.takeResponse(), false);
gate.event({ type: "response.done" });
assert.equal(gate.takeResponse(), true); // Input during a response is not dropped.
gate.reset();
assert.equal(gate.takeResponse(), false);
// Exercise the actual client event handler and thinking function with a fake data channel.
const studio = await readFile(
  new URL("../../app/talkly-ai/AiStudio.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "studio.tsx",
  studio,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let handler, reply, think;
function walk(node) {
  if (
    ts.isBinaryExpression(node) &&
    node.left.getText(ast) === "channel.onmessage"
  )
    handler = node.right.getText(ast);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "replyWhenReady")
    reply = node.getText(ast);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "think")
    think = node.getText(ast);
  ts.forEachChild(node, walk);
}
walk(ast);
assert.ok(handler && reply && think);
const factory = `export function create(TurnCoordinator){
 const sent=[];const channel={readyState:'open',send:s=>sent.push(JSON.parse(s))};
 const dc={current:channel},active={current:true},attempt=1;
 const connectionEpoch={current:{current:n=>n===attempt}};
 const turnCoordinator={current:new TurnCoordinator()},holdingRef={current:false};
 const add=()=>{},setHolding=()=>{},setError=()=>{},stop=()=>{active.current=false;turnCoordinator.current.reset();};
 ${reply}\n${think}\nreturn {handler:${handler},think,sent,turnCoordinator,holdingRef};}`;
const { create } = await import(asUrl(factory));
const h = create(TurnCoordinator);
const event = (d) => h.handler({ data: JSON.stringify(d) });
event(null);
event({ unexpected: true });
h.think();
event({ type: "input_audio_buffer.speech_started" });
event({ type: "input_audio_buffer.speech_stopped" });
h.think();
assert.equal(h.sent.length, 0); // No reply before commit, even after release.
event({ type: "input_audio_buffer.committed", item_id: "a" });
assert.equal(h.sent.length, 1);
assert.equal(h.sent[0].type, "response.create");
event({ type: "response.created" });
h.think();
event({ type: "input_audio_buffer.committed", item_id: "b" });
h.think();
assert.equal(h.sent.length, 1);
event({ type: "response.done" });
assert.equal(h.sent.length, 2);
event({ type: "response.done" });
event({ type: "input_audio_buffer.committed", item_id: "b" });
assert.equal(h.sent.length, 2);
event({ type: "error" });
event({ type: "input_audio_buffer.committed", item_id: "c" });
assert.equal(h.sent.length, 2);
console.log(
  "PASS: real client handler waits for committed input, respects thinking/speaking, avoids duplicates, queues during pending response, stops on provider error and never prompts on idle.",
);
