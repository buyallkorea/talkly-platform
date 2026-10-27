import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to authenticated;`,
);
for (const name of [
  "20261025002307_talkly_ai.sql",
  "20261025005457_talkly_ai_signup_trial.sql",
  "20261025011913_talkly_ai_learning_summaries.sql",
  "20261025052121_talkly_ai_summary_preferences.sql",
  "20261025100553_talkly_ai_summary_deletion.sql",
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
  "insert into ai_members(user_id,consent_version,learning_summary_consent_at) values($1,'legacy',now()-interval '1 hour'),($2,'legacy',now()-interval '1 hour')",
  [a, b],
);
async function fixture(user, status) {
  const id = (
    await db.query(
      "insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline,state,charged_seconds,ended_at) values($1,'us-female',current_date,30,now(),'closed',30,now()) returning id",
      [user],
    )
  ).rows[0].id;
  await db.query(
    "insert into ai_learning_summaries(session_id,user_id,day,status,summary) values($1,$2,current_date,$3,$4)",
    [id, user, status, status === "ready" ? { topics: ["travel"] } : null],
  );
  return id;
}
const ready = await fixture(a, "ready"),
  pending = await fixture(a, "pending"),
  other = await fixture(b, "ready");
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0].v;
const consent = await one(
  "select learning_summary_consent_at v from ai_members where user_id=$1",
  [a],
);
await db.exec("set role service_role");
assert.equal(
  await one("select public.ai_delete_learning_summary($1,$2) v", [a, other]),
  false,
);
assert.equal(
  await one("select public.ai_delete_learning_summary($1,$2) v", [a, ready]),
  true,
);
const stamp = await one(
  "select deleted_at v from ai_learning_summaries where session_id=$1",
  [ready],
);
assert.equal(
  await one("select public.ai_delete_learning_summary($1,$2) v", [a, ready]),
  true,
);
assert.equal(
  String(
    await one(
      "select deleted_at v from ai_learning_summaries where session_id=$1",
      [ready],
    ),
  ),
  String(stamp),
);
assert.equal(
  await one("select summary v from ai_learning_summaries where session_id=$1", [
    ready,
  ]),
  null,
);
assert.equal(
  await one("select public.ai_delete_learning_summary($1,$2) v", [a, pending]),
  true,
);
assert.equal(
  await one("select public.ai_store_learning_summary($1,$2,$3,$4) v", [
    a,
    pending,
    consent,
    { topics: ["late"] },
  ]),
  false,
);
await assert.rejects(
  db.query(
    "insert into ai_learning_summaries(session_id,user_id,day) values($1,$2,current_date)",
    [ready, a],
  ),
);
assert.equal(await one("select count(*)::integer v from ai_sessions"), 3);
assert.deepEqual(
  await one("select summary v from ai_learning_summaries where session_id=$1", [
    other,
  ]),
  { topics: ["travel"] },
);
await db.query("update ai_members set status='suspended' where user_id=$1", [
  b,
]);
assert.equal(
  await one("select public.ai_delete_learning_summary($1,$2) v", [b, other]),
  true,
);
await db.exec("reset role");
await db.query("select set_config('test.uid',$1,false)", [a]);
await db.exec("set role authenticated");
assert.equal(
  (await db.query("select * from ai_learning_summaries")).rows.length,
  0,
);
await assert.rejects(
  db.query("select public.ai_delete_learning_summary($1,$2)", [a, ready]),
);
await assert.rejects(db.query("delete from ai_learning_summaries"));
await db.exec("reset role;set role anon");
await assert.rejects(
  db.query("select public.ai_delete_learning_summary($1,$2)", [a, ready]),
);
await db.close();
console.log(
  "PASS: content erased, owner-only/idempotent deletion, suspended/legacy access, pending save blocked, unique regeneration marker, RLS and session preservation",
);
