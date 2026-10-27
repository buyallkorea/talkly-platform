import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../../app/api/talkly-ai/session/summary/route.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("summary.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const fn = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "POST");
assert.ok(fn, "summary API must export POST");

class AiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const userId = "33333333-3333-4333-8333-333333333333";
const sessionId = "22222222-2222-4222-8222-222222222222";
const started = new Date(Date.now() - 30000).toISOString();
let session = { id: sessionId, day: "2026-10-27", state: "closed", charged_seconds: 30, started_at: started };
let member = { learning_summary_consent_at: new Date(Date.now() - 60000).toISOString() };
const events = [];
let failedUpdates = 0;
let storedValue = false;
let storageError = null;
let current = { claim: "duplicate", status: "ready", readError: false, providerCalls: 0 };
function db() {
  return {
    async rpc(name) {
      assert.equal(name, "ai_store_learning_summary");
      return { data: storedValue, error: storageError };
    },
    from(table) {
      const q = {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          if (table === "ai_sessions") return { data: session, error: null };
          if (table === "ai_learning_summaries")
            return current.readError ? { data: null, error: { message: "offline" } }
              : { data: current.status === null ? null : { status: current.status }, error: null };
          throw Error("Unexpected select " + table);
        },
        update(values) {
          assert.equal(table, "ai_learning_summaries");
          assert.equal(values.status, "failed");
          failedUpdates++;
          return this;
        },
        then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
        async insert() {
          assert.equal(table, "ai_learning_summaries");
          return { error: current.claim === "duplicate" ? { code: "23505" } : null };
        },
      };
      return q;
    },
  };
}
const harness = {
  context: async () => ({ user: { id: userId }, db: db() }),
  requireMember: async () => member,
  body: async () => ({ sessionId, turns: [{ role: "user", text: "Hello" }] }),
  summaryTurns: (turns) => turns,
  validateSummary: (value) => value,
  failure: (error) => Response.json({ error: error.message }, { status: error.status ?? 500 }),
  AiError,
  API_MODELS: { learning_summary: "test-model" },
  queueApiEvent: (event) => events.push(event),
};
globalThis.__summaryHarness = harness;
const code = `const { context, requireMember, body, summaryTurns, validateSummary, failure, AiError, API_MODELS, queueApiEvent } = globalThis.__summaryHarness;\n` + fn.getText(ast);
const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const originalFetch = globalThis.fetch;
try {
  const { POST } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
  globalThis.fetch = async () => { current.providerCalls++; throw Error("Provider must not be contacted for duplicate requests"); };
  for (const status of ["ready", "pending", "failed"]) {
    current = { claim: "duplicate", status, readError: false, providerCalls: 0 };
    const response = await POST(new Request("https://example.invalid", { method: "POST" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, status);
    assert.equal(current.providerCalls, 0);
  }
  current = { claim: "duplicate", status: null, readError: false, providerCalls: 0 };
  assert.equal((await POST(new Request("https://example.invalid"))).status, 503, "missing duplicate must not look completed");
  current = { claim: "duplicate", status: "ready", readError: true, providerCalls: 0 };
  assert.equal((await POST(new Request("https://example.invalid"))).status, 503, "failed status read must not look completed");
  assert.equal(events.length, 0, "duplicate requests must not produce new provider usage events");
  // Consent withdrawal and changed session state must stop before claiming or contacting provider.
  const originalMember = member;
  member = { learning_summary_consent_at: null };
  current = { claim: "new", status: null, readError: false, providerCalls: 0 };
  const noConsent = await POST(new Request("https://example.invalid", { method: "POST" }));
  assert.equal((await noConsent.json()).status, "not_enabled");
  assert.equal(current.providerCalls, 0);
  member = originalMember;
  const originalSession = session;
  session = { ...session, state: "closing" };
  const unclosed = await POST(new Request("https://example.invalid", { method: "POST" }));
  assert.equal(unclosed.status, 409, "unclosed sessions cannot generate a learning report");
  assert.equal(current.providerCalls, 0);
  session = originalSession;
  member = { learning_summary_consent_at: new Date(Date.now() + 60000).toISOString() };
  const beforeConsent = await POST(new Request("https://example.invalid", { method: "POST" }));
  assert.equal((await beforeConsent.json()).status, "before_consent");
  assert.equal(current.providerCalls, 0);
  member = originalMember;
  assert.equal(events.length, 0, "ineligible sessions must not generate usage events");

  // A newly claimed summary with a provider failure must mark its claim failed,
  // emit a failure event, and never report a successful write.
  current = { claim: "new", status: null, readError: false, providerCalls: 0 };
  globalThis.fetch = async () => {
    current.providerCalls++;
    return { ok: false, status: 503 };
  };
  const providerFailure = await POST(new Request("https://example.invalid", { method: "POST" }));
  assert.equal(providerFailure.status, 503);
  assert.equal(current.providerCalls, 1);
  assert.equal(failedUpdates, 1, "failed provider call must mark pending claim failed");
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, "failed");
  assert.equal(events[0].httpStatus, 503);
  // Provider succeeds but storage RPC returns false: never record success.
  const responseBody = {
    status: "completed",
    usage: { input_tokens: 12, output_tokens: 8 },
    output: [{ content: [{ type: "output_text", text: '{"topics":[],"expressions":[],"corrections":[],"nextPractice":""}' }] }],
  };
  globalThis.fetch = async () => {
    current.providerCalls++;
    return { ok: true, status: 200, json: async () => responseBody };
  };
  current = { claim: "new", status: null, readError: false, providerCalls: 0 };
  storedValue = false;
  storageError = null;
  const refused = await POST(new Request("https://example.invalid", { method: "POST" }));
  assert.equal(refused.status, 200);
  assert.equal((await refused.json()).status, "not_saved");
  assert.equal(events.at(-1).outcome, "failed", "refused DB save must not produce success telemetry");
  assert.equal(current.providerCalls, 1);

  // A completed provider response and committed database write is the only ready outcome.
  current = { claim: "new", status: null, readError: false, providerCalls: 0 };
  storedValue = true;
  storageError = null;
  const ready = await POST(new Request("https://example.invalid", { method: "POST" }));
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).status, "ready");
  assert.equal(events.at(-1).outcome, "succeeded");
  assert.equal(current.providerCalls, 1);

  // A storage error must fail request and transition pending claim to failed.
  current = { claim: "new", status: null, readError: false, providerCalls: 0 };
  storageError = { message: "storage unavailable" };
  const dbFailure = await POST(new Request("https://example.invalid", { method: "POST" }));
  assert.equal(dbFailure.status, 503);
  assert.equal(failedUpdates, 2);
  assert.equal(events.at(-1).outcome, "failed");
  assert.equal(current.providerCalls, 1);

} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.__summaryHarness;
}
console.log("PASS: duplicate learning summaries report ready/pending/failed and never call provider or invent usage events.");
