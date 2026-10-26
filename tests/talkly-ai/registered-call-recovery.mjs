import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../app/api/talkly-ai/internal/recover-calls/route.ts", import.meta.url), "utf8");
const closeSource = await readFile(new URL("../../lib/talkly-ai/session.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
const executable = ast.statements.filter((node) => !ts.isImportDeclaration(node)).map((node) => node.getText(ast)).join("\n");
const calls = [];
let rows = [], readError = null, closesFail = new Set();
const query = {
  select(...args) { calls.push(["select", ...args]); return this; },
  not(...args) { calls.push(["not", ...args]); return this; },
  in(...args) { calls.push(["in", ...args]); return this; },
  lt(...args) { calls.push(["lt", ...args]); return this; },
  order(...args) { calls.push(["order", ...args]); return this; },
  limit(...args) { calls.push(["limit", ...args]); return this; },
  async abortSignal(...args) { calls.push(["abortSignal", ...args]); return { data: rows, error: readError }; },
};
globalThis.__recoveryHarness = {
  createAdminClient() { return { from(name) { calls.push(["from", name]); return query; } }; },
  async closeSession(userId, id) {
    calls.push(["close", userId, id]);
    if (closesFail.has(id)) throw new Error("hangup failed");
  },
};
const js = ts.transpileModule(
  "const { createAdminClient, closeSession } = globalThis.__recoveryHarness;\n" + executable,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { GET } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const originalSecret = process.env.CRON_SECRET;
const originalFlag = process.env.TALKLY_AI_REGISTERED_CALL_RECOVERY_ENABLED;
try {
  const request = (token) => new Request("https://example.invalid/api/talkly-ai/internal/recover-calls", {
    headers: token ? { authorization: token } : {},
  });
  delete process.env.CRON_SECRET;
  process.env.TALKLY_AI_REGISTERED_CALL_RECOVERY_ENABLED = "true";
  assert.equal((await GET(request("Bearer secret"))).status, 404);
  process.env.CRON_SECRET = "secret";
  process.env.TALKLY_AI_REGISTERED_CALL_RECOVERY_ENABLED = "false";
  assert.equal((await GET(request("Bearer secret"))).status, 404);
  process.env.TALKLY_AI_REGISTERED_CALL_RECOVERY_ENABLED = "true";
  assert.equal((await GET(request())).status, 404);
  assert.equal((await GET(request("Bearer wrong"))).status, 404);
  assert.equal(calls.length, 0, "unavailable requests must not query the DB");

  readError = { message: "unavailable" };
  assert.equal((await GET(request("Bearer secret"))).status, 503);
  readError = null;
  calls.length = 0;
  rows = [{ id: "a", user_id: "one" }, { id: "b", user_id: "two" }];
  closesFail = new Set(["b"]);
  const response = await GET(request("Bearer secret"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { checked: 2, recovered: 1, failed: 1 });
  assert.deepEqual(calls.filter((v) => v[0] === "close"), [["close", "one", "a"], ["close", "two", "b"]]);
  assert(calls.some((v) => v[0] === "not" && v[1] === "call_id" && v[3] === null));
  assert(calls.some((v) => v[0] === "limit" && v[1] === 10));
  const cutoff = calls.find((v) => v[0] === "lt" && v[1] === "deadline");
  assert(cutoff && Math.abs(Date.now() - Date.parse(cutoff[2]) - 15000) < 2000);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(closeSource, /if \(s\.state !== "closed" && s\.call_id\) await hangup\(s\.call_id\)/);
  assert.match(closeSource, /p_failed: failed \|\| !s\.call_id/);
  assert.doesNotMatch(source, /cron\.schedule|schedule\s*:/);
  console.log("PASS: recovery rejects unauthorized/disabled requests, bounds overdue registered calls, handles read errors and partial hangup failures without bypassing settlement.");
} finally {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  if (originalFlag === undefined) delete process.env.TALKLY_AI_REGISTERED_CALL_RECOVERY_ENABLED;
  else process.env.TALKLY_AI_REGISTERED_CALL_RECOVERY_ENABLED = originalFlag;
  delete globalThis.__recoveryHarness;
}
