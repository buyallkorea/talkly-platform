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
  "20261025235259_talkly_ai_unattached_recovery.sql",
]) {
  await db.exec(
    (
      await readFile(
        new URL("../../supabase/migrations/" + name, import.meta.url),
        "utf8",
      )
    ).split("-- CRON:")[0],
  );
}
const owners = Array.from(
  { length: 6 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
for (const [i, owner] of owners.entries()) {
  await db.query("insert into auth.users values($1)", [owner]);
  await db.query(
    "insert into ai_members(user_id,consent_version,valid_until) values($1,'test',$2)",
    [owner, i === 1 ? new Date(Date.now() + 86400000).toISOString() : null],
  );
}
await db.exec("set role service_role");
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0].v;
const leases = [];
for (const owner of owners)
  leases.push(await one("select ai_reserve($1,'us-female') v", [owner]));
// Trial and paid expired negotiations, an expired close without a registered call,
// a future lease, a registered expired active call, and a registered close failure.
for (const i of [0, 1, 2, 4, 5])
  await db.query(
    "update ai_sessions set started_at=now()-interval '1 hour',deadline=now()-interval '30 minutes' where id=$1",
    [leases[i].id],
  );
await one("select ai_begin_close($1,$2) v", [owners[2], leases[2].id]);
await db.query(
  "update ai_sessions set call_id='rtc_active',state='active' where id=$1",
  [leases[4].id],
);
await db.query(
  "update ai_sessions set call_id='rtc_hangup_failed',state='closing' where id=$1",
  [leases[5].id],
);
assert.equal(await one("select ai_recover_unattached_sessions() v"), 3);
assert.equal(await one("select ai_recover_unattached_sessions() v"), 0);
for (const i of [0, 1, 2]) {
  const row = (
    await db.query(
      "select state,charged_seconds,ended_at from ai_sessions where id=$1",
      [leases[i].id],
    )
  ).rows[0];
  assert.equal(row.state, "closed");
  assert.equal(row.charged_seconds, 0);
  assert.ok(row.ended_at);
}
for (const i of [0, 2])
  assert.equal(
    await one("select trial_used_seconds v from ai_members where user_id=$1", [
      owners[i],
    ]),
    0,
  );
assert.equal(
  await one("select used_seconds v from ai_daily_usage where user_id=$1", [
    owners[1],
  ]),
  0,
);
for (const i of [3, 4, 5]) {
  assert.equal(
    await one("select charged_seconds v from ai_sessions where id=$1", [
      leases[i].id,
    ]),
    null,
  );
  assert.equal(
    await one("select trial_used_seconds v from ai_members where user_id=$1", [
      owners[i],
    ]),
    leases[i].reserved_seconds,
  );
}
// The same guarded attachment used by the API cannot attach after recovery.
assert.equal(
  (
    await db.query(
      "update ai_sessions set call_id='rtc_late',state='active' where id=$1 and user_id=$2 and state='connecting' and deadline>now() returning id",
      [leases[0].id, owners[0]],
    )
  ).rows.length,
  0,
);
// A new reservation is possible after recovery without replenishing consumed time.
assert.equal(
  (await one("select ai_reserve($1,'us-female') v", [owners[0]]))
    .reserved_seconds,
  180,
);
// Bound each scheduled transaction even when a large backlog exists.
await db.exec("reset role");
await db.exec(`insert into auth.users select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,101) n;
insert into ai_members(user_id,consent_version,trial_used_seconds) select id,'test',180 from auth.users where id::text like '10000000%';
insert into ai_sessions(user_id,tutor_id,day,reserved_seconds,started_at,deadline,entitlement) select id,'us-female',current_date,180,now()-interval '1 hour',now()-interval '30 minutes','trial' from auth.users where id::text like '10000000%';
set role service_role;`);
assert.equal(await one("select ai_recover_unattached_sessions() v"), 100);
assert.equal(await one("select ai_recover_unattached_sessions() v"), 1);
assert.equal(await one("select ai_recover_unattached_sessions() v"), 0);
for (const role of ["anon", "authenticated"]) {
  await db.exec("reset role;set role " + role);
  await assert.rejects(one("select ai_recover_unattached_sessions() v"));
}
await db.close();
console.log(
  "PASS: independent expired unattached trial/paid/closing recovery is idempotent; future and registered calls remain charged/reserved, late attach is denied, and ordinary users cannot run recovery; cron/concurrent locks are not simulated locally",
);
