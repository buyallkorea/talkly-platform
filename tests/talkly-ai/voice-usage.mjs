import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../lib/talkly-ai/voice-usage.ts", import.meta.url),
  "utf8",
);
const { voiceUsageRow } = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ).toString("base64")
);
const event = {
  type: "response.done",
  response: {
    id: "resp_test",
    status: "completed",
    output: [{ transcript: "secret", audio: "secret" }],
    usage: {
      input_tokens: 100,
      output_tokens: 30,
      total_tokens: 130,
      input_token_details: {
        audio_tokens: 60,
        text_tokens: 40,
        cached_tokens: 50,
        cached_tokens_details: { audio_tokens: 30, text_tokens: 20 },
      },
      output_token_details: { audio_tokens: 20, text_tokens: 10 },
    },
  },
};
const row = voiceUsageRow(event);
assert.equal(row.input_audio_tokens, 60);
assert.equal(row.cached_input_tokens, 50);
assert.equal(row.cached_audio_tokens, 30);
assert.equal(row.cached_text_tokens, 20);
assert.equal(row.output_audio_tokens, 20);
assert.equal(JSON.stringify(row).includes("secret"), false);
const copy = () => structuredClone(event);
for (const value of [
  null,
  {},
  { type: "response.output_audio.delta", delta: "secret" },
])
  assert.equal(voiceUsageRow(value), null);
for (const value of [-1, NaN, 1.5, "100", null, 1_000_000_001]) {
  const e = copy();
  e.response.usage.input_tokens = value;
  assert.equal(voiceUsageRow(e), null);
}
for (const status of ["cancelled", "failed", "incomplete"]) {
  const e = copy();
  e.response.status = status;
  assert.equal(voiceUsageRow(e).status, status);
}
let e = copy();
delete e.response.usage;
assert.equal(voiceUsageRow(e), null);
e = copy();
e.response.usage.total_tokens = 1;
assert.equal(voiceUsageRow(e), null);
e = copy();
delete e.response.usage.input_token_details;
assert.equal(voiceUsageRow(e).cached_input_tokens, null);
assert.equal(voiceUsageRow(e).input_audio_tokens, null);
e = copy();
e.response.usage.input_token_details.cached_tokens = 101;
assert.equal(voiceUsageRow(e).cached_input_tokens, null);
assert.equal(voiceUsageRow(e).cached_audio_tokens, null);
e = copy();
e.response.usage.input_token_details.cached_tokens_details.audio_tokens = 61;
assert.equal(voiceUsageRow(e).cached_audio_tokens, null);
e = copy();
e.response.usage.input_token_details.audio_tokens = 90;
assert.equal(voiceUsageRow(e).input_audio_tokens, null);
assert.equal(voiceUsageRow(e).input_tokens, 100);
e = copy();
e.response.usage.output_token_details.audio_tokens = 30;
assert.equal(voiceUsageRow(e).output_audio_tokens, null);
e = copy();
e.response.id = "../bad";
assert.equal(voiceUsageRow(e), null);
console.log(
  "PASS: response.done-only totals, cancelled/failed billed usage, modality/cache subsets, missing vs zero, corrupt optional detail isolation, bounded numbers, no transcript/audio storage",
);
