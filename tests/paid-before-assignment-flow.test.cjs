const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("recommended teacher is not auto-selected or reserved by applicant", () => {
  const ui = read("app/parent/children/[id]/enrollment/CustomEnrollmentScheduler.tsx");
  assert.match(ui, /teacherMode === "specific" \? selectedTeacherId : null/);
  assert.match(ui, /teacherMode === "any" \? preferredTimeChoices\[0\]/);
  assert.match(ui, /결제 후 관리자가 강사/);
  assert.match(ui, /router\.push\(href\)/);
  assert.match(ui, /checkoutMode,/);
  assert.doesNotMatch(ui, /const candidateTeacher = firstDay\.find/);
  assert.match(ui, /direct-checkout/); // Specific teacher path still has checkout.
});

test("pre-assignment checkout requires applicant ownership and saved pricing choices", () => {
  const component = read("components/payments/PreAssignmentCheckout.tsx");
  const student = read("app/student/enrollment-requests/[requestId]/page.tsx");
  const parent = read("app/parent/children/[id]/enrollment-requests/[requestId]/page.tsx");
  assert.match(component, /teacherName="관리자 배정 예정"/);
  assert.match(component, /\.eq\("pricing_category", request\.pricing_category/);
  assert.match(component, /\.eq\("duration_months", request\.duration_months\)/);
  assert.match(component, /\.in\("status", \["paid", "confirming"\]\)/);
  assert.match(student, /request\.teacher_preference_type === "any"/);
  assert.match(parent, /request\.teacher_preference_type === "any"/);
  assert.match(student, /PreAssignmentCheckout/);
  assert.match(parent, /PreAssignmentCheckout/);
});

test("payment preparation and confirmation permit only unassigned pending direct recommendations", () => {
  const prepare = read("app/api/parent/enrollment-requests/[id]/payment/prepare/route.ts");
  const confirm = read("app/api/parent/payments/confirm/route.ts");
  const pricing = read("app/api/parent/enrollment-requests/[id]/pricing/route.ts");
  for (const source of [prepare, confirm]) {
    assert.match(source, /teacher_preference_type === "any"/);
    assert.match(source, /checkout_mode === "direct"/);
    assert.match(source, /!awaitingAdminAssignment/);
  }
  assert.match(pricing, /preAssignment/);
  const enrollmentApi = read("app/api/parent/enrollment-requests/route.ts");
  assert.match(enrollmentApi, /checkout_mode: body.checkoutMode === "direct"/);
  assert.match(pricing, /\.in\("status", \["paid", "confirming"\]\)/);
  assert.match(prepare, /assignmentPending: awaitingAdminAssignment/);
  assert.match(confirm, /assignmentPending: true/);
  assert.match(confirm, /if \(awaitingAdminAssignment\)/);
  assert.match(confirm, /activatePaidEnrollment\(/);
});

test("admin paid allocation checks teacher pricing and triggers class activation", () => {
  const route = read("app/api/admin/enrollment-requests/[id]/assign/route.ts");
  const detail = read("app/admin/enrollment-requests/[id]/page.tsx");
  assert.match(route, /\.from\("enrollment_payments"\)/);
  assert.match(route, /region !== enrollmentRequest\.pricing_category/);
  assert.match(route, /activatePaidEnrollment\(currentPayment\.id\)/);
  assert.match(route, /status:\s*"approved"/);
  assert.match(detail, /결제 완료/);
  assert.match(detail, /hasPayment=\{latestPayment\?\.status === "paid"/);
});

test("new immutable receipt numbers are tied to Korean reception day, not internal id", () => {
  const migration = read("supabase/migrations/20261118150000_enrollment_application_reference.sql");
  const admin = read("app/admin/enrollment-requests/page.tsx");
  const student = read("app/student/enrollment-requests/page.tsx");
  const parent = read("app/parent/children/[id]/enrollment-requests/page.tsx");
  assert.match(migration, /Asia\/Seoul/);
  assert.match(migration, /on conflict \(reception_day\)/);
  assert.match(migration, /unique/);
  assert.match(admin, /row\.application_number/);
  assert.match(student, /currentRequest\.application_number/);
  assert.match(parent, /currentRequest\.application_number/);
});

test("v5 consent retains prepaid allocation disclosure and preserves historical v4", () => {
  const consent = read("lib/payments/tuition-consent.ts");
  const migration = read("supabase/migrations/20261118153000_preassignment_tuition_consent_v4.sql");
  assert.match(consent, /2026-11-19-v5/);
  assert.match(consent, /관리자 추천강사는 결제 완료 후/);
  assert.match(migration, /2026-11-18-v4/);
  assert.match(migration, /2026-11-18-v3/);
});
