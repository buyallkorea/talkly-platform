import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const serverSource = await readFile(
  new URL("../../lib/talkly-ai/server.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "server.ts",
  serverSource,
  ts.ScriptTarget.Latest,
  true,
);
const modeFn = ast.statements.find(
  (n) => ts.isFunctionDeclaration(n) && n.name?.text === "previewTestMode",
);
const toUrl = (s) =>
  "data:text/javascript;base64," + Buffer.from(s).toString("base64");
const compiled = ts.transpileModule(modeFn.getText(ast), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { previewTestMode } = await import(toUrl(compiled));
const saved = { ...process.env };
for (const [env, mode, payments, expected] of [
  ["preview", "true", "false", true],
  ["production", "true", "false", false],
  ["development", "true", "false", false],
  ["preview", "false", "false", false],
  ["preview", "true", "true", false],
]) {
  process.env.VERCEL_ENV = env;
  process.env.TALKLY_AI_TEST_MODE = mode;
  process.env.TALKLY_AI_PAYMENTS_ENABLED = payments;
  assert.equal(previewTestMode(), expected);
}
for (const key of [
  "VERCEL_ENV",
  "TALKLY_AI_TEST_MODE",
  "TALKLY_AI_PAYMENTS_ENABLED",
]) {
  if (saved[key] === undefined) delete process.env[key];
  else process.env[key] = saved[key];
}
const bridge = toUrl(
  `export class AiError extends Error{constructor(message,status=400){super(message);this.status=status;}} export const previewTestMode=()=>globalThis.aiAccessFixture.preview;export const context=async()=>globalThis.aiAccessFixture.context;export const requireMember=async()=>globalThis.aiAccessFixture.member;export const failure=e=>Response.json({error:e.message},{status:e.status??500});`,
);
const routeSource = (
  await readFile(
    new URL("../../app/api/talkly-ai/test-access/route.ts", import.meta.url),
    "utf8",
  )
).replace('"@/lib/talkly-ai/server"', JSON.stringify(bridge));
const routeJs = ts.transpileModule(routeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { POST } = await import(toUrl(routeJs));
let writes = [];
const fixture = { preview: true, role: "admin", member: { valid_until: null } };
const db = {
  from(table) {
    if (table === "profiles")
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { role: fixture.role },
              error: null,
            }),
          }),
        }),
      };
    assert.equal(table, "ai_members");
    return {
      update(values) {
        writes.push(values);
        return {
          eq(key, value) {
            assert.equal(key, "user_id");
            assert.equal(value, "authenticated-owner");
            return {
              eq: async (k, v) => {
                assert.equal(k, "status");
                assert.equal(v, "active");
                return { error: null };
              },
            };
          },
        };
      },
    };
  },
};
fixture.context = { user: { id: "authenticated-owner" }, db };
globalThis.aiAccessFixture = fixture;
const req = () =>
  new Request("https://test.example/api/talkly-ai/test-access", {
    method: "POST",
    body: JSON.stringify({ userId: "other-person" }),
  });
fixture.preview = false;
assert.equal((await POST(req())).status, 403);
assert.equal(writes.length, 0);
fixture.preview = true;
fixture.role = "student";
assert.equal((await POST(req())).status, 403);
assert.equal(writes.length, 0);
fixture.role = "admin";
let response = await POST(req());
assert.equal(response.status, 200);
assert.equal(writes.length, 1);
assert(Date.parse(writes[0].valid_until) > Date.now() + 23 * 3600000);
fixture.member.valid_until = new Date(Date.now() + 30 * 86400000).toISOString();
response = await POST(req());
assert.equal(response.status, 200);
assert.equal(writes[1].valid_until, fixture.member.valid_until);
delete globalThis.aiAccessFixture;
console.log(
  "PASS: test access is preview-only, payments-off, admin-only, owner-only; no shortening an existing pass.",
);
