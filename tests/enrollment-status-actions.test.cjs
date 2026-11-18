const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("admin detail prominently renders reject/cancel actions before scheduling", () => {
  const page = read("app/admin/enrollment-requests/[id]/page.tsx");
  const controls = read("app/admin/enrollment-requests/[id]/RequestStatusControls.tsx");
  assert.match(page, /import RequestStatusControls/);
  const controlOffset = page.indexOf("<RequestStatusControls");
  const assignmentOffset = page.indexOf("<AssignmentManager");
  assert(controlOffset > 0 && controlOffset < assignmentOffset);
  assert.match(controls, /if \(status !== "pending" \|\| hasAssignment\) return null/);
  assert.match(controls, /신청 취소/);
  assert.match(controls, /신청 반려/);
  assert.match(controls, /처리 사유 \(필수\)/);
  assert.match(controls, /window\.confirm/);
});

test("server blocks reject/cancel when assigned, paid, or already closed", () => {
  const route = read("app/api/admin/enrollment-requests/[id]/route.ts");
  assert.match(route, /action: "approve" \| "reject" \| "cancel"/);
  assert.match(route, /await requireAdmin\(\)/);
  assert.match(route, /enrollmentRequest\.status !== "pending"/);
  assert.match(route, /enrollmentRequest\.assigned_teacher_user_id/);
  assert.match(route, /enrollment_payments/);
  assert.match(route, /source_enrollment_request_id/);
  assert.match(route, /createAdminClient/);
  assert.match(route, /\.eq\("status", "pending"\)/);
  assert.match(route, /\.is\("assigned_teacher_user_id", null\)/);
  assert.match(route, /admin_note: note/);
  assert.match(route, /status: nextStatus/);
});

test("applicants can cancel only their own unpaid and unassigned pending request", () => {
  const route = read("app/api/parent/enrollment-requests/[id]/cancel/route.ts");
  const button = read("components/enrollment/PendingRequestCancelButton.tsx");
  const student = read("app/student/enrollment-requests/page.tsx");
  const parent = read("app/parent/children/[id]/enrollment-requests/page.tsx");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /\["student", "parent"\]/);
  assert.match(route, /\.eq\("applicant_user_id", user\.id\)/);
  assert.match(route, /existing\.status !== "pending"/);
  assert.match(route, /enrollment_payments/);
  assert.match(route, /source_enrollment_request_id/);
  assert.match(route, /status: "cancelled"/);
  assert.match(button, /router\.push\(reapplyHref\)/);
  assert.match(student, /PendingRequestCancelButton/);
  assert.match(parent, /PendingRequestCancelButton/);
  assert.match(student, /currentRequest\?\.status === "pending"/);
  assert.match(parent, /currentRequest\?\.status === "pending"/);
});

test("duplicate application API points to an actionable existing request", () => {
  const api = read("app/api/parent/enrollment-requests/route.ts");
  const ui = read("app/parent/children/[id]/enrollment/CustomEnrollmentScheduler.tsx");
  assert.match(api, /existingRequestId: existingCustom\.id/);
  assert.match(api, /status: 409/);
  assert.match(ui, /진행 중인 신청 확인·취소하기/);
  assert.match(ui, /resolvedEnrollmentRequestsHref/);
});
