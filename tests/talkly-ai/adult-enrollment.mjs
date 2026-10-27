import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const version = "2026-10-25-v2-adult19";
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
const memberFn = ast.statements
  .find((n) => ts.isFunctionDeclaration(n) && n.name?.text === "requireMember")
  .getText(ast);
const joinSource = await readFile(
  new URL("../../app/api/talkly-ai/join/route.ts", import.meta.url),
  "utf8",
);
const joinAst = ts.createSourceFile(
  "join.ts",
  joinSource,
  ts.ScriptTarget.Latest,
  true,
);
const joinCode = joinAst.statements
  .filter((n) => !ts.isImportDeclaration(n))
  .map((n) => n.getText(joinAst))
  .join("\n");
class AiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
let member = null,
  writes = 0;
const db = {
  from(table) {
    assert.equal(table, "ai_members");
    let operation,
      values,
      filters = [];
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        filters.push([k, v]);
        return q;
      },
      neq(k, v) {
        filters.push(["neq:" + k, v]);
        return q;
      },
      maybeSingle: async () => ({ data: member, error: null }),
      upsert(v, o) {
        assert.deepEqual(o, { onConflict: "user_id", ignoreDuplicates: true });
        operation = "insert";
        values = v;
        return q;
      },
      update(v) {
        operation = "update";
        values = v;
        return q;
      },
      then(resolve, reject) {
        assert.equal(values?.user_id ?? "owner", "owner");
        assert.ok(
          Object.keys(values).every((k) =>
            ["user_id", "consent_version", "consented_at"].includes(k),
          ),
        );
        writes++;
        if (operation === "insert" && !member)
          member = {
            ...values,
            status: "active",
            trial_used_seconds: 0,
            valid_until: null,
            memory: [],
          };
        if (operation === "update") {
          assert.deepEqual(filters, [
            ["user_id", "owner"],
            ["status", "active"],
            ["neq:consent_version", version],
          ]);
          if (member?.status === "active" && member.consent_version !== version)
            Object.assign(member, values);
        }
        return Promise.resolve({ error: null }).then(resolve, reject);
      },
    };
    return q;
  },
};
globalThis.adultFixture = {
  AiError,
  CONSENT_VERSION: version,
  context: async () => ({ user: { id: "owner" }, db }),
  body: (r) => r.json(),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
};
const code =
  "const {AiError,CONSENT_VERSION,context,body,failure}=globalThis.adultFixture;\n" +
  memberFn +
  "\n" +
  joinCode;
const js = ts.transpileModule(code, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { POST, requireMember } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const request = (overrides) =>
  new Request("https://test.example", {
    method: "POST",
    body: JSON.stringify({
      consent: true,
      version,
      adultConfirmed: true,
      ...overrides,
    }),
  });
assert.equal((await POST(request({ adultConfirmed: false }))).status, 403);
assert.equal(writes, 0);
assert.equal(member, null);
assert.equal((await POST(request({ adultConfirmed: "true" }))).status, 403);
assert.equal(writes, 0);
assert.equal((await POST(request({ version: "old" }))).status, 400);
assert.equal(writes, 0);
assert.equal((await POST(request({ userId: "other" }))).status, 200);
assert.equal(member.user_id, "owner");
assert.equal(member.consent_version, version);
member.trial_used_seconds = 90;
member.valid_until = "2027-01-01T00:00:00Z";
member.memory = [{ role: "user", text: "coffee" }];
const firstConsent = member.consented_at;
assert.equal((await POST(request({}))).status, 200);
assert.equal(member.consented_at, firstConsent);
assert.equal(member.trial_used_seconds, 90);
member.consent_version = "old";
await assert.rejects(
  () => requireMember(db, "owner"),
  (e) => e.status === 403,
);
assert.ok(await requireMember(db, "owner", false)); // Legacy consent must not block withdrawal.
assert.equal((await POST(request({}))).status, 200);
assert.equal(member.consent_version, version);
assert.equal(member.trial_used_seconds, 90);
assert.equal(member.valid_until, "2027-01-01T00:00:00Z");
assert.equal(member.memory.length, 1);
member.status = "suspended";
member.consent_version = "old";
assert.equal((await POST(request({}))).status, 403);
assert.equal(member.status, "suspended");
assert.equal(member.consent_version, "old");
console.log(
  "PASS: explicit adult self-declaration and current consent required, owner-only consent renewal, no trial/pass/memory reset, repeat join idempotence, suspended account stays blocked and withdrawal remains possible.",
);
