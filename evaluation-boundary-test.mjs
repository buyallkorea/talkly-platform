import assert from "node:assert/strict";
import { getTeacherEvaluationRequirements } from "./lib/teacher-evaluations.ts";

const result = getTeacherEvaluationRequirements({
  enrollmentId: 1,
  startDate: "2026-09-01",
  totalLessons: 4,
  sessions: [
    { id: 1, enrollment_id: 1, lesson_number: 1, scheduled_start: "2026-09-08T10:00:00+09:00", status: "completed" },
    { id: 2, enrollment_id: 1, lesson_number: 2, scheduled_start: "2026-09-15T10:00:00+09:00", status: "completed" },
    { id: 3, enrollment_id: 1, lesson_number: 3, scheduled_start: "2026-09-22T10:00:00+09:00", status: "completed" },
    { id: 4, enrollment_id: 1, lesson_number: 4, scheduled_start: "2026-09-29T10:00:00+09:00", status: "completed" },
  ],
  existingEvaluations: [],
});

assert.deepEqual(
  result.map(r => [r.sessionId, r.type, r.periodNumber]),
  [[4, "final", null]]
);

console.log("PASS: 28일째 마지막 수업은 최종평가만 배정");
console.log("PASS: 동일 수업에 월간평가 중복 배정 없음");
