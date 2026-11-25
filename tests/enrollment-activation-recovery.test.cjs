const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("paid assignment cannot report full success if enrollment activation fails", () => {
  const source = read("app/api/admin/enrollment-requests/[id]/assign/route.ts");
  const failure = source.slice(source.indexOf('console.error("[ADMIN ASSIGN] paid enrollment activation pending"'));
  assert.match(failure, /success: false/);
  assert.match(failure, /enrollmentActivationPending: true/);
  assert.match(failure, /status: 409/);
  assert.doesNotMatch(failure, /success: true, assignment: updated, enrollmentActivationPending/);
});

test("activation retry is admin-only, paid-only and does not initiate payment", () => {
  const source = read("app/api/admin/enrollment-requests/[id]/activate/route.ts");
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /profile\?\.role !== "admin"/);
  assert.match(source, /assignment_confirmed_at/);
  assert.match(source, /\.eq\("status", "paid"\)/);
  assert.match(source, /activatePaidEnrollment\(paymentId\)/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|tossPayments|confirmPayment/);
});

test("admin paid assignment detail exposes missing sessions and explicit retry", () => {
  const page = read("app/admin/enrollment-requests/[id]/page.tsx");
  const action = read("app/admin/enrollment-requests/[id]/RetryActivationButton.tsx");
  assert.match(page, /source_enrollment_request_id/);
  assert.match(page, /createdLessonCount/);
  assert.match(page, /needsActivationRecovery/);
  assert.match(page, /<RetryActivationButton/);
  assert.match(action, /\/activate/);
  assert.match(action, /response\.ok/);
  assert.match(action, /router\.refresh\(\)/);
});
