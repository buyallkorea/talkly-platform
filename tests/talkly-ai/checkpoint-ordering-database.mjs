import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const { PGlite } = await import(process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create table public.profiles(id uuid primary key, role text);
    grant select on public.profiles to service_role;
    create schema cron; create table cron.job(jobname text primary key,schedule text,command text);
    create function cron.schedule(text,text,text) returns bigint language sql as $$
      insert into cron.job values($1,$2,$3) on conflict(jobname) do update
      set schedule=excluded.schedule,command=excluded.command returning 1::bigint $$;
  `);
  const directory = new URL("../../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter((f) => f.includes("_talkly_ai") && f.endsWith(".sql")).sort();
  for (const file of files) {
    try { await db.exec(await readFile(new URL(file, directory), "utf8")); }
    catch (error) { throw new Error(`Migration failed: ${file}: ${error.message}`, { cause: error }); }
  }
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const writer = "33333333-3333-4333-8333-333333333333";
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query("insert into ai_members(user_id,consent_version) values($1,'test'),($2,'test')", [owner, other]);
  await db.exec("set role service_role");
  const lease = (await db.query("select ai_reserve($1,'calm-female') lease", [owner])).rows[0].lease;
  await db.query("update ai_sessions set checkpoint_writer=$2 where id=$1", [lease.id, writer]);
  const snapshot = (text) => JSON.stringify([{ role: "user", text }]);
  const checkpoint = (version, text, user = owner, token = writer) =>
    db.query("select ai_checkpoint_ordered($1,$2,$3,$4::jsonb,$5) ok", [user, lease.id, version, snapshot(text), token]);
  assert.equal((await checkpoint(2, "latest")).rows[0].ok, true);
  assert.equal((await checkpoint(2, "latest")).rows[0].ok, true, "exact replay is idempotent");
  await assert.rejects(checkpoint(1, "stale"), /STALE_CHECKPOINT/);
  await assert.rejects(checkpoint(2, "changed"), /STALE_CHECKPOINT/);
  await assert.rejects(checkpoint(3, "foreign", other), /SESSION_NOT_FOUND/);
  await assert.rejects(checkpoint(3, "wrong writer", owner, other), /CHECKPOINT_WRITER_CONFLICT/);
  await assert.rejects(checkpoint(3, "missing writer", owner, null), /INVALID_CHECKPOINT/);
  await assert.rejects(checkpoint(0, "invalid"), /INVALID_CHECKPOINT/);
  await db.exec("reset role");
  // Failure after the session update must roll back both session version and memory.
  await db.exec(`create function public.qa_reject_memory() returns trigger language plpgsql as $$
    begin raise exception 'QA_MEMORY_WRITE_FAILED'; end $$;
    create trigger qa_reject_memory before update of memory on ai_members
    for each row execute function public.qa_reject_memory();`);
  await db.exec("set role service_role");
  await assert.rejects(checkpoint(3, "must roll back"), /QA_MEMORY_WRITE_FAILED/);
  assert.equal((await db.query("select checkpoint_version from ai_sessions where id=$1", [lease.id])).rows[0].checkpoint_version, 2);
  assert.deepEqual((await db.query("select memory from ai_members where user_id=$1", [owner])).rows[0].memory, JSON.parse(snapshot("latest")));
  await db.exec("reset role; drop trigger qa_reject_memory on ai_members; drop function public.qa_reject_memory(); set role service_role");
  await db.query("select ai_clear_memory($1)", [owner]);
  await assert.rejects(checkpoint(3, "deleted memory"), /OLDER_SESSION_CHECKPOINT/);
  assert.deepEqual((await db.query("select memory from ai_members where user_id=$1", [owner])).rows[0].memory, []);
  for (const role of ["anon", "authenticated"]) {
    await db.exec("reset role; set role " + role);
    await assert.rejects(checkpoint(4, "unauthorized"), /permission denied/);
  }
  console.log(`PASS: all ${files.length} AI migrations apply; service-role grant, checkpoint replay/stale/owner/writer validation, atomic rollback, deletion fence and client denial`);
} finally { await db.close(); }
