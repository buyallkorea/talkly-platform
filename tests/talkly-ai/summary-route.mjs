import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const reportSource = (
  await readFile(
    new URL("../../lib/talkly-ai/reports.ts", import.meta.url),
    "utf8",
  )
).replace(/^import .*;$/m, "");
const routeText = await readFile(
  new URL("../../app/api/talkly-ai/session/summary/route.ts", import.meta.url),
  "utf8",
);
const routeAst = ts.createSourceFile(
  "summary.ts",
  routeText,
  ts.ScriptTarget.Latest,
  true,
);
const routeSource = routeAst.statements
  .filter((node) => !ts.isImportDeclaration(node))
  .map((node) => node.getText(routeAst))
  .join("\n");
const prelude = `const {context,body,requireMember,failure,AiError,queueApiEvent,API_MODELS}=globalThis.summaryHarness;`;
const js = ts.transpileModule(prelude + reportSource + "\n" + routeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
class AiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
let consent = true,
  session,
  claimError = null,
  saved = [],
  calls = 0,
  failProvider = false,
  storeAllowed = true;
const db = {
  async rpc(name, args) {
    assert.equal(name, "ai_store_learning_summary");
    assert.equal(args.p_user, "owner");
    assert.equal(args.p_session, session.id);
    assert.equal(args.p_consent, "2026-01-01T00:00:00Z");
    if (storeAllowed) saved.push({ status: "ready", summary: args.p_summary });
    return { data: storeAllowed, error: null };
  },
  from() {
    let op = "read",
      value;
    const q = {
      select() {
        return q;
      },
      eq() {
        return q;
      },
      maybeSingle: async () => ({ data: session, error: null }),
      insert(v) {
        op = "claim";
        value = v;
        return q;
      },
      update(v) {
        op = "update";
        value = v;
        return q;
      },
      then(resolve, reject) {
        if (op === "update") saved.push(value);
        return Promise.resolve({
          error: op === "claim" ? claimError : null,
        }).then(resolve, reject);
      },
    };
    return q;
  },
};
globalThis.summaryHarness = {
  queueApiEvent: () => {},
  API_MODELS: {
    voice_connect: "gpt-realtime-2.1-mini",
    learning_summary: "gpt-4.1-mini",
  },
  AiError,
  context: async () => ({ user: { id: "owner" }, db }),
  body: async (r) => r.json(),
  requireMember: async () => ({
    learning_summary_consent_at: consent ? "2026-01-01T00:00:00Z" : null,
  }),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
};
const { POST } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  calls++;
  const request = JSON.parse(options.body);
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  if (failProvider) return new Response("", { status: 500 });
  return Response.json({
    status: "completed",
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              topics: ["일상"],
              expressions: ["I like tea.", "made up"],
              corrections: [],
              nextPractice: "차를 좋아하는 이유를 말해 보세요.",
            }),
          },
        ],
      },
    ],
  });
};
function reset() {
  consent = true;
  storeAllowed = true;
  claimError = null;
  saved = [];
  calls = 0;
  failProvider = false;
  session = {
    id: "11111111-1111-4111-8111-111111111111",
    day: "2026-10-25",
    state: "closed",
    charged_seconds: 20,
    started_at: new Date().toISOString(),
  };
}
const request = () =>
  new Request("https://example.test/api", {
    method: "POST",
    body: JSON.stringify({
      sessionId: "11111111-1111-4111-8111-111111111111",
      turns: [
        { role: "user", text: "I like tea." },
        { role: "assistant", text: "That sounds good." },
      ],
    }),
  });
reset();
consent = false;
assert.equal((await POST(request())).status, 200);
assert.equal(calls, 0);
reset();
session = null;
assert.equal((await POST(request())).status, 404);
assert.equal(calls, 0);
reset();
session.state = "active";
assert.equal((await POST(request())).status, 409);
assert.equal(calls, 0);
reset();
claimError = { code: "23505" };
assert.equal((await POST(request())).status, 200);
assert.equal(calls, 0);
reset();
assert.equal((await POST(request())).status, 200);
assert.equal(calls, 1);
assert.equal(saved[0].status, "ready");
assert.deepEqual(saved[0].summary.expressions, ["I like tea."]);
reset();
failProvider = true;
assert.equal((await POST(request())).status, 503);
assert.equal(saved[0].status, "failed");
reset();
storeAllowed = false;
const withdrawnResponse = await POST(request());
assert.equal(withdrawnResponse.status, 200);
assert.equal((await withdrawnResponse.json()).status, "not_saved");
assert.deepEqual(saved, [{ status: "failed" }], "declined storage clears only the pending claim, without summary content");
globalThis.fetch = originalFetch;
console.log(
  "PASS: summary route consent, owned closed session, duplicate exclusion, bounded provider request, validated saved output and failure state.",
);
