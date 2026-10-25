import assert from "node:assert/strict";
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
  "20261025151758_talkly_ai_voice_usage.sql",
])
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/" + f, import.meta.url),
      "utf8",
    ),
  );
const owner = "11111111-1111-4111-8111-111111111111";
await db.query("insert into auth.users values($1)", [owner]);
await db.query(
  "insert into ai_members(user_id,consent_version) values($1,'test')",
  [owner],
);
const session = (
  await db.query(
    "insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline) values($1,'us-female',current_date,180,now()) returning id",
    [owner],
  )
).rows[0].id;
await db.exec("set role service_role");
await db.query(
  "insert into ai_voice_usage(session_id,response_id,model,status,input_tokens,output_tokens,cached_input_tokens,input_audio_tokens,input_text_tokens,cached_audio_tokens,cached_text_tokens) values($1,'resp_test','gpt-realtime-2.1-mini','completed',100,10,50,60,40,30,20)",
  [session],
);
await assert.rejects(
  db.query(
    "insert into ai_voice_usage(session_id,response_id,model,status,input_tokens,output_tokens) values($1,'resp_test','test','completed',100,10)",
    [session],
  ),
);
for (const patch of [
  "input_tokens=-1",
  "cached_input_tokens=101",
  "input_audio_tokens=70",
  "cached_audio_tokens=51",
  "output_audio_tokens=20",
  "response_id='bad'",
  "cached_input_tokens=null",
  "status='unknown'",
])
  await assert.rejects(
    db.query("update ai_voice_usage set " + patch + " where session_id=$1", [
      session,
    ]),
  );
await db.query(
  "insert into ai_voice_observations(session_id,state) values($1,'started')",
  [session],
);
await db.query(
  "update ai_voice_observations set state='stopped',reason='deadline',observed_responses=1,dropped_events=true,finished_at=now() where session_id=$1",
  [session],
);
await assert.rejects(
  db.query(
    "update ai_voice_observations set observed_responses=501 where session_id=$1",
    [session],
  ),
);
assert.equal(
  (
    await db.query(
      "select input_tokens,output_tokens from ai_voice_usage where session_id=$1",
      [session],
    )
  ).rows[0].input_tokens,
  100,
);
for (const role of ["anon", "authenticated"]) {
  await db.exec("reset role;set role " + role);
  for (const table of ["ai_voice_usage", "ai_voice_observations"]) {
    await assert.rejects(db.query("select * from " + table));
    await assert.rejects(db.query("delete from " + table));
    await assert.rejects(
      db.query("update " + table + " set session_id=$1", [session]),
    );
  }
}
await db.close();
console.log(
  "PASS: service-only voice metadata, response deduplication, token/cache subset constraints, observation limits and client read/write denial",
);
