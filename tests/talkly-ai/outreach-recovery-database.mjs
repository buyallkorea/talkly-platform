import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;create table public.profiles(id uuid primary key,role text);grant select on public.profiles to service_role;`,
);
for (const name of [
  "20261025002307_talkly_ai.sql",
  "20261025005457_talkly_ai_signup_trial.sql",
  "20261025092634_talkly_ai_outreach_consent.sql",
  "20261025095208_talkly_ai_outreach_outbox.sql",
  "20261025233143_talkly_ai_outreach_delivery.sql",
]) {
  const sql = await readFile(
    new URL("../../supabase/migrations/" + name, import.meta.url),
    "utf8",
  );
  await db.exec(sql.split("-- CRON:")[0]);
}
const owner = "11111111-1111-4111-8111-111111111111",
  token = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333";
await db.query("insert into auth.users values($1)", [owner]);
await db.query("insert into profiles values($1,'student')", [owner]);
await db.query(
  "insert into ai_members(user_id,consent_version,trial_used_seconds) values($1,'2026-10-25-v2-adult19',120)",
  [owner],
);
const session = (
  await db.query(
    "insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline,state,charged_seconds,ended_at) values($1,'us-female',current_date,180,now()-interval '48 hours','closed',120,now()-interval '48 hours') returning ended_at::text",
    [owner],
  )
).rows[0];
await db.exec("set role service_role");
await db.query(
  "select ai_set_outreach_consent($1,'email',true,'2026-10-25-outreach-v1')",
  [owner],
);
let n = 0;
async function job(attempts = 1) {
  return (
    await db.query(
      "insert into ai_outreach_outbox(user_id,kind,channel,activity_anchor,event_anchor,consent_revision,state,claim_token,claimed_at,preparation_attempts) values($1,'trial_followup','email',$2,'2026-01-01'::timestamptz+($3*interval '1 day'),1,'sending',$4,now(),$5) returning id",
      [owner, session.ended_at, ++n, token, attempts],
    )
  ).rows[0].id;
}
const one = async (sql, args) => (await db.query(sql, args)).rows[0].v;
const first = await job();
assert.equal(
  await one("select ai_release_outreach($1,$2) v", [first, other]),
  null,
);
assert.equal(
  await one("select ai_release_outreach($1,$2) v", [first, token]),
  "pending",
);
const released = (
  await db.query(
    "select state,claim_token,claimed_at,retry_after>now() as delayed,preparation_attempts from ai_outreach_outbox where id=$1",
    [first],
  )
).rows[0];
assert.equal(released.claim_token, null);
assert.equal(released.claimed_at, null);
assert.equal(released.delayed, true);
assert.equal(released.preparation_attempts, 1);
assert.equal(await one("select ai_claim_outreach($1) v", [first]), null);
const last = await job(3);
assert.equal(
  await one("select ai_release_outreach($1,$2) v", [last, token]),
  "failed",
);
assert.equal(await one("select ai_claim_outreach($1) v", [last]), null);
const skipped = await job();
assert.equal(
  await one("select ai_finish_outreach($1,$2,'skipped',null) v", [
    skipped,
    token,
  ]),
  true,
);
assert.equal(
  await one("select ai_release_outreach($1,$2) v", [skipped, token]),
  null,
);
const bad = await job();
await assert.rejects(
  one("select ai_finish_outreach($1,$2,'skipped','provider') v", [bad, token]),
);
const uncertain = await job();
await db.query(
  "update ai_outreach_outbox set claimed_at=now()-interval '6 minutes' where id=$1",
  [uncertain],
);
await one("select ai_expire_outreach_claims() v", []);
assert.equal(
  await one("select state v from ai_outreach_outbox where id=$1", [uncertain]),
  "unknown",
);
assert.equal(
  await one("select ai_release_outreach($1,$2) v", [uncertain, token]),
  null,
);
assert.equal(await one("select ai_claim_outreach($1) v", [uncertain]), null);
for (const role of ["anon", "authenticated"]) {
  await db.exec("reset role;set role " + role);
  await assert.rejects(
    one("select ai_release_outreach($1,$2) v", [bad, token]),
  );
  await assert.rejects(
    one("select ai_finish_outreach($1,$2,'skipped',null) v", [bad, token]),
  );
}
await db.close();
console.log(
  "PASS: token-bound pre-send release, cooldown timestamp, three-preparation cap, explicit not-sent skip, stale sending -> terminal unknown and no requeue, service-only RPC; cron schedule not executed locally",
);
