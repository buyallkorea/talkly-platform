const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("short intensive tuition reflects 30-minute, 40,000-won offer", () => {
  const page = read("app/tuition/page.tsx");
  const calculator = read("components/TuitionCalculator.tsx");
  assert.match(page, /단기집중코스 \(30분\)/);
  assert.match(page, /공인영어시험/);
  assert.match(page, /\{won\(40000\)\}/);
  assert.match(calculator, /단기집중코스 30분/);
  assert.match(calculator, /Array\.from\(\{ length: 20 \}/);
});

test("enrollment is concise but keeps purchase selections", () => {
  const ui = read("app/parent/children/[id]/enrollment/CustomEnrollmentScheduler.tsx");
  assert.doesNotMatch(ui, /<TuitionCalculator/);
  assert.match(ui, /총 수강기간/);
  assert.match(ui, /강사 구분/);
  assert.match(ui, /희망 요일/);
  assert.match(ui, /주당 수업 횟수/);
  assert.match(ui, /shownTimeOptions/);
  assert.match(ui, /teacherUserId: selectedTeacherId/);
  assert.match(ui, /timesByDay\.every/);
  assert.match(ui, /관리자에게 전송하기/);
  assert.match(ui, /checkoutMode === "direct"/);
  assert.match(ui, /direct-checkout/);
  assert.match(ui, /\(00\|30\)/);
  assert.equal((ui.match(/가능한 강사 모두 찾기/g) ?? []).length, 1);
});

test("both learner and parent enrollment pages use revised guidance", () => {
  for (const page of [
    "app/student/enrollment/page.tsx",
    "app/parent/children/[id]/enrollment/page.tsx",
  ]) {
    const source = read(page);
    assert.match(source, /원하는 수업 조건과 주당 수업 횟수, 수강기간, 요일과 희망시간을 선택해 주세요/);
    assert.doesNotMatch(source, /희망시간을 먼저 선택하면/);
  }
});

test("two required payment consents remain in place", () => {
  const source = read("lib/payments/tuition-consent.ts");
  assert.match(source, /key: "discount"/);
  assert.match(source, /key: "refund"/);
  assert.match(source, /answers\.discount === "yes" && answers\.refund === "yes"/);
  assert.doesNotMatch(source, /③/);
});
