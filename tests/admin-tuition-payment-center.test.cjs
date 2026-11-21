const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = p => fs.readFileSync(p, "utf8");

test("admin tuition center exposes only read-only secured payment and evidence queries", () => {
  const s = read("app/admin/tuition-payments/page.tsx");
  assert.match(s, /client\.auth\.getUser\(\)/);
  assert.match(s, /profile\?\.role !== "admin"/);
  assert.match(s, /"enrollment_payments"/);
  assert.match(s, /"tuition_payment_consents"/);
  assert.match(s, /\.range\(offset, offset \+ PAGE_SIZE - 1\)/);
  assert.match(s, /"order_id"/);
  assert.match(s, /"consented_at"/);
  assert.match(s, /"cancelled_at"/);
  assert.doesNotMatch(s, /\.update\(|\.delete\(|\.insert\(|\.upsert\(/);
  assert.doesNotMatch(s, /payment_key/);
});

test("admin sidebar links to unified center without losing sandbox payment access", () => {
  const nav = read("app/admin/AdminSidebar.tsx");
  assert.match(nav, /href: "\/admin\/tuition-payments"/);
  assert.match(nav, /href: "\/admin\/payment-test"/);
  const css = read("app/globals.css");
  assert.match(css, /\.talkly-payment-table-wrap/);
  assert.match(css, /@media \(max-width:700px\)/);
});

test("old consent evidence route remains accessible for existing bookmarks", () => {
  const old = read("app/admin/payment-consents/page.tsx");
  assert.match(old, /tuition_payment_consents/);
  assert.match(old, /profile\?\.role !== "admin"/);
});
