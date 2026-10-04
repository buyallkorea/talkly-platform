import assert from "node:assert/strict";
import { getTeacherEvaluationRequirements } from "./lib/teacher-evaluations.ts";

const makeSession = (id, lesson, date, status = "completed") => ({
  id,
  enrollment_id: 1,
  lesson_number: lesson,
  scheduled_start: `${date}T10:00:00+09:00`,
  status,
});

function test(name, startDate, totalLessons, sessions, expected) {
  const actual = getTeacherEvaluationRequirements({
    enrollmentId: 1,
    startDate,
    totalLessons,
    sessions,
    existingEvaluations: [],
  }).map((r) => ({
    type: r.type,
    period: r.periodNumber,
    lesson: r.lessonNumber,
  }));

  try {
    assert.deepEqual(actual, expected);
    console.log(`PASS: ${name}`);
  } catch {
    console.log(`FAIL: ${name}`);
    console.log("Expected:", JSON.stringify(expected));
    console.log("Actual:  ", JSON.stringify(actual));
  }
}

test(
  "28일 이전에는 월간평가 없음",
  "2026-09-01",
  12,
  [makeSession(1, 1, "2026-09-20")],
  []
);

test(
  "28일 이후 첫 완료 수업에서 1개월 평가",
  "2026-09-01",
  12,
  [
    makeSession(1, 1, "2026-09-20"),
    makeSession(2, 2, "2026-09-29"),
  ],
  [{ type: "monthly", period: 1, lesson: 2 }]
);

test(
  "56일 이후 2개월 평가",
  "2026-09-01",
  12,
  [
    makeSession(1, 1, "2026-09-29"),
    makeSession(2, 2, "2026-10-27"),
  ],
  [
    { type: "monthly", period: 1, lesson: 1 },
    { type: "monthly", period: 2, lesson: 2 },
  ]
);

test(
  "마지막 수업에서는 최종평가 우선",
  "2026-09-01",
  4,
  [
    makeSession(1, 1, "2026-09-08"),
    makeSession(2, 2, "2026-09-15"),
    makeSession(3, 3, "2026-09-22"),
    makeSession(4, 4, "2026-09-29"),
  ],
  [{ type: "final", period: null, lesson: 4 }]
);

test(
  "총 수업 수 미지정 시 최종평가 조기 발생 방지",
  "2026-09-01",
  null,
  [makeSession(1, 1, "2026-09-08")],
  []
);
