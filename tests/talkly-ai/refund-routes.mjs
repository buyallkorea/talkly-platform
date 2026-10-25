import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
class AiError extends Error {
  constructor(m, status = 400) {
    super(m);
    this.status = status;
  }
}
let role = "student",
  calls = [],
  rpcError = null;
const db = {
  from(table) {
    assert.equal(table, "profiles");
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        assert.deepEqual([k, v], ["id", "owner"]);
        return q;
      },
      async maybeSingle() {
        return { data: { role }, error: null };
      },
    };
    return q;
  },
  async rpc(name, args) {
    calls.push([name, args]);
    return { data: rpcError ? null : "ok", error: rpcError };
  },
};
globalThis.refundHarness = {
  AiError,
  context: async () => ({ user: { id: "owner" }, db }),
  body: (r) => r.json(),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
};
async function load(path, extra = "") {
  const source = await readFile(
    new URL("../../" + path, import.meta.url),
    "utf8",
  );
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const code =
    "const {AiError,context,body,failure}=globalThis.refundHarness;\n" +
    extra +
    "\n" +
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
const domain = await load("lib/talkly-ai/refunds.ts");
globalThis.refundInput = domain.refundInput;
const member = await load(
  "app/api/talkly-ai/refunds/route.ts",
  "const refundInput=globalThis.refundInput;",
);
const admin = await load("app/api/talkly-ai/admin/refunds/route.ts");
const send = (route, data) =>
  route.POST(
    new Request("https://example.com/api", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  );
const valid = {
  orderId: "test_order",
  reason: "quality",
  confirm: true,
  userId: "victim",
};
for (const patch of [
  { reason: "toString" },
  { confirm: false },
  { orderId: "bad key" },
  { reason: null },
])
  assert.equal((await send(member, { ...valid, ...patch })).status, 400);
assert.equal(calls.length, 0);
let response = await send(member, valid);
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), "no-store");
assert.deepEqual(calls.pop(), [
  "ai_request_refund",
  { p_user: "owner", p_order: "test_order", p_reason: "quality" },
]);
const review = {
  requestId: "11111111-1111-4111-8111-111111111111",
  revision: 0,
  state: "reviewing",
  actorId: "victim",
};
assert.equal((await send(admin, review)).status, 403);
assert.equal(calls.length, 0);
role = "admin";
for (const patch of [
  { revision: -1 },
  { revision: 1.5 },
  { requestId: "bad" },
  { state: "refunded" },
])
  assert.equal((await send(admin, { ...review, ...patch })).status, 400);
response = await send(admin, review);
assert.equal(response.status, 200);
assert.deepEqual(calls.pop(), [
  "ai_review_refund",
  {
    p_actor: "owner",
    p_request: review.requestId,
    p_revision: 0,
    p_state: "reviewing",
  },
]);
rpcError = { message: "conflict" };
assert.equal((await send(admin, review)).status, 409);
assert.equal((await send(member, valid)).status, 409);
console.log(
  "PASS: request validation, prototype reason rejection, server owner/actor, admin enforcement, RPC failure handling, no-store",
);
