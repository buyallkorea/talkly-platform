import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;create table public.profiles(id uuid primary key,role text);grant select on public.profiles to service_role;`,
);
for (const f of [
  "20261025002307_talkly_ai.sql",
  "20261025144334_talkly_ai_refund_review.sql",
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
await db.query("insert into profiles values($1,'admin'),($2,'student')", [
  a,
  b,
]);
await db.query(
  "insert into ai_members(user_id,consent_version,status,valid_until) values($1,'old','suspended',now()+interval '30 days'),($2,'old','active',null)",
  [a, b],
);
await db.query(
  "insert into ai_payments(user_id,order_id,status,amount) values($1,'test_order_paid','paid',13900),($1,'test_order_ready','ready',13900)",
  [a],
);
const before = await db.query("select * from ai_members order by user_id");
await db.exec("set role service_role");
const request = async (user, order, reason = "unused") =>
  (
    await db.query("select ai_request_refund($1,$2,$3) id", [
      user,
      order,
      reason,
    ])
  ).rows[0].id;
const id = await request(a, "test_order_paid");
assert.equal(await request(a, "test_order_paid", "quality"), id);
await assert.rejects(request(b, "test_order_paid"));
await assert.rejects(request(a, "test_order_ready"));
await assert.rejects(request(a, "test_order_paid", "invented"));
const review = (actor, revision, state) =>
  db.query("select ai_review_refund($1,$2,$3,$4) revision", [
    actor,
    id,
    revision,
    state,
  ]);
await assert.rejects(review(b, 0, "reviewing"));
await assert.rejects(review(a, 0, "awaiting_action"));
assert.equal((await review(a, 0, "reviewing")).rows[0].revision, 1);
await assert.rejects(review(a, 0, "awaiting_action"));
assert.equal((await review(a, 1, "awaiting_action")).rows[0].revision, 2);
assert.equal((await review(a, 2, "reviewing")).rows[0].revision, 3);
assert.equal(
  (await db.query("select count(*)::integer n from ai_refund_reviews")).rows[0]
    .n,
  3,
);
assert.equal(
  (await db.query("select count(*)::integer n from ai_refund_requests")).rows[0]
    .n,
  1,
);
assert.deepEqual(
  (await db.query("select * from ai_members order by user_id")).rows,
  before.rows,
);
assert.equal(
  (
    await db.query(
      "select status from ai_payments where order_id='test_order_paid'",
    )
  ).rows[0].status,
  "paid",
);
for (const role of ["anon", "authenticated"]) {
  await db.exec("reset role;set role " + role);
  for (const table of ["ai_refund_requests", "ai_refund_reviews"]) {
    await assert.rejects(db.query("select * from " + table));
    await assert.rejects(db.query("delete from " + table));
  }
  await assert.rejects(request(a, "test_order_paid"));
  await assert.rejects(review(a, 3, "awaiting_action"));
}
await db.close();
console.log(
  "PASS: owner isolation, paid-only intake, suspended support, idempotent order intake, validated reason, admin-only transitions, stale revision rejection, atomic audit, unchanged payment/pass, server-only grants",
);
