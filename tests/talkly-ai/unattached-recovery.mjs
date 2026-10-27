import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`,
);
for (const f of [
  "20261025002307_talkly_ai.sql",
  "20261025005457_talkly_ai_signup_trial.sql",
  "20261025110204_talkly_ai_session_closing.sql",
])
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/" + f, import.meta.url),
      "utf8",
    ),
  );
const trial = "11111111-1111-4111-8111-111111111111",
  paid = "22222222-2222-4222-8222-222222222222";
await db.query("insert into auth.users values($1),($2)", [trial, paid]);
await db.query(
  "insert into ai_members(user_id,consent_version,valid_until) values($1,'test',null),($2,'test',now()+interval '30 days')",
  [trial, paid],
);
await db.exec("set role service_role");
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0].v;
let hangups = [],
  failHangup = false;
globalThis.realCloseHarness = {
  createAdminClient: () => ({
    rpc(name, args) {
      assert.ok(["ai_begin_close", "ai_finish"].includes(name));
      return {
        async abortSignal(signal) {
          assert.ok(signal instanceof AbortSignal);
          const values = [args.p_user, args.p_session];
          if (name === "ai_finish") values.push(args.p_failed);
          try {
            return {
              data: await one(
                "select public." +
                  name +
                  "(" +
                  values.map((_, i) => "$" + (i + 1)).join(",") +
                  ") v",
                values,
              ),
              error: null,
            };
          } catch (error) {
            return { data: null, error };
          }
        },
      };
    },
  }),
  hangup: async (id) => {
    hangups.push(id);
    if (failHangup) throw new Error("network unavailable");
  },
};
const source = await readFile(
  new URL("../../lib/talkly-ai/session.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "session.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const code =
  "const {createAdminClient,hangup}=globalThis.realCloseHarness;" +
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n");
const { closeSession } = await import(
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
for (const owner of [trial, paid]) {
  const lease = await one("select ai_reserve($1,'us-female') v", [owner]);
  await db.query(
    "update ai_sessions set started_at=now()-interval '1 hour',deadline=now()-interval '30 minutes' where id=$1",
    [lease.id],
  );
  await closeSession(owner, lease.id);
  assert.equal(
    await one("select charged_seconds v from ai_sessions where id=$1", [
      lease.id,
    ]),
    0,
  );
  await closeSession(owner, lease.id);
}
assert.equal(hangups.length, 0);
assert.equal(
  await one("select trial_used_seconds v from ai_members where user_id=$1", [
    trial,
  ]),
  0,
);
assert.equal(
  await one("select used_seconds v from ai_daily_usage where user_id=$1", [
    paid,
  ]),
  0,
);
const connected = await one("select ai_reserve($1,'us-female') v", [paid]);
await db.query(
  "update ai_sessions set call_id='rtc_connected',state='active',started_at=now()-interval '30 seconds',deadline=now()-interval '1 second' where id=$1",
  [connected.id],
);
await closeSession(paid, connected.id, true);
const charged = await one(
  "select charged_seconds v from ai_sessions where id=$1",
  [connected.id],
);
assert.ok(charged >= 30 && charged <= 32);
assert.equal(hangups.at(-1), "rtc_connected");
assert.equal(
  await one("select used_seconds v from ai_daily_usage where user_id=$1", [
    paid,
  ]),
  charged,
);
const failed = await one("select ai_reserve($1,'us-female') v", [paid]);
await db.query(
  "update ai_sessions set call_id='rtc_retry',state='active' where id=$1",
  [failed.id],
);
failHangup = true;
await assert.rejects(closeSession(paid, failed.id));
assert.equal(
  await one("select state v from ai_sessions where id=$1", [failed.id]),
  "closing",
);
assert.equal(
  await one("select used_seconds v from ai_daily_usage where user_id=$1", [
    paid,
  ]),
  charged + failed.reserved_seconds,
);
await db.close();
console.log(
  "PASS: actual close helper/SQL restores expired unattached trial and paid reservations exactly once, connected calls remain charged despite failed flag, and failed hangup holds quota",
);
