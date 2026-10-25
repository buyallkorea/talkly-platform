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
      "../../supabase/migrations/20261024235249_talkly_ai.sql",
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
await assert.rejects(() => reserve(b), /PASS_EXPIRED/);
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
console.log(
  "PASS: migration; expired pass; duplicate tabs; ownership; failure refund; idempotent finish; 600-second cap; payment key binding; activation replay; 30-day extension; RLS; RPC grants.",
);
await db.close();
