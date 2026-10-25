import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`,
);
for (const file of [
  "20261025002307_talkly_ai.sql",
  "20261025005457_talkly_ai_signup_trial.sql",
  "20261025122413_talkly_ai_connection_rate_limit.sql",
])
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/" + file, import.meta.url),
      "utf8",
    ),
  );
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
await db.query("insert into auth.users values($1),($2)", [a, b]);
await db.query(
  "insert into ai_members(user_id,consent_version) values($1,'test'),($2,'test')",
  [a, b],
);
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0].v;
const claim = (user) =>
  one("select public.ai_claim_connection_attempt($1) v", [user]);
await db.exec("set role service_role");
for (let i = 0; i < 6; i++) assert.equal((await claim(a)).allowed, true);
let blocked = await claim(a);
assert.equal(blocked.allowed, false);
assert.ok(
  blocked.retry_after_seconds >= 58 && blocked.retry_after_seconds <= 60,
);
assert.equal((await claim(a)).allowed, false);
assert.equal(
  await one(
    "select cardinality(attempts) v from ai_connection_rate_limits where user_id=$1",
    [a],
  ),
  6,
);
assert.equal((await claim(b)).allowed, true);
await db.query(
  "update ai_connection_rate_limits set attempts=array_fill(now()-interval '61 seconds',ARRAY[6]) where user_id=$1",
  [a],
);
assert.equal((await claim(a)).allowed, true);
await db.query(
  "update ai_connection_rate_limits set attempts=(select array_agg(now()-make_interval(secs=>n*119) order by n desc) from generate_series(0,29) n) where user_id=$1",
  [a],
);
blocked = await claim(a);
assert.equal(blocked.allowed, false);
assert.ok(
  blocked.retry_after_seconds > 60 && blocked.retry_after_seconds <= 150,
);
await db.query(
  "update ai_connection_rate_limits set attempts=array_prepend(now()-interval '1 hour 1 second',attempts[2:30]) where user_id=$1",
  [a],
);
assert.equal((await claim(a)).allowed, true);
assert.equal(
  await one(
    "select cardinality(attempts) v from ai_connection_rate_limits where user_id=$1",
    [a],
  ),
  30,
);
assert.equal(
  await one("select trial_used_seconds v from ai_members where user_id=$1", [
    a,
  ]),
  0,
);
assert.equal(await one("select count(*)::integer v from ai_sessions"), 0);
assert.equal(await one("select count(*)::integer v from ai_daily_usage"), 0);
const previous = (
  await db.query(
    "insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,started_at,deadline,state,charged_seconds,ended_at,call_id,entitlement) values($1,'us-female',current_date,240,now()-interval '241 seconds',now()-interval '1 second','closed',240,now(),'rtc_previous','paid') returning id",
    [a],
  )
).rows[0].id;
const renewal = await claim(a);
assert.equal(renewal.allowed, true);
assert.equal(renewal.automatic_renewal, true);
assert.equal(
  await one(
    "select cardinality(attempts) v from ai_connection_rate_limits where user_id=$1",
    [a],
  ),
  30,
);
assert.equal(
  await one(
    "select last_renewal_session_id v from ai_connection_rate_limits where user_id=$1",
    [a],
  ),
  previous,
);
assert.equal((await claim(a)).allowed, false);
await db.query("update ai_members set status='suspended' where user_id=$1", [
  b,
]);
await assert.rejects(claim(b));
await db.exec("reset role;set role authenticated");
await assert.rejects(claim(a));
await assert.rejects(db.query("select * from ai_connection_rate_limits"));
await db.exec("reset role;set role anon");
await assert.rejects(claim(a));
await db.close();
console.log(
  "PASS: six/minute and thirty/hour sliding windows, cooldown without extending blocks, per-user isolation, expiry pruning, no quota/session mutation server-verified one-time renewal exemption and server-only RPC",
);
