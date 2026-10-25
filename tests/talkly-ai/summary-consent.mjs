import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = (
  await readFile(
    new URL(
      "../../app/api/talkly-ai/reports/consent/route.ts",
      import.meta.url,
    ),
    "utf8",
  )
).replace(/^import[\s\S]*?server";\n/, "");
let writes = [];
const db = {
  from(table) {
    assert.equal(table, "ai_members");
    return {
      update(value) {
        const filters = [];
        const q = {
          eq(k, v) {
            filters.push([k, v]);
            return q;
          },
          is(k, v) {
            filters.push([k, v]);
            return q;
          },
          then(resolve, reject) {
            writes.push({ value, filters });
            return Promise.resolve({ error: null }).then(resolve, reject);
          },
        };
        return q;
      },
    };
  },
};
class AiError extends Error {
  constructor(m, status = 400) {
    super(m);
    this.status = status;
  }
}
globalThis.consentHarness = {
  context: async () => ({ user: { id: "owner" }, db }),
  body: (r) => r.json(),
  requireMember: async () => ({}),
  AiError,
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
};
const js = ts.transpileModule(
  "const {context,body,requireMember,AiError,failure}=globalThis.consentHarness;\n" +
    source,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const { POST } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const request = (value) =>
  new Request("https://test.example", {
    method: "POST",
    body: JSON.stringify(value),
  });
assert.equal((await POST(request({ consent: "false" }))).status, 400);
assert.equal(writes.length, 0);
assert.equal(
  (await POST(request({ consent: true, userId: "other" }))).status,
  200,
);
assert.deepEqual(writes[0].filters, [
  ["user_id", "owner"],
  ["learning_summary_consent_at", null],
]);
assert.ok(Date.parse(writes[0].value.learning_summary_consent_at) > 0);
assert.equal(
  (await POST(request({ consent: false, userId: "other" }))).status,
  200,
);
assert.deepEqual(writes[1].filters, [["user_id", "owner"]]);
assert.equal(writes[1].value.learning_summary_consent_at, null);
console.log(
  "PASS: boolean consent validation, owner-only opt-in/out and idempotent opt-in boundary.",
);
