const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

const paymentPages = [
  "app/student/enrollment-requests/[requestId]/page.tsx",
  "app/parent/children/[id]/enrollment-requests/[requestId]/page.tsx",
];
const paymentComponents = [
  "app/student/enrollment-requests/[requestId]/PaymentPreparation.tsx",
  "app/parent/children/[id]/enrollment-requests/[requestId]/PaymentPreparation.tsx",
];

test("student and parent have one-line, compact checkout header", () => {
  for (const page of paymentPages) {
    const ui = read(page);
    assert.match(ui, /수강기간과 결제금액을 확인해 주세요/);
    assert.doesNotMatch(ui, /수강기간과\s*<br\s*\/>/);
    assert.match(ui, /"17px 26px"/);
    assert.match(ui, /clamp\(21px, 2\.6vw, 28px\)/);
  }
});

test("both checkout pages put the editable duration beside weekly class info", () => {
  for (const file of paymentComponents) {
    const ui = read(file);
    const frequency = ui.indexOf('label="수업 횟수"');
    const duration = ui.indexOf('name="durationMonths"');
    const consent = ui.indexOf("<TuitionConsentPanel");
    assert(frequency > 0 && duration > frequency && consent > duration);
    assert.match(ui, /className="payment-details-grid"/);
    assert.match(ui, /gridTemplateColumns:\s*"repeat\(5, minmax\(0, 1fr\)\)"/);
    assert.match(ui, /@media \(max-width: 1250px\)/);
    assert.match(ui, /@media \(max-width: 820px\)/);
    assert.match(ui, /discountPolicies\.map\(\(policy\) =>/);
    assert.match(ui, /setSelectedMonths\(Number\(event\.target\.value\)\)/);
    assert.match(ui, /setConsentAnswers\(\{ \.\.\.EMPTY_TUITION_CONSENT \}\)/);
    assert.doesNotMatch(ui, /STEP 1/);
    assert.doesNotMatch(ui, /className="duration-grid"/);
    assert.match(ui, /finalPrice/);
    assert.match(ui, /consentComplete \? "결제 진행/);
  }
});

test("unassigned payments do not misleadingly display assigned class", () => {
  for (const file of paymentComponents) {
    const ui = read(file);
    assert.match(ui, /isUnassignedRecommendation \? "배정 예정" : "배정 완료"/);
    assert.match(ui, /isUnassignedRecommendation \? "ENROLLMENT DETAILS" : "ASSIGNED CLASS"/);
  }
  const checkout = read("components/payments/PreAssignmentCheckout.tsx");
  assert.match(checkout, /"17px 26px"/);
  assert.match(checkout, /결제 완료 후 관리자가 학생 수준과 강사 일정을 확인해 배정합니다/);
});
