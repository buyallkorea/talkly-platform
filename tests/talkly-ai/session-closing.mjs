import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;`,
);
for (const name of [
  "20261025002307_talkly_ai.sql",
  "20261025005457_talkly_ai_signup_trial.sql",
  "20261025110204_talkly_ai_session_closing.sql",
])
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/" + name, import.meta.url),
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
await db.exec("set role service_role");
const lease = await one("select public.ai_reserve($1,'us-female') v", [a]);
await assert.rejects(
  one("select public.ai_begin_close($1,$2) v", [b, lease.id]),
);
const closing = await one("select public.ai_begin_close($1,$2) v", [
  a,
  lease.id,
]);
assert.equal(closing.state, "closing");
assert.equal(closing.call_id, null);
assert.equal(
  (
    await db.query(
      "update ai_sessions set call_id='rtc_late',state='active' where id=$1 and user_id=$2 and state='connecting' and deadline>now() returning id",
      [lease.id, a],
    )
  ).rows.length,
  0,
);
assert.equal(
  await one("select trial_used_seconds v from ai_members where user_id=$1", [
    a,
  ]),
  180,
);
await assert.rejects(one("select public.ai_reserve($1,'us-female') v", [a]));
assert.equal(
  (await one("select public.ai_begin_close($1,$2) v", [a, lease.id])).state,
  "closing",
);
const finished = await one("select public.ai_finish($1,$2,true) v", [
  a,
  lease.id,
]);
assert.equal(finished.state, "closed");
assert.equal(finished.charged_seconds, 0);
await one("select public.ai_finish($1,$2,true) v", [a, lease.id]);
assert.equal(
  await one("select trial_used_seconds v from ai_members where user_id=$1", [
    a,
  ]),
  0,
);
const attached = await one("select public.ai_reserve($1,'us-female') v", [a]);
await db.query(
  "update ai_sessions set call_id='rtc_attached',state='active' where id=$1",
  [attached.id],
);
const snapshot = await one("select public.ai_begin_close($1,$2) v", [
  a,
  attached.id,
]);
assert.equal(snapshot.call_id, "rtc_attached");
assert.equal(snapshot.state, "closing");
await db.exec("reset role;set role authenticated");
await assert.rejects(
  one("select public.ai_begin_close($1,$2) v", [a, attached.id]),
);
await db.exec("reset role;set role anon");
await assert.rejects(
  one("select public.ai_begin_close($1,$2) v", [a, attached.id]),
);
await db.close();
console.log(
  "PASS: closing blocks late attachment/new reservation, quota held until finish, idempotent refund, attached call snapshot, owner and RPC isolation",
);
