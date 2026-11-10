const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./assessments/load.cjs");
const core = load("lib/payments/toss-sandbox-order.ts");
const read = p => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

test("sandbox accepts only test widget key formats and disables live charging", () => {
  assert.equal(core.isSandboxKeyPair("test_gck_testClient", "test_gsk_testSecret"), true);
  for(const pair of [
    ["live_gck_liveClient","live_gsk_liveSecret"],
    ["test_gck_client","live_gsk_secret"],
    ["live_gck_client","test_gsk_secret"],
    ["test_ck_wrong","test_sk_wrong"],
    ["test_gck_client",undefined],
    [undefined,"test_gsk_secret"]
  ]) assert.equal(core.isSandboxKeyPair(...pair),false);
});

test("test order tokens are signed, admin-bound and expire within 10 minutes", () => {
  const secret="test_gsk_placeholder_not_a_real_key",adminA="11111111-1111-4111-8111-111111111111";
  const adminB="22222222-2222-4222-8222-222222222222";
  const now=Date.UTC(2026,10,10,0,0,0);
  const a=core.createSandboxOrder(secret,adminA,now);
  const b=core.createSandboxOrder(secret,adminA,now);
  assert.notEqual(a,b);
  assert.match(a,/^TALKLYTEST-[0-9a-z]{5,10}-[a-f0-9]{16}-[a-f0-9]{20}$/);
  assert.ok(a.length <= 64);
  assert.equal(core.verifySandboxOrder(secret,adminA,a,now),true);
  assert.equal(core.verifySandboxOrder(secret,adminB,a,now),false);
  assert.equal(core.verifySandboxOrder("test_gsk_wrong",adminA,a,now),false);
  assert.equal(core.verifySandboxOrder(secret,adminA,a,now+11*60*1000),false);
  assert.equal(core.verifySandboxOrder(secret,adminA,a,now-40*1000),false);
  assert.equal(core.verifySandboxOrder(secret,adminA,a.replace(/^TALKLYTEST/,"OTHER"),now),false);
  assert.equal(core.verifySandboxOrder(secret,adminA,a.slice(0,-1)+"z",now),false);
  assert.equal(core.TOSS_SANDBOX_AMOUNT,1000);
});

test("admin APIs have live account role+origin checks and no production DB writes", () => {
  const auth=read("lib/payments/toss-sandbox-auth.ts");
  const prepare=read("app/api/admin/payment-test/prepare/route.ts");
  const confirm=read("app/api/admin/payment-test/confirm/route.ts");
  assert.match(auth,/auth\.getUser\(\)/);
  assert.match(auth,/\.eq\("id", user\.id\)/);
  assert.match(auth,/profile\?\.role !== "admin"/);
  assert.match(auth,/origin/);
  assert.match(auth,/isSandboxKeyPair\(clientKey, secretKey\)/);
  assert.match(prepare,/createSandboxOrder\(checked\.secretKey, checked\.adminId\)/);
  assert.match(confirm,/verifySandboxOrder\(checked\.secretKey, checked\.adminId, orderId\)/);
  assert.match(confirm,/amount !== TOSS_SANDBOX_AMOUNT/);
  assert.match(confirm,/api\.tosspayments\.com\/v1\/payments\/confirm/);
  assert.match(confirm,/result\.status !== "DONE"/);
  assert.match(confirm,/result\.orderId !== orderId/);
  assert.match(confirm,/result\.paymentKey !== paymentKey/);
  assert.match(confirm,/result\.totalAmount !== TOSS_SANDBOX_AMOUNT/);
  assert.doesNotMatch(prepare+confirm,/\.(from|rpc)\(["'](?:enrollment_payments|enrollments|class_sessions|enrollment_requests)["']/);
  assert.doesNotMatch(prepare+confirm,/createAdminClient/);
});

test("admin-only page uses test keys and separate result route, preserving normal paid enrollment",()=>{
  const page=read("app/admin/payment-test/page.tsx");
  const checkout=read("app/admin/payment-test/TossSandboxCheckout.tsx");
  const result=read("app/admin/payment-test/result/page.tsx");
  const sidebar=read("app/admin/AdminSidebar.tsx");
  assert.match(page,/profile\?\.role !== "admin"/);
  assert.match(page,/isSandboxKeyPair\(clientKey, secretKey\)/);
  assert.match(checkout,/renderPaymentWindow\(\)/);
  assert.match(checkout,/on\("paymentRequest"/);
  assert.match(checkout,/\/api\/admin\/payment-test\/prepare/);
  assert.match(checkout,/\/admin\/payment-test\/result\?outcome=success/);
  assert.match(result,/\/api\/admin\/payment-test\/confirm/);
  assert.match(result,/data\.status !== "DONE"/);
  assert.match(sidebar,/href: "\/admin\/payment-test"/);
  assert.match(read("app/api/parent/payments/confirm/route.ts"),/activatePaidEnrollment/);
});
