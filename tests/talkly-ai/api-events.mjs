import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
let tasks = [],
  rows = [],
  logs = [],
  dbError = null,
  schedulingError = false;
globalThis.apiEventHarness = {
  after: (callback) => {
    if (schedulingError) throw new Error("no request context");
    tasks.push(callback);
  },
  createAdminClient: () => ({
    from(table) {
      assert.equal(table, "ai_api_events");
      return {
        insert(row) {
          rows.push(row);
          return {
            async abortSignal(signal) {
              assert.ok(signal instanceof AbortSignal);
              return { error: dbError };
            },
          };
        },
      };
    },
  }),
};
const source = await readFile(
  new URL("../../lib/talkly-ai/api-events.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "api-events.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const code =
  "const {after,createAdminClient}=globalThis.apiEventHarness;\n" +
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n");
const js = ts.transpileModule(code, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { apiEventRow, queueApiEvent } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const input = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  kind: "learning_summary",
  outcome: "succeeded",
  httpStatus: 200,
  durationMs: 123.4,
  usage: {
    input_tokens: 100,
    output_tokens: 20,
    input_tokens_details: { cached_tokens: 30 },
  },
  transcript: "private text",
  apiKey: "not-a-real-key",
};
const row = apiEventRow(input);
assert.equal(row.input_tokens, 100);
assert.equal(row.output_tokens, 20);
assert.equal(row.cached_input_tokens, 30);
assert.equal(row.duration_ms, 123);
assert.equal(row.failure_kind, null);
assert.equal(JSON.stringify(row).includes("private text"), false);
assert.equal(JSON.stringify(row).includes("not-a-real-key"), false);
const voice = apiEventRow({
  ...input,
  kind: "voice_connect",
  outcome: "failed",
  httpStatus: 429,
});
assert.equal(voice.input_tokens, null);
assert.equal(voice.output_tokens, null);
assert.equal(voice.failure_kind, "rate_limit");
assert.equal(
  apiEventRow({ ...input, outcome: "failed", httpStatus: 401 }).failure_kind,
  "access",
);
assert.equal(
  apiEventRow({ ...input, outcome: "failed", httpStatus: 503 }).failure_kind,
  "provider",
);
assert.equal(
  apiEventRow({ ...input, outcome: "failed", timedOut: true }).failure_kind,
  "timeout",
);
const missing = apiEventRow({
  ...input,
  durationMs: Infinity,
  usage: {
    input_tokens: -1,
    output_tokens: "100",
    input_tokens_details: { cached_tokens: 10 },
  },
});
assert.equal(missing.input_tokens, null);
assert.equal(missing.output_tokens, null);
assert.equal(missing.cached_input_tokens, null);
assert.equal(missing.duration_ms, 0);
assert.equal(
  apiEventRow({
    ...input,
    usage: { input_tokens: 2, input_tokens_details: { cached_tokens: 3 } },
  }).cached_input_tokens,
  null,
);
const originalError = console.error;
console.error = (...args) => logs.push(args);
try {
  queueApiEvent(input);
  assert.equal(tasks.length, 1);
  assert.equal(rows.length, 0);
  await tasks.shift()();
  assert.equal(rows.length, 1);
  dbError = { code: "23505" };
  queueApiEvent(input);
  await tasks.shift()();
  assert.equal(logs.length, 0);
  dbError = { code: "network-error", message: "private upstream data" };
  queueApiEvent(input);
  await tasks.shift()();
  assert.equal(logs.length, 1);
  assert.equal(JSON.stringify(logs).includes("private upstream data"), false);
  schedulingError = true;
  assert.doesNotThrow(() => queueApiEvent(input));
} finally {
  console.error = originalError;
}
console.log(
  "PASS: server metadata whitelist, unknown vs zero tokens, no voice token claims, failure categories, deferred bounded storage, duplicate/error isolation",
);
