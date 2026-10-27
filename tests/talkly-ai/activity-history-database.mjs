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
  "20261025130957_talkly_ai_activity_history.sql",
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
async function add(user, day, state, charged) {
  await db.query(
    "insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,deadline,state,charged_seconds) values($1,'us-female',$2,240,now(),$3,$4)",
    [user, day, state, charged],
  );
}
await add(a, "2024-02-29", "closed", 120);
await add(a, "2024-02-29", "closed", 60);
await add(a, "2024-03-01", "closed", 30);
await add(a, "2024-03-02", "active", 200);
await add(a, "2024-03-03", "closed", 0);
await add(a, "2024-04-01", "closed", 100);
await add(b, "2024-02-29", "closed", 240);
const history = async (from, to, user = a) =>
  (
    await db.query(
      "select month::text,seconds::integer,days,segments from public.ai_activity_history($1,$2,$3)",
      [user, from, to],
    )
  ).rows;
await db.exec("set role service_role");
assert.deepEqual(await history("2024-01-01", "2024-04-01"), [
  { month: "2024-01-01", seconds: 0, days: 0, segments: 0 },
  { month: "2024-02-01", seconds: 180, days: 1, segments: 2 },
  { month: "2024-03-01", seconds: 30, days: 1, segments: 1 },
]);
assert.equal((await history("2024-02-01", "2024-03-01", b))[0].seconds, 240);
for (const [from, to] of [
  ["2024-01-01", "2024-05-01"],
  ["2024-01-02", "2024-04-01"],
  ["2024-03-01", "2024-03-01"],
  ["2099-01-01", "2099-02-01"],
])
  await assert.rejects(history(from, to));
await db.exec("reset role;set role authenticated");
await assert.rejects(history("2024-01-01", "2024-04-01"));
await db.exec("reset role;set role anon");
await assert.rejects(history("2024-01-01", "2024-04-01"));
await db.close();
console.log(
  "PASS: grouped owner totals, leap day, distinct learning days, explicit empty months, exclusive month end, active/zero exclusion, bounded range and server-only access",
);
