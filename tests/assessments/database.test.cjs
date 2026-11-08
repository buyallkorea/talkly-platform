const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('SQL enforces assignment, CAS, immutable audit, source lifecycle, access denial and atomic rollback',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table profiles(id uuid primary key,role text);
 create table enrollments(id bigint primary key,teacher_user_id uuid,is_test boolean);
 create table level_tests(id bigint primary key,status text,interview_status text,teacher_suggested_level text,final_level text,updated_at timestamptz);
 create table level_test_interviews(id bigint primary key,level_test_id bigint,tester_user_id uuid,started_at timestamptz,status text,created_at timestamptz default now(),suggested_level text,completed_at timestamptz,updated_at timestamptz);
 grant select,update on profiles,enrollments,level_tests,level_test_interviews to service_role;`);
 const teacher='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333',student='44444444-4444-4444-8444-444444444444';
 await db.query("insert into profiles values($1,'teacher'),($2,'teacher'),($3,'admin'),($4,'student')",[teacher,other,admin,student]);
 await db.query('insert into enrollments values(1,$1,false),(2,$1,true)',[teacher]);
 await db.query("insert into level_tests(id,status,final_level) values(1,'interview_scheduled','ADMIN_FINAL'),(2,'completed','ADMIN_FINAL')");
 await db.query("insert into level_test_interviews(id,level_test_id,tester_user_id,status,started_at) values(1,1,$1,'in_progress',now()),(2,2,$1,'completed',now())",[teacher]);
 const migrations=path.resolve(__dirname,'../../supabase/migrations');
 const migration=fs.readdirSync(migrations).find(f=>f.endsWith('_teacher_assessment_forms.sql'));
 await db.exec(fs.readFileSync(path.join(migrations,migration),'utf8'));
 await db.exec('set role service_role');
 const save=async(actor,kind,source,period,revision,status='draft',values={})=>(await db.query('select save_teacher_assessment($1,$2,$3,$4,$5,$6,$7) result',[actor,kind,source,period,revision,status,values])).rows[0].result;
 for(const actor of [other,student])await assert.rejects(()=>save(actor,'monthly',1,'period-1',0),/FORBIDDEN/);
 await assert.rejects(()=>save(teacher,'monthly',2,'period-1',0),/FORBIDDEN/);
 const first=await save(teacher,'monthly',1,'period-1',0);
 assert.equal(first.revision,1);
 await assert.rejects(()=>save(teacher,'monthly',1,'period-1',0),/CONFLICT/);
 const second=await save(admin,'monthly',1,'period-1',1,'submitted',{achievements:'Admin edit'});
 assert.equal(second.revision,2);
 await assert.rejects(()=>save(teacher,'monthly',1,'period-1',2,'draft'),/CONFLICT/);
 await db.exec('reset role');await db.query('update enrollments set teacher_user_id=$1 where id=1',[other]);await db.exec('set role service_role');
 await assert.rejects(()=>save(teacher,'monthly',1,'period-1',2,'submitted'),/FORBIDDEN/);
 const reassign=await save(other,'monthly',1,'period-1',2,'submitted');assert.equal(reassign.revision,3);
 const initial=await save(teacher,'initial',1,'initial',0,'submitted',{startingLevel:'Developing beginner'});assert.equal(initial.revision,1);
 const parent=(await db.query('select * from level_tests where id=1')).rows[0];assert.equal(parent.status,'admin_review');assert.equal(parent.final_level,'ADMIN_FINAL');assert.equal(parent.teacher_suggested_level,'Developing beginner');
 await save(admin,'initial',2,'initial',0,'submitted',{startingLevel:'Independent'});
 assert.equal((await db.query('select status from level_tests where id=2')).rows[0].status,'completed','final decision workflow remains completed');
 assert.equal((await db.query('select count(*)::int n from teacher_assessment_versions where assessment_id=$1',[first.id])).rows[0].n,3);
 // Audit failure must roll back the record update in the same transaction.
 await db.exec('reset role;revoke insert on teacher_assessment_versions from service_role;set role service_role');
 await assert.rejects(()=>save(admin,'monthly',1,'period-1',3,'submitted'),/permission denied/);
 assert.equal((await db.query('select revision from teacher_assessments where id=$1',[first.id])).rows[0].revision,3);
 for(const role of ['anon','authenticated']){
  await db.exec('reset role;set role '+role);
  await assert.rejects(()=>db.query('select * from teacher_assessments'),/permission denied/);
  await assert.rejects(()=>db.query('select * from teacher_assessment_versions'),/permission denied/);
  await assert.rejects(()=>save(admin,'monthly',1,'period-1',3),/permission denied/);
 }
 }finally{await db.close()}
});
