const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("admin details show cancel for approved unpaid and reject for unassigned pending", () => {
  const page = read("app/admin/enrollment-requests/[id]/page.tsx");
  const controls = read("app/admin/enrollment-requests/[id]/RequestStatusControls.tsx");
  assert.match(page, /import RequestStatusControls/);
  assert(page.indexOf("<RequestStatusControls") < page.indexOf("<AssignmentManager"));
  assert.match(controls, /const canCancel = \(status === "pending" \|\| status === "approved"\) && !hasPayment/);
  assert.match(controls, /const canReject = status === "pending" && !hasAssignment && !hasPayment/);
  assert.match(controls, /신청 취소/);
  assert.match(controls, /신청 반려/);
  assert.match(controls, /처리 사유 \(필수\)/);
  assert.match(controls, /window\.confirm/);
});

test("admin cancel executes transactional cancel RPC only after requireAdmin", () => {
  const route = read("app/api/admin/enrollment-requests/[id]/route.ts");
  assert.match(route, /await requireAdmin\(\)/);
  assert.match(route, /body.action === "cancel"/);
  assert.match(route, /cancel_unpaid_enrollment_request/);
  assert.match(route, /p_actor: enrollmentRequest\.applicant_user_id/);
  assert.match(route, /enrollmentRequest\.status !== "pending"/);
  assert.match(route, /\.eq\("status", "pending"\)/);
});

test("student and parent can cancel own unpaid pending or approved requests", () => {
  const route = read("app/api/parent/enrollment-requests/[id]/cancel/route.ts");
  const button = read("components/enrollment/PendingRequestCancelButton.tsx");
  const student = read("app/student/enrollment-requests/page.tsx");
  const parent = read("app/parent/children/[id]/enrollment-requests/page.tsx");
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /\["student", "parent"\]/);
  assert.match(route, /\.eq\("applicant_user_id", user\.id\)/);
  assert.match(route, /\["pending", "approved"\]/);
  assert.match(route, /cancel_unpaid_enrollment_request/);
  assert.match(button, /router\.push\(reapplyHref\)/);
  for (const ui of [student, parent]) {
    assert.match(ui, /\["pending", "approved"\]\.includes\(currentRequest\.status\)/);
    assert.match(ui, /!alreadyPaid && !awaitingPaymentConfirmation/);
    assert.match(ui, /PendingRequestCancelButton/);
  }
});

test("cancellation releases only unpaid holds and rejects confirming/paid orders", () => {
  const sql = read("supabase/migrations/20261118224500_cancel_unpaid_enrollment_and_release_reservations.sql");
  assert.match(sql, /for update/);
  assert.match(sql, /status in \('requested','confirming','paid'\)/);
  assert.match(sql, /source_enrollment_request_id=p_request_id/);
  assert.match(sql, /reservation_state='paid'/);
  assert.match(sql, /reservation_state='held'/);
  assert.match(sql, /status='cancelled'/);
  assert.match(sql, /revoke all on function public\.cancel_unpaid_enrollment_request/);
  assert.match(sql, /service_role/);
  const confirm = read("app/api/parent/payments/confirm/route.ts");
  assert.match(confirm, /payment\.status !== "ready"/);
});

test("duplicate application API directs applicants to their current request", () => {
  const api = read("app/api/parent/enrollment-requests/route.ts");
  const ui = read("app/parent/children/[id]/enrollment/CustomEnrollmentScheduler.tsx");
  assert.match(api, /existingRequestId: existingCustom\.id/);
  assert.match(api, /status: 409/);
  assert.match(ui, /진행 중인 신청 확인·취소하기/);
  assert.match(ui, /resolvedEnrollmentRequestsHref/);
});
