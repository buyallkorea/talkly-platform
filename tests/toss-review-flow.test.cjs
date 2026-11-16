const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

test("completed custom enrollment redirects to pending/assigned status", () => {
  const scheduler = read("app/parent/children/[id]/enrollment/CustomEnrollmentScheduler.tsx");
  assert.match(scheduler, /router\.push\(resolvedEnrollmentRequestsHref\)/);
  const status = read("app/student/enrollment-requests/page.tsx");
  assert.match(status, /currentRequest && !assigned && <TossReviewInfo/);
  assert.match(status, /assigned \? \(/);
  assert.match(read("app/parent/children/[id]/enrollment-requests/page.tsx"), /TossReviewInfo/);
});

test("review UI has distinct, publicly accessible sandbox-only routes", () => {
  const page = read("app/payment-review/page.tsx");
  assert.doesNotMatch(page, /auth\.getUser|redirect\("\/login"/);
  assert.match(page, /isSandboxKeyPair\(publicKey, secretKey\)/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /TossReviewCheckout/);
  const checkout = read("app/payment-review/TossReviewCheckout.tsx");
  assert.match(checkout, /\/api\/payment-review\/prepare/);
  assert.match(checkout, /\/payment-review\/result\?outcome=success/);
  assert.match(checkout, /renderPaymentWindow\(\)/);
  assert.match(checkout, /on\("paymentRequest"/);
  assert.match(read("app/payment-review/result/page.tsx"), /\/api\/payment-review\/confirm/);
});

test("sandbox review signatures, fixed amount and live key exclusion remain enforced", () => {
  const auth = read("lib/payments/toss-review-auth.ts");
  const prep = read("app/api/payment-review/prepare/route.ts");
  const confirm = read("app/api/payment-review/confirm/route.ts");
  const common = read("lib/payments/toss-sandbox-order.ts");
  assert.match(auth, /isSandboxKeyPair\(clientKey, secretKey\)/);
  assert.match(auth, /new URL\(origin\)\.origin === new URL\(request\.url\)\.origin/);
  assert.match(auth, /consume_toss_review_rate_limit/);
  assert.match(prep, /consumeTossReviewRateLimit/);
  assert.match(prep, /createSandboxOrder\(checked\.secretKey, TOSS_REVIEWER_ID\)/);
  assert.match(confirm, /verifySandboxOrder\(checked\.secretKey, TOSS_REVIEWER_ID, orderId\)/);
  assert.match(confirm, /amount !== TOSS_SANDBOX_AMOUNT/);
  assert.match(confirm, /verifiedPayment\(result, orderId, paymentKey\)/);
  assert.match(confirm, /api\.tosspayments\.com\/v1\/payments\/confirm/);
  assert.match(common, /TOSS_SANDBOX_AMOUNT = 1000/);
  for (const file of [prep,confirm]) {
    assert.doesNotMatch(file, /\.from\(["'](?:enrollment_requests|enrollment_payments|enrollments|class_sessions)["']\)/);
  }
});

test("rate limiter limits requests for service role and blocks ordinary web users", () => {
  const sql = read("supabase/migrations/20261116143000_toss_review_rate_limits.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on function .* from public, anon, authenticated/);
  assert.match(sql, /grant execute on function .* to service_role/);
  assert.match(sql, /return v_count <= 12/);
});
