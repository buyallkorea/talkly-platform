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
  runs = 0;
const db = {
  from(table) {
    assert.equal(table, "profiles");
    const q = {
      select: () => q,
      eq: (k, v) => {
        assert.deepEqual([k, v], ["id", "server-admin"]);
        return q;
      },
      maybeSingle: async () => ({ data: { role }, error: null }),
    };
    return q;
  },
};
globalThis.adminOutreachHarness = {
  AiError,
  body: (r) => r.json(),
  context: async () => ({ user: { id: "server-admin" }, db }),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
  runOutreachBatch: async (...args) => {
    assert.equal(args.length, 0);
    runs++;
    return {
      status: "processed",
      accepted: 1,
      failed: 0,
      unknown: 0,
      skipped: 0,
      deferred: 0,
      unrecorded: 0,
    };
  },
};
const src = await readFile(
  new URL("../../app/api/talkly-ai/admin/outreach/route.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile("route.ts", src, ts.ScriptTarget.Latest, true);
const code =
  "const {AiError,body,context,failure,runOutreachBatch}=globalThis.adminOutreachHarness;" +
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n");
const { POST } = await import(
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
const original = process.env.TALKLY_AI_OUTREACH_DELIVERY_ENABLED;
const send = (data) =>
  POST(
    new Request("https://test.example/api/talkly-ai/admin/outreach", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  );
try {
  delete process.env.TALKLY_AI_OUTREACH_DELIVERY_ENABLED;
  assert.equal((await send({ confirm: true })).status, 403);
  role = "admin";
  assert.equal((await send({ confirm: false })).status, 400);
  assert.equal((await send({ confirm: true })).status, 503);
  assert.equal(runs, 0);
  process.env.TALKLY_AI_OUTREACH_DELIVERY_ENABLED = "true";
  const result = await send({
    confirm: true,
    to: "ignored@example.com",
    userId: "victim",
    limit: 999,
    subject: "ignored",
  });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(runs, 1);
  console.log(
    "PASS: server-side administrator check, explicit actual-send confirmation, delivery OFF blocks worker, client recipient/payload/limit ignored and no-store response; worker mocked",
  );
} finally {
  if (original === undefined)
    delete process.env.TALKLY_AI_OUTREACH_DELIVERY_ENABLED;
  else process.env.TALKLY_AI_OUTREACH_DELIVERY_ENABLED = original;
}
