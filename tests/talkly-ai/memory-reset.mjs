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
  "20261025144748_talkly_ai_memory_reset.sql",
])
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/" + f, import.meta.url),
      "utf8",
    ),
  );
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
await db.query("insert into auth.users values($1),($2)", [a, b]);
await db.query(
  `insert into ai_members(user_id,consent_version,memory,memory_session_at,status,valid_until) values($1,'old','[{"role":"user","text":"private"}]',now()-interval '1 hour','suspended',now()+interval '30 days'),($2,'old','[{"role":"user","text":"other"}]',now(),'active',null)`,
  [a, b],
);
const before = (await db.query("select * from ai_members order by user_id"))
  .rows;
await db.exec("set role service_role");
const result = (await db.query("select ai_clear_memory($1) cleared", [a]))
  .rows[0].cleared;
assert.ok(result);
let rows = (await db.query("select * from ai_members order by user_id")).rows;
assert.deepEqual(rows[0].memory, []);
assert.deepEqual(rows[1], before[1]);
for (const key of Object.keys(before[0]).filter(
  (k) => !["memory", "memory_session_at"].includes(k),
))
  assert.deepEqual(rows[0][key], before[0][key]);
// Actual checkpoint conditional, late writes from old sessions must change zero rows.
const checkpoint = async (date, text) =>
  db.query(
    `update ai_members set memory=$3::jsonb,memory_session_at=$2 where user_id=$1 and (memory_session_at is null or memory_session_at<=$2) returning memory`,
    [a, date, JSON.stringify([{ role: "user", text }])],
  );
assert.equal(
  (await checkpoint(before[0].memory_session_at, "late old private")).rows
    .length,
  0,
);
assert.equal(
  (
    await checkpoint(
      new Date(Date.parse(result) + 10000).toISOString(),
      "new session",
    )
  ).rows.length,
  1,
);
await db.query("select ai_clear_memory($1)", [a]);
assert.equal((await checkpoint(result, "late cleared")).rows.length, 0);
assert.deepEqual(
  (await db.query("select memory from ai_members where user_id=$1", [a]))
    .rows[0].memory,
  [],
);
await assert.rejects(
  db.query("select ai_clear_memory($1)", [
    "33333333-3333-4333-8333-333333333333",
  ]),
);
for (const role of ["anon", "authenticated"]) {
  await db.exec("reset role;set role " + role);
  await assert.rejects(db.query("select ai_clear_memory($1)", [a]));
}
await db.close();
console.log(
  "PASS: owner-only memory clearing, suspended access, stale checkpoint fence, new-session persistence, repeated clear, preserved entitlement/consent/other member, server-only execution",
);
