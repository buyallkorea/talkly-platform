import Link from "next/link";

import {
  formatAssignedSchedule,
  type EnrollmentProgressResult,
} from "@/lib/parent/get-enrollment-progress";

type EnrollmentProgressCardProps = {
  progress: EnrollmentProgressResult;
  compact?: boolean;
};

const STEPS = [
  {
    key: "level_test",
    label: "레벨테스트",
  },
  {
    key: "enrollment",
    label: "수강신청",
  },
  {
    key: "assignment",
    label: "일정배정",
  },
  {
    key: "payment",
    label: "결제",
  },
  {
    key: "classes",
    label: "수강시작",
  },
] as const;

function getCompletedStepIndex(
  progress: EnrollmentProgressResult
) {
  if (
    progress.enrollmentActivated
  ) {
    return 4;
  }

  if (
    progress.paymentCompleted
  ) {
    return 3;
  }

  if (
    progress.assignmentCompleted
  ) {
    return 2;
  }

  if (
    progress.enrollmentRequested
  ) {
    return 1;
  }

  if (
    progress.levelTestCompleted
  ) {
    return 0;
  }

  return -1;
}

function getActiveStepIndex(
  progress: EnrollmentProgressResult
) {
  if (
    progress.enrollmentActivated
  ) {
    return 4;
  }

  if (
    progress.paymentCompleted
  ) {
    return 4;
  }

  if (
    progress.assignmentCompleted
  ) {
    return 3;
  }

  if (
    progress.enrollmentRequested
  ) {
    return 2;
  }

  if (
    progress.levelTestCompleted
  ) {
    return 1;
  }

  return 0;
}

export default function EnrollmentProgressCard({
  progress,
  compact = false,
}: EnrollmentProgressCardProps) {
  const completedStepIndex =
    getCompletedStepIndex(
      progress
    );

  const activeStepIndex =
    getActiveStepIndex(
      progress
    );

  const schedule =
    formatAssignedSchedule(
      progress.assignedDays,
      progress.assignedTimes
    );

  if (compact) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-500">
                수강 진행 현황
              </span>

              <span
                className={[
                  "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                  progress.paymentCompleted
                    ? "bg-emerald-50 text-emerald-700"
                    : progress.stageStatus ===
                        "waiting"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-blue-50 text-blue-700",
                ].join(" ")}
              >
                {progress.badgeLabel}
              </span>
            </div>

            <p className="mt-2 text-lg font-bold text-slate-950">
              {progress.title}
            </p>

            {progress.courseName ? (
              <p className="mt-1 text-sm text-slate-600">
                {progress.courseName}
                {progress.teacherName
                  ? ` · ${progress.teacherName}`
                  : ""}
              </p>
            ) : null}
          </div>

          <Link
            href={
              progress.ctaHref
            }
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            {progress.ctaLabel}
            <span className="ml-1">
              →
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[32px] border border-blue-100 bg-white shadow-[0_20px_60px_rgba(15,45,90,0.08)]">
      <div className="bg-gradient-to-r from-[#0A1F44] via-[#123d80] to-[#2d6ee8] px-6 py-7 text-white sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold tracking-[0.16em] text-blue-200">
                ENROLLMENT PROGRESS
              </span>

              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                {progress.badgeLabel}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              {progress.childName} 수강 진행 현황
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
              {progress.description}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm backdrop-blur-sm">
            <p className="text-xs font-semibold text-blue-200">
              현재 단계
            </p>

            <p className="mt-1 font-bold text-white">
              {progress.title}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-5 gap-2">
          {STEPS.map(
            (step, index) => {
              const completed =
                index <=
                completedStepIndex;

              const active =
                index ===
                activeStepIndex;

              return (
                <div
                  key={step.key}
                  className="relative"
                >
                  {index <
                  STEPS.length -
                    1 ? (
                    <div
                      className={[
                        "absolute left-[55%] top-[18px] h-[2px] w-[90%]",
                        index <
                        completedStepIndex
                          ? "bg-blue-600"
                          : "bg-slate-200",
                      ].join(
                        " "
                      )}
                    />
                  ) : null}

                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div
                      className={[
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black",
                        completed
                          ? "border-blue-600 bg-blue-600 text-white"
                          : active
                            ? "border-blue-600 bg-white text-blue-600"
                            : "border-slate-200 bg-white text-slate-400",
                      ].join(
                        " "
                      )}
                    >
                      {completed
                        ? "✓"
                        : index +
                          1}
                    </div>

                    <p
                      className={[
                        "mt-2 text-[11px] font-bold sm:text-sm",
                        completed ||
                        active
                          ? "text-slate-900"
                          : "text-slate-400",
                      ].join(
                        " "
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>
              );
            }
          )}
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              label="과정"
              value={
                progress.courseName ??
                "아직 미정"
              }
            />

            <InfoItem
              label="담당 강사"
              value={
                progress.teacherName
                  ? [
                      progress.teacherName,
                      progress.teacherNationality,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "배정 전"
              }
            />

            <InfoItem
              label="수업 일정"
              value={
                schedule ??
                "배정 전"
              }
            />

            <InfoItem
              label="수업 조건"
              value={
                progress.lessonDurationMinutes &&
                progress.lessonsPerWeek
                  ? `${progress.lessonDurationMinutes}분 · 주 ${progress.lessonsPerWeek}회`
                  : "미정"
              }
            />
          </div>

          {progress.durationMonths ||
          progress.finalPrice ? (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoItem
                  label="수강기간"
                  value={
                    progress.durationMonths
                      ? `${progress.durationMonths}개월`
                      : "선택 전"
                  }
                />

                <InfoItem
                  label="최종 결제금액"
                  value={
                    progress.finalPrice !=
                    null
                      ? `${progress.finalPrice.toLocaleString(
                          "ko-KR"
                        )}원`
                      : "확정 전"
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-blue-950">
              {progress.title}
            </p>

            <p className="mt-1 text-sm leading-6 text-blue-900/70">
              {progress.description}
            </p>
          </div>

          <Link
            href={
              progress.ctaHref
            }
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
          >
            {progress.ctaLabel}
            <span className="ml-2">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-black text-slate-950 sm:text-base">
        {value}
      </p>
    </div>
  );
}