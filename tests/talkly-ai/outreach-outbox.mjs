import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table public.profiles(id uuid primary key,role text);grant all on public.profiles to service_role;`,
);
for (const name of [
  "20261025002307_talkly_ai.sql",
  "20261025005457_talkly_ai_signup_trial.sql",
  "20261025092634_talkly_ai_outreach_consent.sql",
  "20261025095208_talkly_ai_outreach_outbox.sql",
])
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/" + name, import.meta.url),
      "utf8",
    ),
  );
const user = "11111111-1111-4111-8111-111111111111";
await db.query("insert into auth.users values($1)", [user]);
await db.query("insert into profiles values($1,'student')", [user]);
await db.query(
  "insert into ai_members(user_id,consent_version,trial_used_seconds) values($1,'2026-10-25-v2-adult19',30)",
  [user],
);
const anchor = (await db.query("select now()-interval '2 days' as t")).rows[0]
  .t;
await db.query(
  "insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline,state,charged_seconds,ended_at) values($1,'us-female',current_date,30,now(),'closed',30,$2)",
  [user, anchor],
);
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0].v;
const enqueue = () =>
  one("select public.ai_enqueue_outreach($1,'trial_followup',$2,'kakao',1) v", [
    user,
    anchor,
  ]);
await db.exec("set role service_role");
assert.equal(await enqueue(), null);
await db.query(
  "select public.ai_set_outreach_consent($1,'kakao',true,'2026-10-25-outreach-v1')",
  [user],
);
const id = await enqueue();
assert.ok(id);
assert.equal(await enqueue(), null);
await db.query("update profiles set role='teacher' where id=$1", [user]);
assert.equal(
  await one(
    "select public.ai_outreach_eligible($1,'trial_followup',$2,'kakao',1) v",
    [user, anchor],
  ),
  false,
);
await db.query("update profiles set role='student' where id=$1", [user]);
await db.query(
  "insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline) values($1,'us-female',current_date,30,now())",
  [user],
);
assert.equal(
  await one(
    "select public.ai_outreach_eligible($1,'trial_followup',$2,'kakao',1) v",
    [user, anchor],
  ),
  false,
);
await db.query(
  "update ai_sessions set state='closed',charged_seconds=0,ended_at=now() where user_id=$1 and state<>'closed'",
  [user],
);
await db.query(
  "insert into ai_payments(user_id,order_id,amount,status) values($1,'pending-test',13900,'confirming')",
  [user],
);
assert.equal(
  await one(
    "select public.ai_outreach_eligible($1,'trial_followup',$2,'kakao',1) v",
    [user, anchor],
  ),
  false,
);
await db.query(
  "update ai_payments set status='failed' where order_id='pending-test'",
);
assert.equal(
  await one(
    "select public.ai_outreach_eligible($1,'trial_followup',$2,'kakao',1) v",
    [user, anchor],
  ),
  true,
);

assert.equal(
  await one(
    "select public.ai_enqueue_outreach($1,'trial_followup',$2,'email',1) v",
    [user, anchor],
  ),
  null,
);
await db.query(
  "select public.ai_set_outreach_consent($1,'kakao',false,'2026-10-25-outreach-v1')",
  [user],
);
assert.equal(await one("select public.ai_claim_outreach($1) v", [id]), null);
assert.equal(
  await one("select state v from ai_outreach_outbox where id=$1", [id]),
  "skipped",
);
await db.query(
  "select public.ai_set_outreach_consent($1,'kakao',true,'2026-10-25-outreach-v1')",
  [user],
);
assert.equal(
  await one(
    "select public.ai_enqueue_outreach($1,'trial_followup',$2,'kakao',3) v",
    [user, anchor],
  ),
  null,
);
// Paid event per expiry, then renewal between queue and dispatch.
await db.query("update ai_members set valid_until=$2 where user_id=$1", [
  user,
  anchor,
]);
await db.query(
  "insert into ai_payments(user_id,order_id,amount,status) values($1,'outbox-test',13900,'paid')",
  [user],
);
const paid = await one(
  "select public.ai_enqueue_outreach($1,'pass_expired',$2,'kakao',3) v",
  [user, anchor],
);
assert.ok(paid);
await db.query(
  "update ai_members set valid_until=now()+interval '30 days' where user_id=$1",
  [user],
);
assert.equal(await one("select public.ai_claim_outreach($1) v", [paid]), null);
assert.equal(
  await one("select state v from ai_outreach_outbox where id=$1", [paid]),
  "skipped",
);
// Fresh expiry is a distinct event; unknown outcomes are terminal.
const expiry = (await db.query("select now()-interval '3 days' as t")).rows[0]
  .t;
await db.query("update ai_members set valid_until=$2 where user_id=$1", [
  user,
  expiry,
]);
const next = await one(
  "select public.ai_enqueue_outreach($1,'pass_expired',$2,'kakao',3) v",
  [user, expiry],
);
assert.ok(next);
const claim = await one("select public.ai_claim_outreach($1) v", [next]);
const hour = await one(
  "select extract(hour from now() at time zone 'Asia/Seoul')::integer v",
);
if (hour >= 9 && hour < 18) {
  assert.ok(claim.claim_token);
  assert.equal(
    await one("select public.ai_claim_outreach($1) v", [next]),
    null,
  );
} else {
  assert.equal(claim, null);
  assert.equal(
    await one("select state v from ai_outreach_outbox where id=$1", [next]),
    "pending",
  );
}
// Explicit fixture simulates a worker crash even when this test runs at night.
const token = "22222222-2222-4222-8222-222222222222";
await db.query(
  "update ai_outreach_outbox set state='sending',claim_token=$2,claimed_at=now()-interval '6 minutes' where id=$1",
  [next, token],
);
assert.equal(
  await one(
    "select public.ai_finish_outreach($1,gen_random_uuid(),'accepted',null) v",
    [next],
  ),
  false,
);
assert.equal(await one("select public.ai_expire_outreach_claims() v"), 1);
assert.equal(
  await one("select public.ai_finish_outreach($1,$2,'accepted',null) v", [
    next,
    token,
  ]),
  false,
);
assert.equal(
  await one("select state v from ai_outreach_outbox where id=$1", [next]),
  "unknown",
);
assert.equal(
  await one(
    "select public.ai_enqueue_outreach($1,'pass_expired',$2,'kakao',3) v",
    [user, expiry],
  ),
  null,
);
await db.query(
  "update ai_outreach_outbox set state='sending',claim_token=$2,claimed_at=now() where id=$1",
  [paid, token],
);
assert.equal(
  await one(
    "select public.ai_finish_outreach($1,$2,'accepted','provider-test') v",
    [paid, token],
  ),
  true,
);
assert.equal(
  await one("select public.ai_finish_outreach($1,$2,'failed',null) v", [
    paid,
    token,
  ]),
  false,
);
await assert.rejects(
  one("select public.ai_finish_outreach($1,$2,'sent',null) v", [paid, token]),
);
await db.exec("reset role;set role authenticated");
await assert.rejects(db.query("select * from ai_outreach_outbox"));
await assert.rejects(db.query("select public.ai_claim_outreach($1)", [next]));
await db.exec("reset role;set role anon");
await assert.rejects(db.query("select * from ai_outreach_outbox"));
await db.close();
console.log(
  "PASS: opt-in required, unique event/channel dedup, withdrawal/renewal recheck, KST hour gate, claim token, crash->unknown without retry, server-only access",
);
