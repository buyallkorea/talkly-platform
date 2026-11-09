const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {load} = require("../assessments/load.cjs");
const m = load("lib/timesheets/manual.ts");
test("monthly 30-minute manual blocks and six-to-midnight slot bounds", () => {
 assert.equal(m.SLOTS_PER_DAY, 36);
 assert.equal(m.SLOT_MINUTES, 30);
 assert.equal(m.timeLabel(0), "06:00");
 assert.equal(m.timeLabel(35), "23:30");
 assert.throws(() => m.timeLabel(36));
 assert.equal(m.daysInMonth("2026-02"), 28);
 assert.equal(m.daysInMonth("2028-02"), 29);
 assert.equal(m.blockMinutes([{day:1,slot:0,student:"✓"},{day:1,slot:1,student:"Jane"}]),60);
 assert.equal(m.formatDuration(90),"1h 30m");
 assert.equal(m.weeklyGroups("2026-11").length, 6);
 assert.equal(m.weeklyGroups("2026-11")[0].days[6], 1);
});
test("teachers may save empty drafts, but submitting requires a filled class block", () => {
 assert.deepEqual(m.validateManualTimesheet("2026-11",{status:"draft",entries:[],rosterNotes:"",teacherNote:"",timeZone:"Asia/Seoul"}).entries,[]);
 assert.throws(()=>m.validateManualTimesheet("2026-11",{status:"submitted",entries:[]}),/mark at least one/i);
 const result=m.validateManualTimesheet("2026-11",{
   status:"submitted",entries:[{day:2,slot:2,student:" Sophia "},{day:1,slot:0,student:"✓"}],
   rosterNotes:"Anna | Mon | 09:00",teacherNote:"Review a makeup note",timeZone:"Asia/Manila"
 });
 assert.deepEqual(result.entries,[{day:1,slot:0,student:"✓"},{day:2,slot:2,student:"Sophia"}]);
 assert.equal(result.rosterNotes,"Anna | Mon | 09:00");
});
test("invalid, duplicated, oversized, out-of-period or cross-month submissions are refused",()=>{
 const base={status:"draft",entries:[]};
 for(const input of [
  {status:"draft",entries:[{day:1,slot:0,student:"A"},{day:1,slot:0,student:"B"}]},
  {status:"draft",entries:[{day:32,slot:0,student:"A"}]},
  {status:"draft",entries:[{day:1,slot:36,student:"A"}]},
  {status:"draft",entries:[{day:1,slot:0,student:""}]},
  {status:"draft",entries:[{day:1,slot:0,student:"A".repeat(81)}]},
  {status:"draft",entries:[{day:1,slot:0,student:"A\nB"}]},
  {status:"draft",entries:[],timeZone:"America/New_York"},
  {status:"draft",entries:[],teacherNote:"a".repeat(2001)},
  {status:"draft",entries:[],other:"something"},
 ])assert.throws(()=>m.validateManualTimesheet("2026-11",input));
 assert.throws(()=>m.validateManualTimesheet("2026-13",base));
 assert.throws(()=>m.validateManualTimesheet("2026-02",{status:"draft",entries:[{day:29,slot:2,student:"✓"}]}));
 assert.equal(m.validMonth("2026-11"),true);
 assert.equal(m.validMonth("2026-13"),false);
});
test("teacher form and admin report are isolated from actual classroom and pay data",()=>{
 const read=p=>fs.readFileSync(path.resolve(__dirname,"../..",p),"utf8");
 const route=read("app/api/teacher-timesheets/route.ts");
 const page=read("app/teacher/teaching-hours/page.tsx");
 const admin=read("app/admin/payroll/page.tsx");
 const schema=read("supabase/migrations/20261109075500_teacher_manual_timesheets.sql");
 const editor=read("components/timesheets/ManualTimesheetForm.tsx");
 assert.match(page,/teacher_manual_timesheets/);
 assert.match(admin,/teacher_manual_timesheets/);
 assert.match(editor,/readOnly/);
 assert.match(editor,/Submit monthly timesheet/);
 assert.match(route,/profile\?\.role !== "teacher"/);
 assert.match(route,/VERCEL_ENV === "preview"/);
 assert.match(schema,/enable row level security/);
 assert.match(schema,/revoke all on public.teacher_manual_timesheets/);
 for(const file of [page,admin,route,schema]) {
  assert.doesNotMatch(file,/\.from\(["'](class_sessions|attendance|enrollments|payments)["']\)/);
 }
});
