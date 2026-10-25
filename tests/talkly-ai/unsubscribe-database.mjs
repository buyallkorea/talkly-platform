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
  "20261025092634_talkly_ai_outreach_consent.sql",
  "20261025224601_talkly_ai_unsubscribe.sql",
])
  await db.exec(
    await readFile(
      new URL("../../supabase/migrations/" + f, import.meta.url),
      "utf8",
    ),
  );
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  hash = "a".repeat(64);
await db.query("insert into auth.users values($1),($2)", [a, b]);
await db.query(
  "insert into ai_members(user_id,consent_version) values($1,'test'),($2,'test')",
  [a, b],
);
await db.exec("set role service_role");
const consent = (u, c, on) =>
  db.query(
    "select ai_set_outreach_consent($1,$2,$3,'2026-10-25-outreach-v1')",
    [u, c, on],
  );
for (const u of [a, b])
  for (const c of ["email", "kakao"]) await consent(u, c, true);
await db.query(
  "insert into ai_outreach_unsubscribe_tokens(token_hash,user_id,channel) values($1,$2,'email')",
  [hash, a],
);
await db.query("update ai_members set status='suspended' where user_id=$1", [
  a,
]);
const withdraw = async (h) =>
  (await db.query("select ai_unsubscribe_outreach($1) v", [h])).rows[0].v;
assert.equal(await withdraw("invalid"), false);
assert.equal(await withdraw("b".repeat(64)), false);
assert.equal(await withdraw(hash), true);
const rows = (
  await db.query(
    "select user_id,channel,enabled,revision from ai_outreach_preferences order by user_id,channel",
  )
).rows;
assert.equal(rows.filter((r) => !r.enabled).length, 1);
assert.equal(
  rows.find((r) => r.user_id === a && r.channel === "email").revision,
  2,
);
const count = async () =>
  (await db.query("select count(*)::integer n from ai_outreach_consent_events"))
    .rows[0].n;
const auditCount = await count();
assert.equal(await withdraw(hash), true);
assert.equal(await count(), auditCount);
assert.equal(
  (await db.query("select status from ai_members where user_id=$1", [a]))
    .rows[0].status,
  "suspended",
);
for (const role of ["anon", "authenticated"]) {
  await db.exec("reset role;set role " + role);
  await assert.rejects(
    db.query("select * from ai_outreach_unsubscribe_tokens"),
  );
  await assert.rejects(db.query("delete from ai_outreach_unsubscribe_tokens"));
  await assert.rejects(withdraw(hash));
}
await db.close();
console.log(
  "PASS: hash capability targets one stored owner/channel, suspended withdrawal, invalid/unknown isolation, idempotent consent audit and server-only token/RPC access",
);
