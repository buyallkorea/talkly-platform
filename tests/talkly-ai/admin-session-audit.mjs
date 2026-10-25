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
  "20261025112815_talkly_ai_admin_session_actions.sql",
])
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/" + file, import.meta.url),
      "utf8",
    ),
  );
const owner = "11111111-1111-4111-8111-111111111111",
  actor = "22222222-2222-4222-8222-222222222222";
await db.query("insert into auth.users values($1),($2)", [owner, actor]);
await db.query(
  "insert into ai_members(user_id,consent_version) values($1,'test')",
  [owner],
);
const session = (
  await db.query(
    "insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline) values($1,'us-female',current_date,30,now()) returning id",
    [owner],
  )
).rows[0].id;
await db.exec("set role service_role");
const action = (
  await db.query(
    "insert into ai_session_admin_actions(actor_id,user_id,session_id,reason) values($1,$2,$3,'connection_issue') returning *",
    [actor, owner, session],
  )
).rows[0];
assert.equal(action.state, "started");
assert.equal(action.finished_at, null);
await db.query(
  "update ai_session_admin_actions set state='completed',finished_at=now() where id=$1",
  [action.id],
);
await assert.rejects(
  db.query("update ai_session_admin_actions set state='sent' where id=$1", [
    action.id,
  ]),
);
await db.exec("reset role;set role authenticated");
await assert.rejects(db.query("select * from ai_session_admin_actions"));
await assert.rejects(db.query("delete from ai_session_admin_actions"));
await db.exec("reset role;set role anon");
await assert.rejects(db.query("select * from ai_session_admin_actions"));
await db.close();
console.log(
  "PASS: server-only admin audit, constrained reason/result, request/result timestamps and client isolation",
);
