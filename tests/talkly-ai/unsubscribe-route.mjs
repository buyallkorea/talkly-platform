import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
async function compile(path, prelude = "") {
  const src = await readFile(new URL("../../" + path, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true);
  return import(
    "data:text/javascript;base64," +
      Buffer.from(
        ts.transpileModule(
          prelude +
            ast.statements
              .filter((n) => !ts.isImportDeclaration(n))
              .map((n) => n.getText(ast))
              .join("\n"),
          {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
            },
          },
        ).outputText,
      ).toString("base64")
  );
}
const { validUnsubscribeToken } = await compile(
  "lib/talkly-ai/unsubscribe-token.ts",
);
const token = randomBytes(32).toString("base64url");
assert.equal(validUnsubscribeToken(token), true);
for (const bad of [
  null,
  {},
  "x".repeat(42),
  "x".repeat(44),
  "x".repeat(42) + "!",
])
  assert.equal(validUnsubscribeToken(bad), false);
class AiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
let calls = [],
  found = true,
  fail = false,
  enabled = true,
  inserted = [];
const db = {
  rpc(name, args) {
    calls.push([name, args]);
    return {
      async abortSignal(s) {
        assert.ok(s instanceof AbortSignal);
        return {
          data: found,
          error: fail ? { message: "private db error" } : null,
        };
      },
    };
  },
  from(table) {
    const q = {
      select() {
        return q;
      },
      eq() {
        return q;
      },
      async maybeSingle() {
        return { data: { enabled }, error: null };
      },
      insert(row) {
        inserted.push(row);
        return q;
      },
      abortSignal() {
        return q;
      },
      then(resolve) {
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return q;
  },
};
globalThis.unsubHarness = {
  AiError,
  createAdminClient: () => db,
  validUnsubscribeToken,
  body: (r) => r.json(),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
  createHash,
  randomBytes,
};
const helpers = await compile(
  "lib/talkly-ai/unsubscribe.ts",
  "const {createHash,randomBytes,createAdminClient}=globalThis.unsubHarness;",
);
globalThis.unsubHarness.unsubscribeHash = helpers.unsubscribeHash;
const { POST } = await compile(
  "app/api/talkly-ai/unsubscribe/route.ts",
  "const {AiError,createAdminClient,validUnsubscribeToken,body,failure,unsubscribeHash}=globalThis.unsubHarness;",
);
const send = (data, origin = "https://test.example") =>
  POST(
    new Request("https://test.example/api/talkly-ai/unsubscribe", {
      method: "POST",
      headers: origin ? { origin } : undefined,
      body: JSON.stringify(data),
    }),
  );
assert.equal(
  (await send({ token, confirm: true }, "https://other.example")).status,
  403,
);
assert.equal((await send({ token, confirm: true }, "")).status, 403);
assert.equal((await send({ token, confirm: false })).status, 400);
assert.equal((await send({ token: "bad", confirm: true })).status, 400);
assert.equal(calls.length, 0);
const response = await send({
  token,
  confirm: true,
  userId: "victim",
  channel: "kakao",
  enabled: true,
});
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), "no-store");
assert.deepEqual(calls, [
  [
    "ai_unsubscribe_outreach",
    { p_hash: createHash("sha256").update(token).digest("hex") },
  ],
]);
assert.equal(JSON.stringify(calls).includes(token), false);
found = false;
assert.equal((await send({ token, confirm: true })).status, 404);
fail = true;
assert.equal((await send({ token, confirm: true })).status, 503);
enabled = false;
assert.equal(
  await helpers.issueUnsubscribeLink("owner", "email", "https://test.example"),
  null,
);
assert.equal(inserted.length, 0);
enabled = true;
const link = new URL(
  await helpers.issueUnsubscribeLink(
    "owner",
    "email",
    "https://test.example/old?private=1",
  ),
);
assert.equal(link.pathname, "/talkly-ai/unsubscribe");
assert.equal(link.search, "");
const issued = new URLSearchParams(link.hash.slice(1)).get("token");
assert.equal(validUnsubscribeToken(issued), true);
assert.equal(inserted.at(-1).token_hash, helpers.unsubscribeHash(issued));
assert.equal(JSON.stringify(inserted).includes(issued), false);
await assert.rejects(
  helpers.issueUnsubscribeLink("owner", "email", "http://test.example"),
);
console.log(
  "PASS: no-login confirmation, origin/format validation, only hash crosses DB boundary, no browser owner/channel override, failure visibility, consent-gated fragment link and no raw-token storage",
);
