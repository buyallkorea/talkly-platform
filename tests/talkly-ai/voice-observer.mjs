import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
async function compile(path, prelude = "") {
  const source = await readFile(
    new URL("../../" + path, import.meta.url),
    "utf8",
  );
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const code =
    prelude +
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getText(ast))
      .join("\n");
  return import(
    "data:text/javascript;base64," +
      Buffer.from(
        ts.transpileModule(code, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
      ).toString("base64")
  );
}
const { voiceUsageRow } = await compile("lib/talkly-ai/voice-usage.ts");
globalThis.observerParser = voiceUsageRow;
const scheduled = [];
globalThis.observerAfter = (cb) => scheduled.push(cb);
const { runVoiceObservation, queueVoiceObservation } = await compile(
  "lib/talkly-ai/voice-observer.ts",
  "const voiceUsageRow=globalThis.observerParser;const after=globalThis.observerAfter;",
);
const original = {
  timeout: globalThis.setTimeout,
  clear: globalThis.clearTimeout,
  key: process.env.OPENAI_API_KEY,
  flag: process.env.TALKLY_AI_VOICE_USAGE_ENABLED,
};
let timers = [];
globalThis.setTimeout = (cb, ms) => {
  const t = { cb, ms };
  timers.push(t);
  return t;
};
globalThis.clearTimeout = (t) => {
  t.cleared = true;
};
const flush = () => new Promise(setImmediate);
const args = {
  sessionId: "owned-session",
  callId: "rtc_private",
  deadline: new Date(Date.now() + 20000).toISOString(),
};
const event = (id) =>
  JSON.stringify({
    type: "response.done",
    response: {
      id: "resp_" + id,
      status: "completed",
      usage: { input_tokens: 100, output_tokens: 10 },
    },
  });
class Socket extends EventEmitter {
  terminated = 0;
  terminate() {
    this.terminated++;
    this.emit("close");
  }
}
try {
  delete process.env.TALKLY_AI_VOICE_USAGE_ENABLED;
  process.env.OPENAI_API_KEY = "test-placeholder";
  queueVoiceObservation(args);
  assert.equal(scheduled.length, 0);
  process.env.TALKLY_AI_VOICE_USAGE_ENABLED = "true";
  delete process.env.OPENAI_API_KEY;
  queueVoiceObservation(args);
  assert.equal(scheduled.length, 0);
  process.env.OPENAI_API_KEY = "test-placeholder";
  queueVoiceObservation({ ...args, callId: "invalid" });
  assert.equal(scheduled.length, 0);
  queueVoiceObservation(args);
  assert.equal(scheduled.length, 1); // Never execute the real network callback.
  let socket = new Socket(),
    states = [],
    rows = [];
  const run = runVoiceObservation(args, {
    open: () => socket,
    state: async (row) => states.push(row),
    usage: async (row) => rows.push(row),
  });
  socket.emit("open");
  socket.emit("message", "bad json");
  socket.emit(
    "message",
    JSON.stringify({ type: "response.output_audio.delta", delta: "private" }),
  );
  socket.emit("message", event("one"));
  socket.emit("message", event("one"));
  await flush();
  socket.emit("close");
  await run;
  assert.equal(rows.length, 1);
  assert.equal(states.at(-1).reason, "socket_closed");
  assert.equal(states.at(-1).observed_responses, 1);
  assert.equal(socket.terminated, 1);
  socket.emit("message", event("late"));
  assert.equal(rows.length, 1);
  socket = new Socket();
  states = [];
  timers = [];
  let gates = [];
  const busy = runVoiceObservation(args, {
    open: () => socket,
    state: async (r) => states.push(r),
    usage: () => new Promise((resolve) => gates.push(resolve)),
  });
  socket.emit("open");
  for (let i = 0; i < 5; i++) socket.emit("message", event("busy" + i));
  await flush();
  assert.equal(gates.length, 4);
  timers.find((t) => t.ms > 5000).cb();
  for (const gate of gates) gate();
  await busy;
  assert.equal(states.at(-1).dropped_events, true);
  assert.equal(states.at(-1).reason, "deadline");
  assert.equal(socket.terminated, 1);
  socket = new Socket();
  states = [];
  timers = [];
  const failed = runVoiceObservation(args, {
    open: () => socket,
    state: async (r) => states.push(r),
    usage: async () => {
      throw new Error("do not log raw secret");
    },
  });
  socket.emit("open");
  socket.emit("message", event("failed"));
  await flush();
  socket.emit("error", new Error("private provider failure"));
  await failed;
  assert.equal(states.at(-1).recording_errors, 1);
  assert.equal(JSON.stringify(states).includes("secret"), false);
  socket = new Socket();
  states = [];
  timers = [];
  const unopened = runVoiceObservation(args, {
    open: () => socket,
    state: async (r) => states.push(r),
    usage: async () => {},
  });
  timers.find((t) => t.ms === 5000).cb();
  await unopened;
  assert.equal(states.at(-1).state, "failed");
  assert.equal(states.at(-1).reason, "connect_timeout");
  let opens = 0;
  await runVoiceObservation(
    { ...args, deadline: "invalid" },
    {
      open: () => {
        opens++;
        return socket;
      },
      state: async () => {},
      usage: async () => {},
    },
  );
  assert.equal(opens, 0);
  console.log(
    "PASS: default OFF/key/ID gate, provider event filtering/deduplication, observer-only close, bounded writes/drop marker, persistence failure marker, connect/deadline cleanup and late-event isolation; zero real sockets",
  );
} finally {
  globalThis.setTimeout = original.timeout;
  globalThis.clearTimeout = original.clear;
  for (const [key, value] of [
    ["OPENAI_API_KEY", original.key],
    ["TALKLY_AI_VOICE_USAGE_ENABLED", original.flag],
  ])
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
}
