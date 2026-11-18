"use client";

import {
  useCallback,
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

  const completionRef = useRef<HTMLDivElement | null>(null);
  const matchingRequestId = useRef(0);

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

  const [preferredTimeChoices, setPreferredTimeChoices] = useState<string[]>([]);
  // The enrollment screen now presents one checkout action.
  const [checkoutMode] = useState<"direct" | "consultation">("direct");
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
              /^([01]\d|2[0-3]):(00|30)$/.test(
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


  // 강사·요일을 변경하면 이전 조회 결과 대신 새로운 조건의 결과만 보여줍니다.
  const specificTimesKey = [selectedTeacherId, startDate, durationMinutes, ...selectedDays].join("|");
  const specificTimesReady = specificTeacherTimes?.key === specificTimesKey;
  const shownTimeOptions = teacherMode === "specific"
    ? (specificTimesReady ? specificTeacherTimes?.times ?? [] : [])
    : timeOptions.filter((time) => {
        const hour = Number(time.slice(0, 2));
        return (hour >= 7 && hour <= 11) || (hour >= 15 && hour <= 23);
      });

  useEffect(() => {
    if (teacherMode !== "specific" || !selectedTeacherId ||
        !startDate || selectedDays.length !== lessonsPerWeek) return;
    let cancelled = false;
    const lookupKey = [selectedTeacherId, startDate, durationMinutes, ...selectedDays].join("|");

    async function loadSpecificTeacherTimes() {
      try {
        const timesByDay = await Promise.all(selectedDays.map(async (day) => {
          const date = getNextDateForWeekday({ baseDateText: startDate, weekday: day });
          if (!date) throw new Error("수업 날짜를 계산하지 못했습니다.");
          const response = await fetch("/api/parent/teacher-availability", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, durationMinutes, teacherUserId: selectedTeacherId }),
          });
          const result = (await response.json()) as AvailabilityResponse;
          if (!response.ok) throw new Error(result.error || "강사 가능시간을 불러오지 못했습니다.");
          return result.availableTeachers?.find((teacher) =>
            teacher.teacherUserId === selectedTeacherId)?.availableTimes ?? [];
        }));
        if (!cancelled) setSpecificTeacherTimes({
          key: lookupKey,
          times: timeOptions.filter((time) => timesByDay.every((slots) => slots.includes(time))),
          error: "",
        });
      } catch (error) {
        if (!cancelled) setSpecificTeacherTimes({
          key: lookupKey, times: [],
          error: error instanceof Error ? error.message : "강사 가능시간을 확인하지 못했습니다.",
        });
      }
    }

    void loadSpecificTeacherTimes();
    return () => { cancelled = true; };
  }, [teacherMode, selectedTeacherId, startDate, durationMinutes, selectedDays, lessonsPerWeek, timeOptions]);

  const allPreferredTimesSelected =
    selectedDays.length === lessonsPerWeek &&
    (teacherMode === "any"
      ? preferredTimeChoices.length >= 2 && preferredTimeChoices.length <= 3
      : Boolean(selectedTeacherId) && specificTimesReady &&
        Boolean(preferredTime) && shownTimeOptions.includes(preferredTime));

  const canSubmit = allPreferredTimesSelected &&
    (teacherMode === "any" || (specificTimesReady && shownTimeOptions.includes(preferredTime))) &&
    !searching && !submitting && !successMessage;

  function resetSearchResult() {
    matchingRequestId.current += 1;
    setSearching(false);
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

  const searchAvailability = useCallback(async () => {
    const requestId = ++matchingRequestId.current;
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

      if (requestId !== matchingRequestId.current) return;
      setMatchingTeachers(common);
      setHasSearched(true);

      if (
        common.length === 0 && checkoutMode === "direct"
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
      if (requestId === matchingRequestId.current) {
        setErrorMessage(error instanceof Error ? error.message : "가용시간 조회 중 오류가 발생했습니다.");
        setHasSearched(true);
      }
    } finally {
      if (requestId === matchingRequestId.current) setSearching(false);
    }
  }, [selectedCourseId, startDate, lessonsPerWeek, selectedDays, allPreferredTimesSelected,
      teacherMode, selectedTeacherId, durationMinutes, preferredTime, preferredRegion, checkoutMode]);

  // Schedule and teacher changes refresh the available teachers automatically.
  useEffect(() => {
    if (teacherMode !== "specific" || !allPreferredTimesSelected || !selectedCourseId ||
        !selectedTeacherId) return;
    const timer = window.setTimeout(() => { void searchAvailability(); }, 150);
    return () => window.clearTimeout(timer);
  }, [searchAvailability, allPreferredTimesSelected, selectedCourseId, teacherMode, selectedTeacherId]);

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

    setSubmitting(
      true
    );

    try {
      // 관리자 추천강사는 결제 후 관리자가 배정합니다.
      // 추천 신청 시에는 강사를 자동 검색·선점하지 않습니다.
      const matchedTeacherId: string | null =
        teacherMode === "specific" ? selectedTeacherId : null;
      const selectedStartTime =
        teacherMode === "any" ? preferredTimeChoices[0] : preferredTime;

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
                        selectedStartTime,
                      ]
                    )
                  ),
                preferredTimeCandidates: teacherMode === "any" ? preferredTimeChoices : [],
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
        const assignedTeacherId = matchedTeacherId;
        if (!Number.isSafeInteger(Number(result.requestId))) {
          setErrorMessage("수강신청 번호를 확인할 수 없습니다. 신청 현황에서 확인해 주세요.");
          return;
        }
        if (!assignedTeacherId) {
          // The paid-first recommendation flow uses its own no-assignment checkout.
          setSuccessMessage("수강신청이 접수되었습니다. 결제 후 관리자가 강사와 시간을 배정합니다.");
          const href = isDirectStudent
            ? `/student/enrollment-requests/${result.requestId}`
            : `/parent/children/${childId}/enrollment-requests/${result.requestId}`;
          router.push(href);
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
          setSuccessMessage("희망 수업시간을 임시 확보하지 못했습니다. 신청내역에서 배정 현황을 확인할 수 있습니다.");
          router.push(resolvedEnrollmentRequestsHref);
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
        marginTop: "8px",
        padding: "16px 20px",
      }}
    >

      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
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
            관리자 추천강사
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

        {teacherMode === "any" && (
          <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.7, color: "#526277" }}>
            ‘관리자 추천강사’를 클릭하시면 레벨테스트 결과를 바탕으로 학생에게 적합한 강사를 배치합니다.
          </p>
        )}

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
                  const nextTeacher = teachers.find((teacher) => teacher.user_id === event.target.value);
                  setSelectedTeacherId(event.target.value);
                  if (nextTeacher) setPreferredRegion(tuitionRegionForNationality(nextTeacher.nationality));
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

                {teachers.map(
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
            {teacherMode === "specific" ? "현재 수업 가능한 시간" : "희망 수업시간"}
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
                  "6px",
                color:
                  "#667085",
                fontSize:
                  "12px",
                lineHeight:
                  1.7,
              }}
            >
              {teacherMode === "specific"
                ? "선택한 강사가 현재 수업 가능한 시간만 표시됩니다."
                : "관리자와 협의할 희망시간을 2~3개 선택해 주세요."}
            </div>

            {teacherMode === "specific" && (!specificTimesReady || specificTeacherTimes?.error || shownTimeOptions.length === 0) && (
              <p role="status" style={{ fontSize: 12, color: "#526277", margin: "0 0 8px" }}>
                {!selectedTeacherId ? "먼저 강사를 선택해 주세요."
                  : selectedDays.length !== lessonsPerWeek ? "주당 수업 횟수에 맞는 요일을 선택해 주세요."
                  : !specificTimesReady ? "선택한 강사의 실제 가능시간을 조회 중입니다."
                  : specificTeacherTimes?.error ? specificTeacherTimes.error
                  : shownTimeOptions.length === 0 ? "선택한 요일에 가능한 시간이 없습니다."
                  : "표시된 시간 중 하나를 선택해 주세요."}
              </p>
            )}
            {teacherMode === "specific" && (
              <p style={{ fontSize: 12, margin: "4px 0 10px", color: "#475467" }}>
                맞는 스케줄이 없다면{" "}
                <button type="button" onClick={() => { setTeacherMode("any"); setSelectedTeacherId(""); setPreferredTime(""); resetSearchResult(); }}
                  style={{ border: "1px solid #175cd3", background: "#eff5ff", color: "#175cd3", fontWeight: 800, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                  관리자 추천강사로 수강신청
                </button>
              </p>
            )}
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}
            >
              {shownTimeOptions.map(
                (time) => (
                  <ChoiceButton
                    key={time}
                    active={teacherMode === "any" ? preferredTimeChoices.includes(time) : preferredTime === time}
                    onClick={() => {
                      if (teacherMode === "any") {
                        setPreferredTimeChoices((current) =>
                          current.includes(time) ? current.filter((candidate) => candidate !== time) :
                          current.length < 3 ? [...current, time] : current);
                      } else {
                        setPreferredTime(time);
                      }
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
          {errorMessage.includes("신청 내역에서") && (
            <div style={{ marginTop: 8 }}>
              <a href={resolvedEnrollmentRequestsHref} style={{ color: "#175cd3", fontWeight: 900, textDecoration: "underline" }}>
                진행 중인 신청 확인·취소하기
              </a>
            </div>
          )}
        </div>
      )}
      {selectedDays.length > 0 && (
        <section aria-label="신청 내용 확인" style={{ marginTop: 16, padding: "18px", border: "1px solid #b2ccff", background: "#f8fbff", borderRadius: 12 }}>
          <h3 style={{ fontSize: 18, color: "#0a1f44", margin: "0 0 12px" }}>신청 내용 확인</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 8, fontSize: 13, color: "#475467", lineHeight: 1.6 }}>
            <div><strong>수강생</strong> · {childName}</div>
            <div><strong>교육과정</strong> · {selectedCourse?.name ?? "선택 전"}</div>
            <div><strong>수강기간</strong> · {tuitionMonths}개월</div>
            <div><strong>수업</strong> · {durationMinutes}분 / 주 {lessonsPerWeek}회</div>
            <div><strong>강사</strong> · {teacherMode === "specific" ? selectedTeacher?.display_name ?? "강사 선택 전" : "관리자 추천강사"}</div>
            <div><strong>요일</strong> · {selectedDays.map((day) => DAY_LABELS[day] ?? day).join(" · ")}</div>
            <div><strong>{teacherMode === "any" ? "희망시간 (2~3개)" : "수업시간"}</strong> · {teacherMode === "any" ? preferredTimeChoices.join(" / ") || "선택 전" : preferredTime || "선택 전"}</div>
          </div>
          {!successMessage && (
            <button type="button" onClick={submitCustomRequest} disabled={!canSubmit}
              style={{ display: "block", marginTop: 14, minHeight: 50, width: "100%", border: 0, borderRadius: 10,
                background: canSubmit ? "#0a1f44" : "#d0d5dd", color: canSubmit ? "#fff" : "#667085", fontWeight: 900, fontSize: 15, cursor: canSubmit ? "pointer" : "not-allowed" }}>
              {submitting ? "수강신청 확인 중..." : "수강료 결제하기"}
            </button>
          )}
        </section>
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