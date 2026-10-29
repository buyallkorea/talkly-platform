import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
const {PGlite}=await import(process.env.TALKLY_AI_PGLITE_MODULE || "@electric-sql/pglite");
const db=new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 grant usage on schema auth to authenticated,service_role;
 grant execute on function auth.uid(),auth.role() to authenticated,service_role;`);
 await db.exec(await readFile(new URL('../fixtures/talkly-ai-signup-prerequisites.sql',import.meta.url),'utf8'));
 const student='11111111-1111-4111-8111-111111111111';
 const parent='22222222-2222-4222-8222-222222222222';
 const other='33333333-3333-4333-8333-333333333333';
 // Auth insertion executes the production-shaped trigger, not direct profile fixtures.
 await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2),($3,$4),($5,$6)",[
  student,JSON.stringify({name:'Synthetic Student',role:'admin',phone:'010-0000-0000'}),
  parent,JSON.stringify({name:'Synthetic Parent',role:'parent'}),other,JSON.stringify({name:'Other Student',role:'teacher'})]);
 assert.equal((await db.query('select role from profiles where id=$1',[student])).rows[0].role,'student','user-editable admin claim cannot grant admin');
 assert.equal((await db.query('select role from profiles where id=$1',[other])).rows[0].role,'student','user-editable teacher claim cannot grant teacher');
 assert.equal((await db.query('select phone from profiles where id=$1',[student])).rows[0].phone,'01000000000');
 assert.equal((await db.query('select count(*)::int n from student_profiles')).rows[0].n,2);
 assert.equal((await db.query('select user_id from parent_profiles')).rows[0].user_id,parent);
 await db.exec(`select set_config('request.jwt.claim.sub','${student}',false);select set_config('request.jwt.claim.role','authenticated',false);set role authenticated`);
 assert.deepEqual((await db.query('select id from profiles')).rows.map(r=>r.id),[student]);
 await db.query("update profiles set name='Updated Synthetic Name' where id=$1",[student]);
 await assert.rejects(db.query("update profiles set role='admin' where id=$1",[student]),/Only administrators/);
 for(const table of ['profiles','student_profiles','parent_profiles','admin_profiles','phone_verifications']){
  assert.equal((await db.query("select has_table_privilege(current_user,$1,'TRUNCATE') allowed",[table])).rows[0].allowed,false);
 }
 await db.exec('reset role');
 // Same signup prerequisites must also support the complete AI migration chain.
 await db.exec(`create schema cron;create table cron.job(jobname text primary key,schedule text,command text);
 create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning 1::bigint$$;`);
 const directory=new URL('../../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(directory)).filter(f=>f.includes('_talkly_ai')&&f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,directory),'utf8'));
 await db.exec('set role service_role');
 await db.query("insert into ai_members(user_id,consent_version) values($1,'2026-10-25-v2-adult19'),($2,'2026-10-25-v2-adult19')",[student,parent]);
 for(const id of [student,parent]){
  const lease=(await db.query("select ai_reserve($1,'calm-female') lease",[id])).rows[0].lease;
  assert.equal(lease.reserved_seconds,180);
  await db.query('select ai_finish($1,$2,true)',[id,lease.id]);
 }
 console.log('PASS: signup trigger/profile creation, student/parent roles, privilege-spoof rejection, profile RLS/role guard, no client TRUNCATE, all AI migrations and first trial for both roles');
}finally{await db.close();}
