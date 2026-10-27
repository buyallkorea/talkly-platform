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
  "20261025115633_talkly_ai_api_events.sql",
])
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/" + name, import.meta.url),
      "utf8",
    ),
  );
const user = "11111111-1111-4111-8111-111111111111";
await db.query("insert into auth.users values($1)", [user]);
await db.query(
  "insert into ai_members(user_id,consent_version) values($1,'test')",
  [user],
);
const id = (
  await db.query(
    "insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline) values($1,'us-female',current_date,30,now()) returning id",
    [user],
  )
).rows[0].id;
await db.exec("set role service_role");
const sql =
  "insert into ai_api_events(session_id,kind,model,outcome,failure_kind,http_status,duration_ms) values($1,'voice_connect','gpt-realtime-2.1-mini','failed','rate_limit',429,100)";
await db.query(sql, [id]);
await assert.rejects(db.query(sql, [id]));
await assert.rejects(
  db.query("update ai_api_events set input_tokens=100 where session_id=$1", [
    id,
  ]),
);
await db.query(
  "insert into ai_api_events(session_id,kind,model,outcome,duration_ms,input_tokens,output_tokens,cached_input_tokens) values($1,'learning_summary','gpt-4.1-mini','succeeded',100,50,20,10)",
  [id],
);
await assert.rejects(
  db.query(
    "update ai_api_events set cached_input_tokens=51 where kind='learning_summary'",
  ),
);
await assert.rejects(
  db.query(
    "update ai_api_events set http_status=999 where kind='learning_summary'",
  ),
);
await db.exec("reset role;set role authenticated");
await assert.rejects(db.query("select * from ai_api_events"));
await assert.rejects(db.query("delete from ai_api_events"));
await db.exec("reset role;set role anon");
await assert.rejects(db.query("select * from ai_api_events"));
await db.close();
console.log(
  "PASS: server-only metadata, unique session/request kind, token/status constraints and client isolation",
);
