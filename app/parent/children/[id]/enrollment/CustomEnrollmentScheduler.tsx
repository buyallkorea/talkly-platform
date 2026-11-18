"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { TUITION_MONTHS, TUITION_REGIONS, tuitionRegionForNationality, type TuitionRegion, type TuitionMonths } from "@/lib/tuition";

type CourseSummary = {
  id: number;
  name: string;
};

type TeacherSummary = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
};

type AvailabilityTeacher = {
  teacherUserId: string;
  displayName: string;
  nationality: string | null;
  specialties: string[];
  yearsExperience: number | null;
  availableTimes: string[];
};

type AvailabilityResponse = {
  availableTeachers?: AvailabilityTeacher[];
  error?: string;
};

type MatchingTeacher = {
  teacherUserId: string;
  displayName: string;
  nationality: string | null;
  specialties: string[];
  yearsExperience: number | null;
};

type Props = {
  childId: number | null;
  childName: string;
  enrollmentRequestsHref?: string;
  returnHref?: string;
  returnLabel?: string;
  allowedWeekdays: string[];
  allowedTimeSlots: string[];
  allowedLessonsPerWeek: number[];
  allowedDurationMinutes?: number[];
  courses: CourseSummary[];
  teachers: TeacherSummary[];
  allowTeacherChoice?: boolean;
  recommendedCourse?: CourseSummary | null;
  recommendedLevel?: string | null;
  levelTestId?: number | null;
};

const DAY_LABELS: Record<string, string> = {
  Sunday: "일",
  Monday: "월",
  Tuesday: "화",
  Wednesday: "수",
  Thursday: "목",
  Friday: "금",
  Saturday: "토",
};

