// Run: TALKLY_AI_PGLITE_MODULE=/path/to/pglite/dist/index.js node tests/talkly-ai/database.mjs
// Executes real PostgreSQL semantics in an ephemeral WASM database, never production.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
);
await db.exec(
  await readFile(
    new URL(
      "../../supabase/migrations/20261025002307_talkly_ai.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../../supabase/migrations/20261025005457_talkly_ai_signup_trial.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../../supabase/migrations/20261025011913_talkly_ai_learning_summaries.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../../supabase/migrations/20261025052121_talkly_ai_summary_preferences.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
await db.query(`insert into auth.users values($1),($2)`, [a, b]);
await db.query(
  `insert into public.ai_members(user_id,consent_version,valid_until) values($1,'test',now()+interval '30 days'),($2,'test',null)`,
  [a, b],
);
const reserve = async (user = a) =>
  (await db.query(`select public.ai_reserve($1,'us-female') as lease`, [user]))
    .rows[0].lease;
const finish = async (id, failed = false, user = a) =>
  (
    await db.query(`select public.ai_finish($1,$2,$3) as result`, [
      user,
      id,
      failed,
    ])
  ).rows[0].result;
await db.query(
  "update ai_members set trial_used_seconds=180 where user_id=$1",
  [b],
);
await assert.rejects(() => reserve(b), /TRIAL_EXHAUSTED/);
let lease = await reserve();
assert.equal(lease.reserved_seconds, 240);
await assert.rejects(() => reserve(), /SESSION_ACTIVE/);
await assert.rejects(() => finish(lease.id, false, b), /SESSION_NOT_FOUND/);
await finish(lease.id, true);
assert.equal(
  (
    await db.query("select used_seconds from ai_daily_usage where user_id=$1", [
      a,
    ])
  ).rows[0].used_seconds,
  0,
);
await finish(lease.id, true);
assert.equal(
  (
    await db.query("select used_seconds from ai_daily_usage where user_id=$1", [
      a,
    ])
  ).rows[0].used_seconds,
  0,
);
for (const expected of [240, 240, 120]) {
  lease = await reserve();
  assert.equal(lease.reserved_seconds, expected);
  await db.query(
    `update ai_sessions set started_at=clock_timestamp()-make_interval(secs=>reserved_seconds),call_id='rtc_test' where id=$1`,
    [lease.id],
  );
  await finish(lease.id);
}
await assert.rejects(() => reserve(), /NO_TIME_REMAINING/);
assert.equal(
  (
    await db.query("select used_seconds from ai_daily_usage where user_id=$1", [
      a,
    ])
  ).rows[0].used_seconds,
  600,
);
await db.query(
  `insert into ai_payments(user_id,order_id,amount,payment_key,status) values($1,'test-order',13900,'test-key','confirming')`,
  [a],
);
const activate = async (key = "test-key") =>
  (
    await db.query(`select ai_activate($1,'test-order',$2,now()) as expiry`, [
      a,
      key,
    ])
  ).rows[0].expiry;
await assert.rejects(() => activate("other-key"), /ORDER_MISMATCH/);
const before = (
  await db.query("select valid_until from ai_members where user_id=$1", [a])
).rows[0].valid_until;
const first = await activate(),
  repeat = await activate();
assert.equal(new Date(first).getTime(), new Date(repeat).getTime());
assert.equal(Date.parse(first) - Date.parse(before), 30 * 86400000);
// A signup trial is lifetime-scoped, survives pause/rejoin and never uses paid minutes.
const c = "33333333-3333-4333-8333-333333333333";
await db.query("insert into auth.users values($1)", [c]);
await db.query(
  "insert into ai_members(user_id,consent_version) values($1,'test')",
  [c],
);
let trial = await reserve(c);
assert.equal(trial.entitlement, "trial");
assert.equal(trial.reserved_seconds, 180);
await assert.rejects(() => reserve(c), /SESSION_ACTIVE/);
await finish(trial.id, true, c);
await finish(trial.id, true, c);
assert.equal(
  (
    await db.query(
      "select trial_used_seconds from ai_members where user_id=$1",
      [c],
    )
  ).rows[0].trial_used_seconds,
  0,
);
trial = await reserve(c);
await db.query(
  "update ai_sessions set call_id='rtc_trial',started_at=clock_timestamp()-interval '60 seconds' where id=$1",
  [trial.id],
);
await finish(trial.id, false, c);
const used = (
  await db.query("select trial_used_seconds from ai_members where user_id=$1", [
    c,
  ])
).rows[0].trial_used_seconds;
assert(used >= 60 && used <= 62);
trial = await reserve(c);
assert.equal(trial.reserved_seconds, 180 - used);
await db.query(
  "update ai_sessions set call_id='rtc_trial',started_at=clock_timestamp()-make_interval(secs=>reserved_seconds) where id=$1",
  [trial.id],
);
await finish(trial.id, false, c);
await finish(trial.id, false, c);
assert.equal(
  (
    await db.query(
      "select trial_used_seconds from ai_members where user_id=$1",
      [c],
    )
  ).rows[0].trial_used_seconds,
  180,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int as count from ai_daily_usage where user_id=$1",
      [c],
    )
  ).rows[0].count,
  0,
);
await db.query(
  "insert into ai_members(user_id,consent_version) values($1,'again') on conflict(user_id) do nothing",
  [c],
);
await db.query("update ai_sessions set day=day-1 where user_id=$1", [c]);
await assert.rejects(() => reserve(c), /TRIAL_EXHAUSTED/);
await db.query(
  "update ai_members set valid_until=clock_timestamp()+interval '30 days' where user_id=$1",
  [c],
);
const upgraded = await reserve(c);
assert.equal(upgraded.entitlement, "paid");
assert.equal(upgraded.reserved_seconds, 240);
await finish(upgraded.id, true, c);
assert.equal(
  (
    await db.query(
      "select trial_used_seconds from ai_members where user_id=$1",
      [c],
    )
  ).rows[0].trial_used_seconds,
  180,
);
await db.exec(
  `set role authenticated; select set_config('test.uid','${b}',false);`,
);
assert.equal((await db.query("select user_id from ai_members")).rows.length, 1);
assert.equal(
  (await db.query("select user_id from ai_members")).rows[0].user_id,
  b,
);
await assert.rejects(
  () => db.query(`select ai_reserve($1,'us-female')`, [b]),
  /permission denied/,
);
await assert.rejects(
  () => db.query("select * from ai_payments"),
  /permission denied/,
);
await assert.rejects(
  () => db.query("select * from ai_sessions"),
  /permission denied/,
);
await assert.rejects(
  () =>
    db.query(
      `update ai_members set valid_until=now()+interval '1 year' where user_id=$1`,
      [b],
    ),
  /permission denied/,
);
await db.exec("reset role; set role anon");
await assert.rejects(
  () => db.query("select * from ai_members"),
  /permission denied/,
);
await assert.rejects(
  () => db.query("select * from ai_learning_summaries"),
  /permission denied/,
);
await db.exec("reset role");
const summarySession = (
  await db.query("select id,day from ai_sessions where user_id=$1 limit 1", [a])
).rows[0];
await db.query(
  "insert into ai_learning_summaries(session_id,user_id,day,status,summary) values($1,$2,$3,'ready','{}')",
  [summarySession.id, a, summarySession.day],
);
await assert.rejects(
  () =>
    db.query(
      "insert into ai_learning_summaries(session_id,user_id,day) values($1,$2,$3)",
      [summarySession.id, a, summarySession.day],
    ),
  /duplicate key/,
);
const activity = (
  await db.query(
    "select ai_monthly_activity($1,'2020-01-01','2040-01-01') as report",
    [a],
  )
).rows[0].report;
assert.ok(activity.seconds >= 600);
assert.ok(activity.days >= 1);
assert.equal(
  (
    await db.query(
      "select ai_monthly_activity($1,'2020-01-01','2020-02-01') as report",
      [a],
    )
  ).rows[0].report.seconds,
  0,
);
await db.exec(
  `set role authenticated; select set_config('test.uid','${b}',false)`,
);
assert.equal(
  (await db.query("select * from ai_learning_summaries")).rows.length,
  0,
);
await db.exec(`select set_config('test.uid','${a}',false)`);
assert.equal(
  (await db.query("select * from ai_learning_summaries")).rows.length,
  1,
);
await assert.rejects(
  () => db.query("delete from ai_learning_summaries"),
  /permission denied/,
);
await assert.rejects(
  () =>
    db.query("select ai_monthly_activity($1,'2020-01-01','2040-01-01')", [b]),
  /permission denied/,
);
await assert.rejects(
  () =>
    db.query("select ai_store_learning_summary($1,$2,now(),'{}')", [
      a,
      summarySession.id,
    ]),
  /permission denied/,
);
await db.exec("reset role");
const consentAt = "2001-01-01T00:00:00Z",
  newConsent = "2002-01-01T00:00:00Z";
const summaryStore = async (user = a, consent = consentAt) =>
  (
    await db.query(
      "select ai_store_learning_summary($1,$2,$3,'{\"topics\":[]}'::jsonb) as saved",
      [user, summarySession.id, consent],
    )
  ).rows[0].saved;
await db.query(
  "update ai_members set learning_summary_consent_at=$2 where user_id=$1",
  [a, consentAt],
);
await db.query(
  "update ai_learning_summaries set status='pending',summary=null where session_id=$1",
  [summarySession.id],
);
assert.equal(await summaryStore(b), false); // Another owner cannot touch the pending row.
assert.equal(await summaryStore(), true);
assert.equal(await summaryStore(), false); // Replay cannot overwrite a ready summary.
await db.query(
  "update ai_learning_summaries set status='pending',summary=null where session_id=$1",
  [summarySession.id],
);
await db.query(
  "update ai_members set learning_summary_consent_at=null where user_id=$1",
  [a],
);
assert.equal(await summaryStore(), false);
assert.equal(
  (
    await db.query(
      "select summary from ai_learning_summaries where session_id=$1",
      [summarySession.id],
    )
  ).rows[0].summary,
  null,
);
await db.query(
  "update ai_members set learning_summary_consent_at=$2 where user_id=$1",
  [a, newConsent],
);
await db.query(
  "update ai_learning_summaries set status='pending' where session_id=$1",
  [summarySession.id],
);
assert.equal(await summaryStore(), false); // Old in-flight analysis cannot use a renewed consent.
await db.query(
  "update ai_learning_summaries set status='pending' where session_id=$1",
  [summarySession.id],
);
assert.equal(await summaryStore(a, newConsent), true);
await db.query(
  "update ai_members set learning_summary_consent_at=null where user_id=$1",
  [a],
);
assert.equal(await summaryStore(a, newConsent), false);
assert.notEqual(
  (
    await db.query(
      "select summary from ai_learning_summaries where session_id=$1",
      [summarySession.id],
    )
  ).rows[0].summary,
  null,
); // Opt-out retains existing records.
console.log(
  "PASS: withdrawn/renewed consent blocks in-flight results, owner binding, one-time save, existing record preservation and RPC grants.",
);
console.log(
  "PASS: learning summary ownership/RLS, duplicate API claim exclusion, monthly activity bounds and server-only RPC.",
);
console.log(
  "PASS: migration; expired pass; duplicate tabs; ownership; failure refund; idempotent finish; 600-second cap; payment key binding; activation replay; 30-day extension; RLS; RPC grants; 180-second lifetime trial, pause/refund/rejoin, no signup reset, paid/trial separation.",
);
await db.close();
