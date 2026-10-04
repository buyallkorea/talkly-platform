import assert from "node:assert/strict";
import { getTeacherEvaluationRequirements } from "./lib/teacher-evaluations.ts";

const sessions = [
  { id: 101, enrollment_id: 1, lesson_number: 1, scheduled_start: "2026-09-29T10:00:00+09:00", status: "completed" },
  { id: 102, enrollment_id: 1, lesson_number: 2, scheduled_start: "2026-10-27T10:00:00+09:00", status: "completed" },
  { id: 103, enrollment_id: 1, lesson_number: 3, scheduled_start: "2026-11-03T10:00:00+09:00", status: "completed" },
];

const requirements = getTeacherEvaluationRequirements({
  enrollmentId: 1,
  startDate: "2026-09-01",
  totalLessons: 3,
  sessions,
  existingEvaluations: [
    { class_session_id: 101, evaluation_type: "monthly", period_number: 1 },
    { class_session_id: 102, evaluation_type: "monthly", period_number: 2 },
    { class_session_id: 103, evaluation_type: "final", period_number: null },
  ],
});

assert.equal(requirements.length, 3);
assert.equal(new Set(requirements.map(r => r.sessionId)).size, 3);
assert.deepEqual(
  requirements.map(r => [r.sessionId, r.type, r.periodNumber]),
  [
    [101, "monthly", 1],
    [102, "monthly", 2],
    [103, "final", null],
  ]
);

console.log("PASS: 기존 월간평가 1개월 유지");
console.log("PASS: 기존 월간평가 2개월 유지");
console.log("PASS: 기존 최종평가 유지");
console.log("PASS: 동일 수업 중복 배정 없음");