const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatDateOnly(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayDateText() {
  return formatDateOnly(
    new Date()
  );
}

function getTomorrowDateText() {
  const next = new Date(getTodayDateText() + "T12:00:00");
  next.setDate(next.getDate() + 1);
  return formatDateOnly(next);
}

function getNextDateForWeekday({
  baseDateText,
  weekday,
}: {
  baseDateText: string;
  weekday: string;
}) {
  const targetDay =
    DAY_INDEX[weekday];

  if (
    targetDay === undefined
  ) {
    return null;
  }

  const base =
    new Date(
      `${baseDateText}T12:00:00`
    );

  if (
    Number.isNaN(
      base.getTime()
    )
  ) {
    return null;
  }

  const diff =
    (
      targetDay -
      base.getDay() +
      7
    ) % 7;

  const result =
    new Date(base);

  result.setDate(
    result.getDate() +
      diff
  );

  return formatDateOnly(
    result
  );
}

export default function CustomEnrollmentScheduler({
  childId,
  childName,
  enrollmentRequestsHref,
  returnHref,
  returnLabel,
  allowedWeekdays,
  allowedTimeSlots,
  allowedLessonsPerWeek,
  allowedDurationMinutes = [25, 50],
  courses,
  teachers,
  allowTeacherChoice = true,
  recommendedCourse = null,
  recommendedLevel = null,
  levelTestId = null,
}: Props) {
  const router =
    useRouter();

  const isDirectStudent =
    childId === null;

  const resolvedEnrollmentRequestsHref =
    enrollmentRequestsHref ??
    (childId !== null
      ? `/parent/children/${childId}/enrollment-requests`
      : "/student/enrollment-requests");

  const resolvedReturnHref =
    returnHref ??
    (childId !== null
      ? `/parent/children/${childId}`
      : "/student");

  const resolvedReturnLabel =
    returnLabel ??
    (childId !== null
      ? "자녀 관리로 돌아가기"
      : "내 수업 관리로 돌아가기");

  const completionRef =
    useRef<HTMLDivElement | null>(
      null
    );

  // 정규 수강신청은 25분 수업만 제공합니다. 50분은 별도 상담 대상입니다.
  const usableDurations = [25];

  const usableLessons =
    allowedLessonsPerWeek
      .filter(
        (value) =>
          [2, 3, 5].includes(value)
      )
      .sort(
        (a, b) =>
          a - b
      );

  const visibleWeekdays =
    DAY_ORDER.filter(
      (day) =>
        !["Saturday", "Sunday"].includes(day) &&
        allowedWeekdays.includes(day)
    );

  const [
    selectedCourseId,
    setSelectedCourseId,
  ] =
    useState<number | "">(
      recommendedCourse?.id ??
        courses[0]?.id ??
        ""
    );

  const [
    startDate,
    setStartDate,
  ] = useState(
    getTomorrowDateText()
  );

  const [
    durationMinutes,
    setDurationMinutes,
  ] = useState<number>(
    usableDurations[0] ??
      25
  );

  const [
    lessonsPerWeek,
    setLessonsPerWeek,
  ] = useState<number>(
    usableLessons[0] ?? 1
  );

  const [
    selectedDays,
    setSelectedDays,
  ] = useState<string[]>(
    []
  );

  const [preferredRegion, setPreferredRegion] = useState<TuitionRegion>("philippines");
  const [tuitionMonths, setTuitionMonths] = useState<TuitionMonths>(1);

  const [
    preferredTime,
    setPreferredTime,
  ] = useState("");

  const [checkoutMode, setCheckoutMode] = useState<"direct" | "consultation">("direct");
  const [consultationReview, setConsultationReview] = useState(false);

  const [
    teacherMode,
    setTeacherMode,
  ] =
    useState<
      "any" | "specific"
    >("any");

  const [
    selectedTeacherId,
    setSelectedTeacherId,
  ] = useState("");
  const [specificTeacherTimes, setSpecificTeacherTimes] = useState<{ key: string; times: string[]; error: string } | null>(null);

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    matchingTeachers,
    setMatchingTeachers,
  ] = useState<
    MatchingTeacher[]
  >([]);

  const [
    hasSearched,
    setHasSearched,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const selectedCourse =
    courses.find(
      (course) =>
        course.id ===
        Number(
          selectedCourseId
        )
    ) ?? null;

  const selectedTeacher =
    teachers.find(
      (teacher) =>
        teacher.user_id ===
        selectedTeacherId
    ) ?? null;

  const timeOptions =
    useMemo(() => {
      const source =
        allowedTimeSlots
          .filter(
            (time) =>
              /^([01]\d|2[0-3]):[0-5]\d$/.test(
                time
              )
          )
          .sort();

      if (
        durationMinutes === 50
      ) {
        return source.filter(
          (time) =>
            time.endsWith(
              ":00"
            )
        );
      }

      return source;
    }, [
      allowedTimeSlots,
      durationMinutes,
    ]);

  const allPreferredTimesSelected =
    selectedDays.length ===
      lessonsPerWeek &&
    Boolean(preferredTime) &&
    shownTimeOptions.includes(preferredTime);

  const canSubmit =
    hasSearched &&
    matchingTeachers.length >
      0 &&
    allPreferredTimesSelected &&
    !submitting &&
    !successMessage;

  function resetSearchResult() {
    setConsultationReview(false);
    setMatchingTeachers(
      []
    );
    setHasSearched(
      false
    );
    setErrorMessage(
      ""
    );
    setSuccessMessage(
      ""
    );
  }

  function toggleDay(
    day: string
  ) {
    setConsultationReview(false);
    setPreferredTime("");
    setErrorMessage(
      ""
    );
    setSuccessMessage(
      ""
    );

    if (
      selectedDays.includes(
        day
      )
    ) {
      setSelectedDays(
        (current) =>
          current.filter(
            (item) =>
              item !== day
          )
      );

      setMatchingTeachers(
        []
      );
      setHasSearched(
        false
      );
      return;
    }

    if (
      selectedDays.length >=
      lessonsPerWeek
    ) {
      setErrorMessage(
        `주 ${lessonsPerWeek}회 수업이므로 요일은 ${lessonsPerWeek}개까지만 선택할 수 있습니다.`
      );
      return;
    }

    if (
      (
        day === "Saturday" &&
        selectedDays.includes(
          "Sunday"
        )
      ) ||
      (
        day === "Sunday" &&
        selectedDays.includes(
          "Saturday"
        )
      )
    ) {
      setErrorMessage(
        "토요일과 일요일은 동시에 선택할 수 없습니다. 주말 수업은 둘 중 하나만 선택해주세요."
      );
      return;
    }

    setSelectedDays(
      (current) => [
        ...current,
        day,
      ]
    );

    resetSearchResult();
  }

  async function searchAvailability() {
    setErrorMessage(
      ""
    );
    setSuccessMessage(
      ""
    );
    setMatchingTeachers(
      []
    );
    setHasSearched(
      false
    );

    if (
      !selectedCourseId
    ) {
      setErrorMessage(
        "교육과정을 선택해주세요."
      );
      return;
    }

    if (!startDate) {
      setErrorMessage(
        "수강 시작 기준일을 선택해주세요."
      );
      return;
    }

    if (
      selectedDays.length !==
      lessonsPerWeek
    ) {
      setErrorMessage(
        `주 ${lessonsPerWeek}회 수업은 희망 요일을 정확히 ${lessonsPerWeek}개 선택해주세요.`
      );
      return;
    }

    if (
      !allPreferredTimesSelected
    ) {
      setErrorMessage(
        "선택한 모든 요일에 적용할 희망 수업시간을 선택해주세요."
      );
      return;
    }

    if (
      teacherMode ===
        "specific" &&
      !selectedTeacherId
    ) {
      setErrorMessage(
        "특정 강사를 선택해주세요."
      );
      return;
    }

    setSearching(
      true
    );

    try {
      const matchedByDay:
        MatchingTeacher[][] =
          [];

      for (
        const day of
        selectedDays
      ) {
        const date =
          getNextDateForWeekday({
            baseDateText:
              startDate,
            weekday: day,
          });

        if (!date) {
          throw new Error(
            `${DAY_LABELS[day] ?? day}요일 날짜를 계산하지 못했습니다.`
          );
        }

        const response =
          await fetch(
            "/api/parent/teacher-availability",
            {
              method:
                "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  date,
                  durationMinutes,
                  teacherUserId:
                    teacherMode ===
                      "specific"
                      ? selectedTeacherId
                      : undefined,
                }),
            }
          );

        const data =
          (await response.json()) as
            AvailabilityResponse;

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              "강사 가용시간을 조회하지 못했습니다."
          );
        }

        const requestedTime =
          preferredTime;

        const matches =
          (
            data.availableTeachers ??
            []
          )
            .filter(
              (teacher) =>
                teacher.availableTimes.includes(
                  requestedTime
                )
            )
            .map(
              (teacher) => ({
                teacherUserId:
                  teacher.teacherUserId,
                displayName:
                  teacher.displayName,
                nationality:
                  teacher.nationality,
                specialties:
                  teacher.specialties,
                yearsExperience:
                  teacher.yearsExperience,
              })
            );

        matchedByDay.push(
          matches
        );
      }

      const first =
        matchedByDay[0] ??
        [];

      const common =
        first.filter(
          (teacher) =>
            tuitionRegionForNationality(teacher.nationality) === preferredRegion &&
            matchedByDay.every(
              (dayTeachers) =>
                dayTeachers.some(
                  (item) =>
                    item.teacherUserId ===
                    teacher.teacherUserId
                )
            )
        );

      setMatchingTeachers(
        common
      );
      setHasSearched(
        true
      );

      if (
        common.length === 0
      ) {
        const scheduleText =
          selectedDays
            .map(
              (day) =>
                `${DAY_LABELS[day] ?? day} ${preferredTime}`
            )
            .join(
              " / "
            );

        setErrorMessage(
          `${scheduleText} 조건을 모두 만족하는 강사를 찾지 못했습니다. 희망시간, 요일 또는 강사 조건을 변경해주세요.`
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "가용시간 조회 중 오류가 발생했습니다."
      );
    } finally {
      setSearching(
        false
      );
    }
  }

  async function submitCustomRequest() {
    setErrorMessage(
      ""
    );
    setSuccessMessage(
      ""
    );

    if (
      !selectedCourse ||
      !canSubmit
    ) {
      setErrorMessage(
        "신청 조건을 다시 확인해주세요."
      );
      return;
    }

    if (checkoutMode === "direct" && startDate < getTomorrowDateText()) {
      setErrorMessage("바로 결제는 내일 이후를 수업 시작 기준일로 선택해 주세요.");
      return;
    }

    if (checkoutMode === "consultation" && !consultationReview) {
      setConsultationReview(true);
      return;
    }

    const teacherText =
      teacherMode ===
        "specific"
        ? (
            selectedTeacher?.display_name ??
            "선택 강사"
          )
        : `가능한 강사 ${matchingTeachers.length}명 중 배정`;

    const confirmed = checkoutMode === "consultation" ? true : window.confirm(
        `${childName}${isDirectStudent ? "님의" : " 학생의"} 맞춤 수강신청을 접수하시겠습니까?\n\n과정: ${selectedCourse.name}\n수업: ${durationMinutes}분 · 주 ${lessonsPerWeek}회\n강사: ${teacherText}\n희망일정: ${selectedDays
          .map(
            (day) =>
              `${DAY_LABELS[day] ?? day} ${preferredTime}`
          )
          .join(" / ")}`
      );

    if (!confirmed) {
      return;
    }

    setSubmitting(
      true
    );

    try {
      const response =
        await fetch(
          "/api/parent/enrollment-requests",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                requestType:
                  "custom",
                pricingCategory: preferredRegion,
                durationMonths: tuitionMonths,
                childId,
                levelTestId:
                  levelTestId ??
                  null,
                courseId:
                  selectedCourse.id,
                lessonDurationMinutes:
                  durationMinutes,
                lessonsPerWeek,
                preferredDays:
                  selectedDays,
                preferredTimes:
                  Object.fromEntries(
                    selectedDays.map(
                      (day) => [
                        day,
                        preferredTime,
                      ]
                    )
                  ),
                teacherPreferenceType:
                  teacherMode,
                preferredTeacherUserId:
                  teacherMode ===
                    "specific"
                    ? selectedTeacherId
                    : null,
                startDate,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        setErrorMessage(
          result.error ||
            "맞춤 수강신청 접수에 실패했습니다."
        );
        return;
      }

      if (checkoutMode === "direct") {
        const assignedTeacherId = teacherMode === "specific"
          ? selectedTeacherId
          : matchingTeachers[0]?.teacherUserId;
        if (!assignedTeacherId || !Number.isSafeInteger(Number(result.requestId))) {
          setErrorMessage("신청은 접수되었지만 강사 또는 신청번호를 확인하지 못했습니다. 관리자와 상담해 주세요.");
          return;
        }
        const directResponse = await fetch(
          `/api/parent/enrollment-requests/${result.requestId}/direct-checkout`,
          { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teacherUserId: assignedTeacherId }) }
        );
        const directResult = await directResponse.json();
        if (!directResponse.ok) {
          setErrorMessage(
            directResult.error || "즉시 결제할 수업 시간을 확보하지 못했습니다."
          );
          setSuccessMessage("즉시 결제가 불가능하여 관리자 상담 신청으로 접수되었습니다. 신청 현황에서 확인해 주세요.");
          // Keep the application pending for administrator follow-up.
          return;
        }
        setSuccessMessage("수업 일정이 자동 확정되었습니다. 결제 안내로 이동합니다.");
        router.push(directResult.href);
        return;
      }
      setSuccessMessage("관리자 상담 신청이 접수되었습니다.");
      router.push(resolvedEnrollmentRequestsHref);
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "맞춤 수강신청 접수 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }

  return (
    <section
      className="talkly-card"
      style={{
        marginTop: "24px",
        padding: "30px",
      }}
    >
      <div className="talkly-section-label">
        CUSTOM CLASS
      </div>

      <h2
        style={{
          margin:
            "7px 0 0",
          color:
            "var(--talkly-navy)",
          fontSize: "27px",
        }}
      >
        원하는 수업 조건을
        선택해주세요.
      </h2>

      <p
        style={{
          margin:
            "9px 0 0",
          color:
            "var(--text-muted)",
          lineHeight: 1.75,
        }}
      >
        교육과정, 주당 수업 횟수, 수강기간, 요일과 희망시간을 선택해 주세요.
      </p>

      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
        <div>
          <FieldLabel>강사 구분</FieldLabel>
          <select aria-label="강사 구분" value={preferredRegion} style={fieldStyle}
            onChange={(event) => {
              setPreferredRegion(event.target.value as TuitionRegion);
              setSelectedTeacherId("");
              setTeacherMode("any");
              setPreferredTime("");
              resetSearchResult();
            }}>
            {TUITION_REGIONS.map((region) => <option key={region.key} value={region.key}>{region.label}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>총 수강기간</FieldLabel>
          <select aria-label="총 수강기간" value={tuitionMonths} style={fieldStyle}
            onChange={(event) => {
              setTuitionMonths(Number(event.target.value) as TuitionMonths);
              resetSearchResult();
            }}>
            {TUITION_MONTHS.map((period) => <option key={period.months} value={period.months}>
              {period.months}개월{period.discount ? ` · ${period.discount}% 할인` : ""}
            </option>)}
          </select>
        </div>
      </div>

      {recommendedCourse && (
        <div
          style={{
            marginTop: "20px",
            padding:
              "17px 18px",
            border:
              "1px solid #b2ccff",
            borderRadius:
              "12px",
            background:
              "#eff8ff",
          }}
        >
          <div
            style={{
              color:
                "#175cd3",
              fontSize:
                "11px",
              fontWeight:
                900,
            }}
          >
            레벨테스트 추천
          </div>

          <div
            style={{
              marginTop:
                "5px",
              color:
                "#0a1f44",
              fontWeight:
                900,
            }}
          >
            {
              recommendedCourse.name
            }
            {recommendedLevel
              ? ` · ${recommendedLevel}`
              : ""}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "24px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <div>
          <FieldLabel>
            교육과정
          </FieldLabel>

          <select
            value={
              selectedCourseId
            }
            onChange={(
              event
            ) => {
              const next =
                event.target.value;

              setSelectedCourseId(
                next
                  ? Number(next)
                  : ""
              );

              resetSearchResult();
            }}
            style={
              fieldStyle
            }
          >
            <option value="">
              과정 선택
            </option>

            {courses.map(
              (course) => (
                <option
                  key={
                    course.id
                  }
                  value={
                    course.id
                  }
                >
                  {
                    course.name
                  }
                  {recommendedCourse?.id ===
                  course.id
                    ? " · 추천"
                    : ""}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <FieldLabel>
            수강 시작 기준일
          </FieldLabel>

          <input
            type="date"
            min={
              checkoutMode === "direct" ? getTomorrowDateText() : getTodayDateText()
            }
            value={
              startDate
            }
            onChange={(
              event
            ) => {
              setStartDate(
                event.target.value
              );
              resetSearchResult();
            }}
            style={
              fieldStyle
            }
          />
        </div>

        <div>
          <FieldLabel>
            주당 수업 횟수
          </FieldLabel>

          <select
            value={
              lessonsPerWeek
            }
            onChange={(
              event
            ) => {
              setLessonsPerWeek(
                Number(
                  event.target.value
                )
              );
              setSelectedDays(
                []
              );
              setPreferredTime(
                ""
              );
              resetSearchResult();
            }}
            style={
              fieldStyle
            }
          >
            {usableLessons.map(
              (value) => (
                <option
                  key={
                    value
                  }
                  value={
                    value
                  }
                >
                  주 {value}회
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <FieldLabel>
          희망 요일 ·{" "}
          {lessonsPerWeek}개
          선택
        </FieldLabel>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {visibleWeekdays.map(
            (day) => (
              <ChoiceButton
                key={day}
                active={
                  selectedDays.includes(
                    day
                  )
                }
                onClick={() =>
                  toggleDay(day)
                }
              >
                {
                  DAY_LABELS[
                    day
                  ]
                }
              </ChoiceButton>
            )
          )}
        </div>

        <div
          style={{
            marginTop: "8px",
            color:
              "#98a2b3",
            fontSize: "11px",
            lineHeight: 1.6,
          }}
        >
          정규수업은 평일 25분 수업만 신청할 수 있습니다. 주말·50분 수업은 별도 상담해 주세요.
        </div>
      </div>

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <FieldLabel>
          강사 선택
        </FieldLabel>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <ChoiceButton
            active={
              teacherMode ===
              "any"
            }
            onClick={() => {
              setTeacherMode(
                "any"
              );
              setSelectedTeacherId(
                ""
              );
              setPreferredTime("");
              resetSearchResult();
            }}
          >
            모든 강사
          </ChoiceButton>

          {allowTeacherChoice && (
            <ChoiceButton
              active={
                teacherMode ===
                "specific"
              }
              onClick={() => {
                setTeacherMode(
                  "specific"
                );
                setPreferredTime("");
                resetSearchResult();
              }}
            >
              특정 강사 선택
            </ChoiceButton>
          )}
        </div>

        {teacherMode ===
          "specific" &&
          allowTeacherChoice && (
            <div
              style={{
                marginTop:
                  "12px",
              }}
            >
              <select
                value={
                  selectedTeacherId
                }
                onChange={(
                  event
                ) => {
                  setSelectedTeacherId(event.target.value);
                  setPreferredTime("");
                  resetSearchResult();
                }}
                style={
                  fieldStyle
                }
              >
                <option value="">
                  강사 선택
                </option>

                {teachers.filter((teacher) => tuitionRegionForNationality(teacher.nationality) === preferredRegion).map(
                  (teacher) => (
                    <option
                      key={
                        teacher.user_id
                      }
                      value={
                        teacher.user_id
                      }
                    >
                      {teacher.display_name ||
                        "이름 미등록"}
                      {teacher.nationality
                        ? ` · ${teacher.nationality}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </div>
          )}
      </div>

      {selectedDays.length >
        0 && (
        <div
          style={{
            marginTop: "24px",
          }}
        >
          <FieldLabel>
            희망 수업시간
          </FieldLabel>

          <div
            style={{
              padding: "16px",
              border:
                "1px solid #e4e7ec",
              borderRadius:
                "12px",
              background:
                "#fcfcfd",
            }}
          >
            <div
              style={{
                marginBottom:
                  "10px",
                color:
                  "#667085",
                fontSize:
                  "12px",
                lineHeight:
                  1.7,
              }}
            >
              선택한 모든 요일에
              동일한 시간으로
              수업합니다.
              예: 월·화 선택 +
              15:00 선택 → 월요일과
              화요일 모두 15:00 수업
            </div>

            {teacherMode === "specific" && (
              <p role="status" style={{ fontSize: 12, color: "#526277", margin: "0 0 10px" }}>
                {!selectedTeacherId ? "먼저 강사를 선택해 주세요."
                  : selectedDays.length !== lessonsPerWeek ? "주당 수업 횟수에 맞는 요일을 선택해 주세요."
                  : !specificTimesReady ? "선택한 강사의 실제 가능시간을 조회 중입니다."
                  : specificTeacherTimes?.error ? specificTeacherTimes.error
                  : shownTimeOptions.length === 0 ? "선택한 요일에 공통으로 가능한 시간이 없습니다. 요일이나 강사를 바꿔 주세요."
                  : "선택한 강사가 모든 희망 요일에 수업할 수 있는 시간만 표시됩니다."}
              </p>
            )}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "7px",
              }}
            >
              {shownTimeOptions.map(
                (time) => (
                  <ChoiceButton
                    key={time}
                    active={
                      preferredTime ===
                      time
                    }
                    onClick={() => {
                      setPreferredTime(
                        time
                      );
                      resetSearchResult();
                    }}
                  >
                    {time}
                  </ChoiceButton>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            marginTop: "18px",
            padding:
              "13px 15px",
            border:
              "1px solid #fecdca",
            borderRadius:
              "10px",
            background:
              "#fef3f2",
            color:
              "#b42318",
            fontSize:
              "12px",
            lineHeight: 1.7,
            fontWeight: 700,
          }}
        >
          {errorMessage}
        </div>
      )}

      {!successMessage && (
        <button
        type="button"
        onClick={
          searchAvailability
        }
        disabled={
          searching ||
          !allPreferredTimesSelected
        }
        style={{
          marginTop: "22px",
          minHeight: "52px",
          padding:
            "0 22px",
          border: 0,
          borderRadius:
            "11px",
          background:
            searching ||
            !allPreferredTimesSelected
              ? "#d0d5dd"
              : "#0a1f44",
          color:
            searching ||
            !allPreferredTimesSelected
              ? "#667085"
              : "#ffffff",
          fontFamily:
            "inherit",
          fontSize:
            "14px",
          fontWeight: 900,
          cursor:
            searching ||
            !allPreferredTimesSelected
              ? "not-allowed"
              : "pointer",
        }}
      >
        {searching
          ? "가능 강사 조회 중..."
          : teacherMode === "specific"
            ? "선택한 강사 가능 여부 확인"
            : "가능한 강사 모두 찾기"}
      </button>
      )}

      {hasSearched &&
        matchingTeachers.length >
          0 && (
        <div
          style={{
            marginTop: "28px",
            padding:
              "22px",
            border:
              "1px solid #b2ccff",
            borderRadius:
              "14px",
            background:
              "#f8fbff",
          }}
        >
          <div className="talkly-section-label">
            AVAILABLE
            TEACHERS
          </div>

          <h3
            style={{
              margin:
                "7px 0 0",
              color:
                "#101828",
              fontSize:
                "21px",
            }}
          >
            선택한 희망시간에
            가능한 강사{" "}
            {
              matchingTeachers.length
            }
            명
          </h3>

          <div
            style={{
              marginTop:
                "12px",
              color:
                "#667085",
              fontSize:
                "12px",
              lineHeight:
                1.7,
            }}
          >
            {selectedDays
              .map(
                (day) =>
                  DAY_LABELS[day] ?? day
              )
              .join(" · ")}
            {" · "}
            매 수업 {preferredTime}
          </div>

          <div
            style={{
              marginTop:
                "16px",
              display:
                "grid",
              gap: "10px",
            }}
          >
            {matchingTeachers.map(
              (teacher) => (
                <div
                  key={
                    teacher.teacherUserId
                  }
                  style={{
                    padding:
                      "15px 16px",
                    border:
                      "1px solid #dbe7ff",
                    borderRadius:
                      "11px",
                    background:
                      "#ffffff",
                  }}
                >
                  <div
                    style={{
                      color:
                        "#101828",
                      fontWeight:
                        900,
                    }}
                  >
                    {
                      teacher.displayName
                    }
                    {teacher.nationality
                      ? ` · ${teacher.nationality}`
                      : ""}
                  </div>
                </div>
              )
            )}
          </div>

          {teacherMode ===
            "any" && (
            <div
              style={{
                marginTop:
                  "12px",
                color:
                  "#667085",
                fontSize:
                  "11px",
                lineHeight:
                  1.7,
              }}
            >
              ‘가능한 강사 모두
              찾기’로 신청하면
              위 강사들 중 실제
              배정 시점에 가능한
              강사를 TALKLY에서
              최종 배정합니다.
            </div>
          )}

          <div
            style={{
              marginTop:
                "18px",
              padding:
                "15px",
              borderRadius:
                "10px",
              background:
                "#ffffff",
              color:
                "#475467",
              fontSize:
                "12px",
              lineHeight: 1.85,
            }}
          >
            <strong>
              신청 조건
            </strong>
            <br />
            {isDirectStudent
              ? "수강생"
              : "학생"}: {childName}
            <br />
            과정:{" "}
            {selectedCourse?.name ??
              "미선택"}
            <br />
            수업:{" "}
            {durationMinutes}분 ·
            주 {lessonsPerWeek}회
            <br />
            강사:{" "}
            {teacherMode ===
            "specific"
              ? selectedTeacher?.display_name ??
                "특정 강사"
              : "가능한 강사 중 배정"}
            <br />
            희망일정:{" "}
            {selectedDays
              .map(
                (day) =>
                  DAY_LABELS[day] ?? day
              )
              .join(" · ")}
            {" · "}
            매 수업 {preferredTime}
          </div>

          {!successMessage && (
            <div role="group" aria-label="결제 방법 선택" style={{ marginTop: 18, display: "grid", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 10,
                border: checkoutMode === "direct" ? "2px solid #326bd1" : "1px solid #dce4ee",
                background: checkoutMode === "direct" ? "#eff5ff" : "#fff", cursor: "pointer" }}>
                <input type="radio" name="checkoutMode" checked={checkoutMode === "direct"}
                  onChange={() => { setCheckoutMode("direct");
                    if (startDate < getTomorrowDateText()) setStartDate(getTomorrowDateText());
                    resetSearchResult();
                  }} />
                <span><strong>바로 수강료 결제</strong>
                  <small style={{ display: "block", color: "#667085" }}>강사·시간이 확인되면 자동 배정 후 결제 안내로 이동합니다.</small></span>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 10,
                border: checkoutMode === "consultation" ? "2px solid #326bd1" : "1px solid #dce4ee",
                background: checkoutMode === "consultation" ? "#eff5ff" : "#fff", cursor: "pointer" }}>
                <input type="radio" name="checkoutMode" checked={checkoutMode === "consultation"}
                  onChange={() => { setCheckoutMode("consultation"); resetSearchResult(); }} />
                <span><strong>관리자에게 수강신청</strong>
                  <small style={{ display: "block", color: "#667085" }}>관리자와 상담한 뒤 강사·일정 확정 후 결제합니다.</small></span>
              </label>
            </div>
          )}
          {checkoutMode === "consultation" && consultationReview && !successMessage && (
            <section aria-label="관리자 상담 신청 내역 최종 확인"
              style={{ marginTop: 16, padding: 16, background: "#eff5ff",
                border: "1px solid #b2ccff", borderRadius: 12 }}>
              <strong style={{ color: "#0a1f44" }}>신청 내역을 최종 확인해 주세요.</strong>
              <p style={{ color: "#526277", fontSize: 12, lineHeight: 1.75 }}>
                위의 교육과정, 강사, 주당 수업 횟수, 수강기간, 요일과 희망시간을 확인하셨다면
                ‘관리자에게 전송하기’를 눌러주세요. 관리자가 일정 조정 후 최종 결제를 안내합니다.
              </p>
              <button type="button" onClick={() => setConsultationReview(false)}
                style={{ padding: "8px 13px", border: "1px solid #aabdd8",
                  borderRadius: 8, background: "#fff", color: "#0a1f44", cursor: "pointer" }}>
                신청 내용 수정하기
              </button>
            </section>
          )}
          {!successMessage && (
            <button
              type="button"
              onClick={
                submitCustomRequest
              }
              disabled={
                !canSubmit
              }
              style={{
                marginTop:
                  "16px",
                width: "100%",
                minHeight:
                  "52px",
                border: 0,
                borderRadius:
                  "11px",
                background:
                  canSubmit
                    ? "#0a1f44"
                    : "#d0d5dd",
                color:
                  canSubmit
                    ? "#ffffff"
                    : "#667085",
                fontFamily:
                  "inherit",
                fontSize:
                  "14px",
                fontWeight:
                  900,
                cursor:
                  canSubmit
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              {submitting
                ? "수강신청 접수 중..."
                : checkoutMode === "direct" ? "일정 확인 후 바로 결제" : consultationReview ? "관리자에게 전송하기" : "수강신청 내용 확인하기"}
            </button>
          )}
        </div>
      )}

      {successMessage && (
        <div
          ref={completionRef}
          style={{
            marginTop: "28px",
            padding: "24px",
            border: "1px solid #abefc6",
            borderRadius: "16px",
            background:
              "linear-gradient(180deg, #f0fdf4 0%, #ecfdf3 100%)",
            boxShadow:
              "0 10px 28px rgba(6, 118, 71, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "14px",
              alignItems: "flex-start",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: "42px",
                height: "42px",
                flex: "0 0 42px",
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                background: "#dcfae6",
                color: "#067647",
                fontSize: "22px",
                fontWeight: 900,
              }}
            >
              ✓
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  color: "#067647",
                  fontSize: "17px",
                  fontWeight: 900,
                  lineHeight: 1.5,
                }}
              >
                수강신청이 정상적으로 접수되었습니다.
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "#344054",
                  fontSize: "13px",
                  lineHeight: 1.8,
                }}
              >
                TALKLY에서 희망일정의 가용성을 다시 확인한 뒤 실제 강사와 수업 일정을 배정합니다.
                <br />
                배정이 완료되면 수강기간과 결제금액을 확인하고 결제를 진행할 수 있습니다.
              </div>

              <div
                style={{
                  marginTop: "18px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      resolvedEnrollmentRequestsHref
                    )
                  }
                  style={{
                    minHeight: "44px",
                    padding: "0 17px",
                    border: 0,
                    borderRadius: "10px",
                    background: "#0a1f44",
                    color: "#ffffff",
                    fontFamily: "inherit",
                    fontSize: "13px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  수강신청 현황 보기 →
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      resolvedReturnHref
                    )
                  }
                  style={{
                    minHeight: "44px",
                    padding: "0 17px",
                    border: "1px solid #b7c7da",
                    borderRadius: "10px",
                    background: "#ffffff",
                    color: "#0a1f44",
                    fontFamily: "inherit",
                    fontSize: "13px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {resolvedReturnLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FieldLabel({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: "7px",
        color: "#344054",
        fontSize: "12px",
        fontWeight: 900,
      }}
    >
      {children}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: "38px",
        padding:
          "0 13px",
        border: active
          ? "1px solid #2f6fed"
          : "1px solid #d0d5dd",
        borderRadius:
          "9px",
        background:
          active
            ? "#eff8ff"
            : "#ffffff",
        color: active
          ? "#175cd3"
          : "#475467",
        fontFamily:
          "inherit",
        fontSize:
          "12px",
        fontWeight: 800,
        cursor:
          "pointer",
      }}
    >
      {children}
    </button>
  );
}

const fieldStyle:
  CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "0 12px",
  border:
    "1px solid #d0d5dd",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "13px",
  outline: "none",
};