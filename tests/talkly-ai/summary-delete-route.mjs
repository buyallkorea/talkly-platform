import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
class AiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
let found = true,
  dbError = null,
  writes = [];
globalThis.deleteHarness = {
  AiError,
  body: (r) => r.json(),
  context: async () => ({
    user: { id: "owner" },
    db: {
      async rpc(name, args) {
        assert.equal(name, "ai_delete_learning_summary");
        writes.push(args);
        return { data: found, error: dbError };
      },
    },
  }),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
};
const source = await readFile(
  new URL("../../app/api/talkly-ai/reports/delete/route.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "route.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const code =
  "const {AiError,body,context,failure}=globalThis.deleteHarness;\n" +
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
const request = (value) =>
  POST(
    new Request("https://test.example/api/talkly-ai/reports/delete", {
      method: "POST",
      body: JSON.stringify(value),
    }),
  );
assert.equal((await request({ sessionId: "-".repeat(36) })).status, 400);
assert.equal(writes.length, 0);
const id = "11111111-1111-4111-8111-111111111111";
const response = await request({ sessionId: id, userId: "victim" });
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), "no-store");
assert.deepEqual(writes[0], { p_user: "owner", p_session: id });
found = false;
assert.equal((await request({ sessionId: id })).status, 404);
dbError = new Error("db unavailable");
assert.equal((await request({ sessionId: id })).status, 500);
console.log(
  "PASS: strict UUID, authenticated owner, not-found isolation, no-store response and DB failure",
);
