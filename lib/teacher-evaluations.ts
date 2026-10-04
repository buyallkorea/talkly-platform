export type TeacherEvaluationType = "monthly" | "final";

export type TeacherEvaluationSession = {
  id: number;
  enrollment_id: number;
  lesson_number: number;
  scheduled_start: string;
  status: string;
};

export type ExistingTeacherEvaluation = {
  class_session_id: number;
  evaluation_type: string | null;
  period_number: number | null;
};

export type TeacherEvaluationRequirement = {
  sessionId: number;
  enrollmentId: number;
  lessonNumber: number;
  type: TeacherEvaluationType;
  periodNumber: number | null;
};

const PERIOD_DAYS = 28;
const DAY_MS = 86400000;
const TIME_ZONE = "Asia/Seoul";

function parseDateKey(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function getSeoulDateTimestamp(value: string): number | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value;

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");

  if (!year || !month || !day) return null;

  return parseDateKey(`${year}-${month}-${day}`);
}

function getFinalLessonNumber(
  totalLessons: number | null
): number | null {
  // 총 수업 수가 확정되지 않았다면 최종평가를 발생시키지 않는다.
  if (
    typeof totalLessons !== "number" ||
    !Number.isInteger(totalLessons) ||
    totalLessons <= 0
  ) {
    return null;
  }

  return totalLessons;
}

export function getTeacherEvaluationRequirements({
  enrollmentId,
  startDate,
  totalLessons,
  sessions,
  existingEvaluations,
}: {
  enrollmentId: number;
  startDate: string | null;
  totalLessons: number | null;
  sessions: TeacherEvaluationSession[];
  existingEvaluations: ExistingTeacherEvaluation[];
}): TeacherEvaluationRequirement[] {
  if (!startDate) return [];

  const startTimestamp = parseDateKey(startDate);

  if (startTimestamp === null) return [];

  const enrollmentSessions = sessions
    .filter((session) => session.enrollment_id === enrollmentId)
    .sort((a, b) => {
      const difference =
        new Date(a.scheduled_start).getTime() -
        new Date(b.scheduled_start).getTime();

      return difference || a.lesson_number - b.lesson_number || a.id - b.id;
    });

  const completedSessions = enrollmentSessions.filter(
    (session) => session.status === "completed"
  );

  if (completedSessions.length === 0) return [];

  const finalLessonNumber = getFinalLessonNumber(totalLessons);

  const finalSession =
    finalLessonNumber === null
      ? null
      : enrollmentSessions.find(
          (session) => session.lesson_number === finalLessonNumber
        ) ?? null;

  const requirements: TeacherEvaluationRequirement[] = [];

  const finalCompleted =
    finalSession !== null && finalSession.status === "completed";

  const existingFinal = existingEvaluations.find(
    (evaluation) => evaluation.evaluation_type === "final"
  );

  if (finalCompleted && finalSession) {
    requirements.push({
      sessionId: existingFinal?.class_session_id ?? finalSession.id,
      enrollmentId,
      lessonNumber: finalSession.lesson_number,
      type: "final",
      periodNumber: null,
    });
  }

  const completedDates = completedSessions
    .map((session) =>
      getSeoulDateTimestamp(session.scheduled_start)
    )
    .filter((value): value is number => value !== null);

  if (completedDates.length === 0) return requirements;

  const latestCompletedDate = Math.max(...completedDates);

  const elapsedDays = Math.floor(
    (latestCompletedDate - startTimestamp) / DAY_MS
  );

  const duePeriodCount = Math.max(
    0,
    Math.floor(elapsedDays / PERIOD_DAYS)
  );

  const usedSessionIds = new Set<number>();

  if (finalCompleted && finalSession) {
    usedSessionIds.add(finalSession.id);
  }

  // 최종평가가 완료된 수업 이후에는 새로운 월간평가를 배정하지 않는다.
  const finalTimestamp =
    finalCompleted && finalSession
      ? new Date(finalSession.scheduled_start).getTime()
      : null;

  for (let periodNumber = 1; periodNumber <= duePeriodCount; periodNumber++) {
    const existingMonthly = existingEvaluations.find(
      (evaluation) =>
        evaluation.evaluation_type === "monthly" &&
        evaluation.period_number === periodNumber
    );

    if (existingMonthly) {
      const existingSession = enrollmentSessions.find(
        (session) => session.id === existingMonthly.class_session_id
      );

      if (existingSession) {
        usedSessionIds.add(existingSession.id);

        requirements.push({
          sessionId: existingSession.id,
          enrollmentId,
          lessonNumber: existingSession.lesson_number,
          type: "monthly",
          periodNumber,
        });
      }

      continue;
    }

    const dueTimestamp =
      startTimestamp + periodNumber * PERIOD_DAYS * DAY_MS;

    const anchorSession = completedSessions.find((session) => {
      if (usedSessionIds.has(session.id)) return false;

      const sessionTimestamp = new Date(
        session.scheduled_start
      ).getTime();

      if (
        finalTimestamp !== null &&
        sessionTimestamp >= finalTimestamp
      ) {
        return false;
      }

      const sessionDate = getSeoulDateTimestamp(
        session.scheduled_start
      );

      return sessionDate !== null && sessionDate >= dueTimestamp;
    });

    if (!anchorSession) continue;

    usedSessionIds.add(anchorSession.id);

    requirements.push({
      sessionId: anchorSession.id,
      enrollmentId,
      lessonNumber: anchorSession.lesson_number,
      type: "monthly",
      periodNumber,
    });
  }

  return requirements.sort((a, b) => {
    const sessionA = enrollmentSessions.find(
      (session) => session.id === a.sessionId
    );

    const sessionB = enrollmentSessions.find(
      (session) => session.id === b.sessionId
    );

    const timeA = sessionA
      ? new Date(sessionA.scheduled_start).getTime()
      : 0;

    const timeB = sessionB
      ? new Date(sessionB.scheduled_start).getTime()
      : 0;

    return (
      timeA - timeB ||
      (a.periodNumber ?? Number.MAX_SAFE_INTEGER) -
        (b.periodNumber ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

export function getTeacherEvaluationRequirementForSession({
  sessionId,
  enrollmentId,
  startDate,
  totalLessons,
  sessions,
  existingEvaluations,
}: {
  sessionId: number;
  enrollmentId: number;
  startDate: string | null;
  totalLessons: number | null;
  sessions: TeacherEvaluationSession[];
  existingEvaluations: ExistingTeacherEvaluation[];
}): TeacherEvaluationRequirement | null {
  const requirements = getTeacherEvaluationRequirements({
    enrollmentId,
    startDate,
    totalLessons,
    sessions,
    existingEvaluations,
  });

  return (
    requirements.find(
      (requirement) => requirement.sessionId === sessionId
    ) ?? null
  );
}

export function getTeacherEvaluationLabel(
  requirement: TeacherEvaluationRequirement
) {
  if (requirement.type === "final") {
    return {
      en: "Final Teacher Evaluation",
      ko: "최종 강사 종합평가",
    };
  }

  return {
    en: `Month ${requirement.periodNumber} Teacher Evaluation`,
    ko: `${requirement.periodNumber}개월 학습평가`,
  };
}