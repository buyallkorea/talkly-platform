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
  assert.doesNotMatch(ui, /추천 가능 강사 확인|선택한 강사 가능 여부 확인|가능한 강사 모두 찾기/);
  assert.match(ui, /수강료 결제하기/);
  assert.match(ui, /const searchAvailability = useCallback/);
  assert.match(ui, /void searchAvailability\(\)/);
  assert.match(ui, /\{teachers\.map\(/);
  assert.match(ui, /현재 수업 가능한 시간/);
  assert.match(ui, /관리자 추천강사/);
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

test("three required payment consents are stored and verified", () => {
  const source = read("lib/payments/tuition-consent.ts");
  assert.match(source, /key: "discount"/);
  assert.match(source, /key: "refund"/);
  assert.match(source, /answers\.discount === "yes" && answers\.refund === "yes"/);
  assert.match(source, /key: "finalConfirmation"/);
  assert.match(source, /answers\.finalConfirmation === "yes"/);
  assert.match(source, /③/);
  const prepare = read("app/api/parent/enrollment-requests/[id]/payment/prepare/route.ts");
  const confirm = read("app/api/parent/payments/confirm/route.ts");
  assert.match(prepare, /consent\?\.answers\?\.finalConfirmation !== true/);
  assert.match(confirm, /consentRecord\.decisions\?\.finalConfirmation !== true/);
});

test("November 18 schedule and enrollment status controls", () => {
  const student = read("app/student/page.tsx");
  const parent = read("app/parent/children/[id]/page.tsx");
  const ui = read("app/parent/children/[id]/enrollment/CustomEnrollmentScheduler.tsx");
  assert.match(student, /href="\/student\/enrollment-requests"/);
  assert.match(parent, /\/enrollment-requests/);
  assert.match(ui, /matchingRequestId\.current/);
  assert.match(ui, /preferredTimeChoices\.length >= 2/);
  assert.match(ui, /preferredTimeCandidates: teacherMode === "any"/);
  assert.match(ui, /맞는 스케줄이 없다면 관리자 추천강사로 수강신청/);
  assert.match(ui, /관리자는 레벨테스트 결과를 바탕으로 학생에게 적합한 강사를 배치합니다/);
});

test("recommended time choices are validated and visible to administrators", () => {
  const api = read("app/api/parent/enrollment-requests/route.ts");
  const admin = read("app/admin/enrollment-requests/[id]/page.tsx");
  const student = read("app/student/enrollment-requests/page.tsx");
  const parent = read("app/parent/children/[id]/enrollment-requests/page.tsx");
  const ui = read("app/parent/children/[id]/enrollment/CustomEnrollmentScheduler.tsx");
  assert.match(api, /preferred_time_candidates: preferredTimeCandidates/);
  assert.match(api, /preferredTimeCandidates\.length <= 3/);
  assert.match(admin, /관리자 추천 희망시간 \(우선순위\)/);
  assert.match(student, /preferred_time_candidates/);
  assert.match(parent, /preferred_time_candidates/);
  assert.doesNotMatch(ui, /선택한 시간에 가능한 강사 \$\{matchingTeachers\.length\}명/);
  assert.doesNotMatch(ui, /관리자에게 수강신청/);
  assert.doesNotMatch(ui, /window\.confirm/);
  assert.match(ui, /관리자 추천강사로 수강신청/);
});
