import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
let calls = [],
  memberCalls = 0,
  role = "student",
  rpcError = null;
class AiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const db = {
  from(table) {
    let owner;
    const q = {
      select() {
        return q;
      },
      eq(key, value) {
        assert.equal(key, "user_id" === key ? "user_id" : "id");
        owner = value;
        assert.equal(value, "owner");
        return q;
      },
      maybeSingle() {
        return Promise.resolve({ data: { role }, error: null });
      },
      then(resolve) {
        assert.equal(table, "ai_outreach_preferences");
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return q;
  },
  async rpc(name, args) {
    assert.equal(name, "ai_set_outreach_consent");
    calls.push(args);
    return { error: rpcError };
  },
};
globalThis.notificationHarness = {
  AiError,
  body: (r) => r.json(),
  context: async () => ({ user: { id: "owner" }, db }),
  failure: (e) =>
    Response.json({ error: e.message }, { status: e.status ?? 500 }),
  requireMember: async () => {
    memberCalls++;
  },
};
const raw = await readFile(
  new URL("../../app/api/talkly-ai/notifications/route.ts", import.meta.url),
  "utf8",
);
const source = raw.replace(
  /^import[^;]+;/,
  "const {AiError,body,context,failure,requireMember}=globalThis.notificationHarness;",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { GET, POST } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const send = (value) =>
  POST(
    new Request("https://test.example/api/talkly-ai/notifications", {
      method: "POST",
      body: JSON.stringify(value),
    }),
  );
delete process.env.TALKLY_AI_OUTREACH_OPT_IN_ENABLED;
const read = await GET();
assert.equal(read.headers.get("cache-control"), "no-store");
const state = await read.json();
assert.equal(state.optInEnabled, false);
assert.deepEqual(state.preferences, []);
assert.equal(
  (
    await send({
      channel: "kakao",
      enabled: true,
      noticeVersion: state.noticeVersion,
    })
  ).status,
  503,
);
assert.equal(calls.length, 0);
assert.equal((await send({ channel: "sms", enabled: false })).status, 400);
assert.equal((await send({ channel: "email", enabled: "false" })).status, 400);
assert.equal(
  (
    await send({
      channel: "kakao",
      enabled: false,
      userId: "victim",
      noticeVersion: "old",
    })
  ).status,
  200,
);
assert.equal(memberCalls, 0);
assert.deepEqual(calls[0], {
  p_user: "owner",
  p_channel: "kakao",
  p_enabled: false,
  p_notice: state.noticeVersion,
});
process.env.TALKLY_AI_OUTREACH_OPT_IN_ENABLED = "true";
assert.equal(
  (await send({ channel: "email", enabled: true, noticeVersion: "old" }))
    .status,
  400,
);
assert.equal(
  (
    await send({
      channel: "email",
      enabled: true,
      noticeVersion: state.noticeVersion,
      userId: "victim",
    })
  ).status,
  200,
);
assert.equal(memberCalls, 1);
assert.equal(calls[1].p_user, "owner");
role = "teacher";
assert.equal(
  (
    await send({
      channel: "email",
      enabled: true,
      noticeVersion: state.noticeVersion,
    })
  ).status,
  403,
);
rpcError = new Error("db down");
assert.equal((await send({ channel: "email", enabled: false })).status, 500);
delete process.env.TALKLY_AI_OUTREACH_OPT_IN_ENABLED;
console.log(
  "PASS: owner binding, strict validation, opt-in gate/version/role, unrestricted withdrawal and save failure",
);
