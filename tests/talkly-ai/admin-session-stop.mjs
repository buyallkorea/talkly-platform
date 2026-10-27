import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
class AiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
let role = "admin",
  session = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "target-owner",
    state: "active",
  },
  auditError = null,
  updateError = null,
  stopError = false;
let events = [];
const db = {
  from(table) {
    let mode = "read",
      value;
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        if (table === "profiles")
          assert.deepEqual([k, v], ["id", "admin-owner"]);
        if (table === "ai_sessions")
          assert.deepEqual(
            [k, v],
            ["id", session?.id ?? "11111111-1111-4111-8111-111111111111"],
          );
        return q;
      },
      insert(v) {
        mode = "insert";
        value = v;
        return q;
      },
      update(v) {
        mode = "update";
        value = v;
        return q;
      },
      async maybeSingle() {
        return table === "profiles"
          ? { data: { role }, error: null }
          : { data: session, error: null };
      },
      async single() {
        assert.equal(table, "ai_session_admin_actions");
        assert.equal(mode, "insert");
        events.push(["audit", value]);
        return {
          data: auditError ? null : { id: "audit-id" },
          error: auditError,
        };
      },
      then(resolve) {
        assert.equal(mode, "update");
        events.push(["result", value.state]);
        return Promise.resolve({ error: updateError }).then(resolve);
      },
    };
    return q;
  },
};
globalThis.adminStopHarness = {
  AiError,
  body: (r) => r.json(),
  context: async () => ({ user: { id: "admin-owner" }, db }),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
  closeSession: async (...args) => {
    events.push(["close", ...args]);
    if (stopError) throw new Error("upstream unavailable");
  },
};
const source = await readFile(
  new URL(
    "../../app/api/talkly-ai/admin/session-stop/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const ast = ts.createSourceFile(
  "route.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const code =
  "const {AiError,body,context,failure,closeSession}=globalThis.adminStopHarness;\n" +
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
const { POST } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const id = session.id;
const send = (extra = {}) =>
  POST(
    new Request("https://test.example/api/talkly-ai/admin/session-stop", {
      method: "POST",
      body: JSON.stringify({
        sessionId: id,
        reason: "connection_issue",
        confirm: true,
        userId: "victim",
        ...extra,
      }),
    }),
  );
role = "student";
assert.equal((await send()).status, 403);
assert.equal(events.length, 0);
role = "admin";
assert.equal((await send({ confirm: false })).status, 400);
assert.equal((await send({ sessionId: "-".repeat(36) })).status, 400);
assert.equal((await send({ reason: "refund everything" })).status, 400);
auditError = new Error("audit unavailable");
assert.equal((await send()).status, 503);
assert.equal(
  events.some((e) => e[0] === "close"),
  false,
);
auditError = null;
events = [];
let response = await send();
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), "no-store");
assert.deepEqual(events, [
  [
    "audit",
    {
      actor_id: "admin-owner",
      user_id: "target-owner",
      session_id: id,
      reason: "connection_issue",
    },
  ],
  ["close", "target-owner", id],
  ["result", "completed"],
]);
stopError = true;
events = [];
assert.equal((await send()).status, 503);
assert.equal(events.at(-1)[1], "failed");
stopError = false;
updateError = new Error("audit update unavailable");
assert.equal((await (await send()).json()).auditRecorded, false);
updateError = null;
session.state = "closed";
events = [];
assert.equal((await (await send()).json()).alreadyClosed, true);
assert.equal(events.length, 0);
session = null;
assert.equal((await send()).status, 404);
console.log(
  "PASS: admin role/explicit confirmation, strict input, server-bound target, mandatory audit before close, failed-close status, audit warning, already-closed idempotence",
);
