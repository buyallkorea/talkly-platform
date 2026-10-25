import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
async function compile(path, prelude) {
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
  const js = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
}
const events = [];
let closed = false,
  hangupError = false;
const closeDb = {
  async rpc(name, args) {
    assert.equal(args.p_user, "owner");
    assert.equal(args.p_session, "session");
    events.push(name);
    return name === "ai_begin_close"
      ? {
          data: { state: closed ? "closed" : "closing", call_id: "rtc_test" },
          error: null,
        }
      : { error: null };
  },
};
globalThis.closeHarness = {
  createAdminClient: () => closeDb,
  hangup: async (id) => {
    assert.equal(id, "rtc_test");
    events.push("hangup");
    if (hangupError) throw new Error("provider unavailable");
  },
};
const { closeSession } = await compile(
  "lib/talkly-ai/session.ts",
  "const {createAdminClient,hangup}=globalThis.closeHarness;\n",
);
await closeSession("owner", "session");
assert.deepEqual(events, ["ai_begin_close", "hangup", "ai_finish"]);
events.length = 0;
hangupError = true;
await assert.rejects(closeSession("owner", "session"));
assert.deepEqual(events, ["ai_begin_close", "hangup"]);
events.length = 0;
closed = true;
await closeSession("owner", "session");
assert.deepEqual(events, ["ai_begin_close", "ai_finish"]);
class AiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
let attached = false,
  scheduled = 0;
const cleanup = [];
let rateAllowed = true,
  rateError = null;
const rpcCalls = [];
const filters = [];
const watchdogTasks = [];
let watchdogState = "active";
const lease = {
  id: "lease",
  deadline: new Date(Date.now() + 180000).toISOString(),
  reserved_seconds: 180,
};
const db = {
  rpc(name, args) {
    rpcCalls.push(name);
    if (name === "ai_claim_connection_attempt") {
      assert.equal(args.p_user, "owner");
      return {
        abortSignal: async (signal) => {
          assert.ok(signal instanceof AbortSignal);
          return {
            data: { allowed: rateAllowed, retry_after_seconds: 42 },
            error: rateError,
          };
        },
      };
    }
    assert.equal(name, "ai_reserve");
    return { data: lease, error: null };
  },
  from(table) {
    assert.equal(table, "ai_sessions");
    let mutation = false,
      selected;
    const q = {
      select(columns) {
        selected = columns;
        return q;
      },
      update(value) {
        mutation = true;
        assert.deepEqual(value, { call_id: "rtc_test", state: "active" });
        return q;
      },
      eq(k, v) {
        if (mutation) filters.push([k, v]);
        return q;
      },
      neq() {
        return q;
      },
      lt() {
        return q;
      },
      gt(k, v) {
        assert.equal(k, "deadline");
        assert.ok(Number.isFinite(Date.parse(v)));
        return q;
      },
      maybeSingle: async () => ({
        data:
          selected === "state"
            ? { state: watchdogState }
            : attached
              ? { id: "lease" }
              : null,
        error: null,
      }),
      then(resolve) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return q;
  },
};
const metadata = [];
globalThis.negotiationHarness = {
  queueApiEvent: (event) => metadata.push(event),
  API_MODELS: {
    voice_connect: "gpt-realtime-2.1-mini",
    learning_summary: "gpt-4.1-mini",
  },
  after: (callback) => {
    watchdogTasks.push(callback);
    scheduled++;
  },
  AiError,
  body: (r) => r.json(),
  context: async () => ({ user: { id: "owner" }, db }),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
  requireMember: async () => ({ memory: [] }),
  hangup: async (id) => cleanup.push(["hangup", id]),
  closeSession: async (...args) => cleanup.push(["close", ...args]),
  TUTORS: [{ id: "us-female", voice: "marin" }],
  tutorInstructions: () => "",
};
const { POST } = await compile(
  "app/api/talkly-ai/session/route.ts",
  "const {after,AiError,body,context,failure,requireMember,hangup,closeSession,TUTORS,tutorInstructions,queueApiEvent,API_MODELS}=globalThis.negotiationHarness;\n",
);
const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "test-placeholder";
globalThis.fetch = async () =>
  new Response("sdp-answer", {
    headers: { location: "https://api.openai.com/v1/realtime/calls/rtc_test" },
  });
const request = () =>
  new Request("https://test.example/api/talkly-ai/session", {
    method: "POST",
    body: JSON.stringify({ tutorId: "us-female", sdp: "v=0\n" }),
  });
try {
  assert.equal((await POST(request())).status, 409);
  assert.equal(scheduled, 0);
  assert.deepEqual(cleanup, [
    ["hangup", "rtc_test"],
    ["close", "owner", "lease", true],
  ]);
  assert.deepEqual(filters, [
    ["id", "lease"],
    ["user_id", "owner"],
    ["state", "connecting"],
  ]);
  attached = true;
  cleanup.length = 0;
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sdp, "sdp-answer");
  assert.equal(scheduled, 1);
  assert.equal(cleanup.length, 0);
  assert.equal(metadata.length, 2);
  assert.equal(metadata[0].outcome, "failed");
  assert.equal(metadata[1].outcome, "succeeded");
  assert.equal(metadata[1].httpStatus, 200);
  rateAllowed = false;
  rpcCalls.length = 0;
  const blocked = await POST(request());
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("Retry-After"), "42");
  assert.equal((await blocked.json()).retryAfterSeconds, 42);
  assert.deepEqual(rpcCalls, ["ai_claim_connection_attempt"]);
  assert.equal(metadata.length, 2);
  assert.equal(cleanup.length, 0);
  rateError = { message: "rate store unavailable" };
  rpcCalls.length = 0;
  assert.equal((await POST(request())).status, 503);
  assert.deepEqual(rpcCalls, ["ai_claim_connection_attempt"]);
  const originalNow = Date.now,
    originalTimeout = globalThis.setTimeout;
  let fakeNow = Date.parse(lease.deadline) - 25000;
  const delays = [];
  cleanup.length = 0;
  Date.now = () => fakeNow;
  globalThis.setTimeout = (callback, delay) => {
    delays.push(delay);
    fakeNow += delay;
    callback();
    return 0;
  };
  try {
    await watchdogTasks[0]();
    assert.deepEqual(delays, [10000, 10000, 5000]);
    assert.equal(fakeNow, Date.parse(lease.deadline));
    assert.deepEqual(cleanup, [["close", "owner", "lease"]]);
    watchdogState = "closed";
    fakeNow = Date.parse(lease.deadline) - 25000;
    delays.length = 0;
    cleanup.length = 0;
    await watchdogTasks[0]();
    assert.deepEqual(delays, [10000]);
    assert.equal(cleanup.length, 0);
  } finally {
    Date.now = originalNow;
    globalThis.setTimeout = originalTimeout;
  }
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
}
console.log(
  "PASS: atomic begin-close -> hangup -> finish, hangup failure holds quota, zero-row attachment closes upstream and rejects success, successful owned attachment schedules watchdog, local cooldown prevents quota/provider work, and 10-second polling preserves deadline",
);
