"use client";

import {
  useMemo,
  useState,
} from "react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

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
  success?: boolean;
  date?: string;
  dayOfWeek?: number;
  weekdayName?: string;
  durationMinutes?: number;
  availableTeachers?: AvailabilityTeacher[];
  totalAvailableSlots?: number;
  message?: string;
  error?: string;
};

type DaySearchResult = {
  day: string;
  date: string;
  teachers: AvailabilityTeacher[];
};

type TeacherCombination = {
  teacherUserId: string;
  displayName: string;
  nationality: string | null;
  specialties: string[];
  yearsExperience: number | null;
  slotsByDay: Record<
    string,
    {
      date: string;
      times: string[];
    }
  >;
};

type Props = {
  childId: number;
  childName: string;
  allowedWeekdays: string[];
  allowedLessonsPerWeek: number[];
  allowedDurationMinutes?: number[];
  courses: CourseSummary[];
  teachers: TeacherSummary[];
  allowTeacherChoice?: boolean;
  recommendedCourse?: CourseSummary | null;
  recommendedLevel?: string | null;
  levelTestId?: number | null;
};

const DAY_LABELS: Record<
  string,
  string
> = {
  Sunday: "일",
  Monday: "월",
  Tuesday: "화",
  Wednesday: "수",
  Thursday: "목",
  Friday: "금",
  Saturday: "토",
};

const DAY_INDEX: Record<
  string,
  number
> = {
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
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function getTodayDateText() {
  return formatDateOnly(
    new Date()
  );
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

function getTeacherCombinations(
  dayResults: DaySearchResult[]
) {
  if (
    dayResults.length === 0
  ) {
    return [];
  }

  const firstDay =
    dayResults[0];

  return firstDay.teachers
    .map(
      (
        teacher
      ): TeacherCombination | null => {
        const slotsByDay:
          TeacherCombination["slotsByDay"] =
          {};

        for (
          const dayResult of
          dayResults
        ) {
          const sameTeacher =
            dayResult.teachers.find(
              (item) =>
                item.teacherUserId ===
                teacher.teacherUserId
            );

          if (
            !sameTeacher ||
            sameTeacher.availableTimes
              .length === 0
          ) {
            return null;
          }

          slotsByDay[
            dayResult.day
          ] = {
            date:
              dayResult.date,
            times:
              sameTeacher.availableTimes,
          };
        }

        return {
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
          slotsByDay,
        };
      }
    )
    .filter(
      (
        value
      ): value is TeacherCombination =>
        value !== null
    );
}

export default function CustomEnrollmentScheduler({
  childId,
  childName,
  allowedWeekdays,
  allowedLessonsPerWeek,
  allowedDurationMinutes = [
    25,
    50,
  ],
  courses,
  teachers,
  allowTeacherChoice = true,
  recommendedCourse = null,
  recommendedLevel = null,
  levelTestId = null,
}: Props) {
  const usableDurations =
    allowedDurationMinutes.filter(
      (value) =>
        value === 25 ||
        value === 50
    );

  const usableLessons =
    allowedLessonsPerWeek
      .filter(
        (value) =>
          Number.isInteger(
            value
          ) &&
          value > 0
      )
      .sort(
        (a, b) =>
          a - b
      );

  const visibleWeekdays =
    DAY_ORDER.filter(
      (day) =>
        allowedWeekdays.includes(
          day
        )
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
    getTodayDateText()
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

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    dayResults,
    setDayResults,
  ] = useState<
    DaySearchResult[]
  >([]);

  const [
    selectedCombinationTeacherId,
    setSelectedCombinationTeacherId,
  ] = useState("");

  const [
    selectedTimes,
    setSelectedTimes,
  ] = useState<
    Record<
      string,
      string
    >
  >({});

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const router =
    useRouter();

  const combinations =
    useMemo(
      () =>
        getTeacherCombinations(
          dayResults
        ),
      [dayResults]
    );

  const selectedCombination =
    combinations.find(
      (item) =>
        item.teacherUserId ===
        selectedCombinationTeacherId
    ) ?? null;

  const selectedCourse =
    courses.find(
      (course) =>
        course.id ===
        Number(
          selectedCourseId
        )
    ) ?? null;

  const hasWeekend =
    selectedDays.some(
      (day) =>
        day ===
          "Saturday" ||
        day === "Sunday"
    );

  const allTimesSelected =
    selectedDays.length >
      0 &&
    selectedDays.every(
      (day) =>
        Boolean(
          selectedTimes[
            day
          ]
        )
    );

  function resetResults() {
    setDayResults([]);
    setSelectedCombinationTeacherId(
      ""
    );
    setSelectedTimes(
      {}
    );
  }

  function resetWithMessageClear() {
    resetResults();
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
    setErrorMessage(
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

      resetResults();
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
        day ===
          "Saturday" &&
        selectedDays.includes(
          "Sunday"
        )
      ) ||
      (
        day ===
          "Sunday" &&
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

    resetResults();
  }

  async function searchAvailability() {
    setErrorMessage(
      ""
    );
    resetResults();

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
      const results:
        DaySearchResult[] =
          [];

      for (
        const day of
        selectedDays
      ) {
        const date =
          getNextDateForWeekday(
            {
              baseDateText:
                startDate,
              weekday: day,
            }
          );

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
                JSON.stringify(
                  {
                    date,
                    durationMinutes,
                    teacherUserId:
                      teacherMode ===
                        "specific"
                        ? selectedTeacherId
                        : undefined,
                  }
                ),
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

        results.push(
          {
            day,
            date,
            teachers:
              data.availableTeachers ??
              [],
          }
        );
      }

      setDayResults(
        results
      );

      const next =
        getTeacherCombinations(
          results
        );

      if (
        next.length === 0
      ) {
        setErrorMessage(
          "선택한 모든 요일에 수업 가능한 동일 강사를 찾지 못했습니다. 요일·시간·강사 조건을 바꿔 다시 조회해주세요."
        );
        return;
      }

      if (
        next.length === 1
      ) {
        setSelectedCombinationTeacherId(
          next[0]
            .teacherUserId
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
    setErrorMessage("");
    setSuccessMessage("");

    if (
      !selectedCourse ||
      !selectedCombination ||
      !allTimesSelected
    ) {
      setErrorMessage(
        "교육과정, 강사, 희망시간을 모두 선택해주세요."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `${childName} 학생의 맞춤 수강신청을 접수하시겠습니까?\n\n과정: ${selectedCourse.name}\n수업: ${durationMinutes}분 · 주 ${lessonsPerWeek}회\n강사: ${selectedCombination.displayName}\n요일: ${selectedDays
          .map(
            (day) =>
              `${DAY_LABELS[day] ?? day} ${selectedTimes[day]}`
          )
          .join(" / ")}`
      );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);

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
                  selectedTimes,
                teacherPreferenceType:
                  teacherMode,
                preferredTeacherUserId:
                  teacherMode ===
                    "specific"
                    ? selectedCombination.teacherUserId
                    : null,
                startDate,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "맞춤 수강신청 접수에 실패했습니다."
        );
        return;
      }

      setSuccessMessage(
        "맞춤 수강신청이 접수되었습니다. TALKLY에서 실제 강사와 수업 일정을 확인한 뒤 배정 내용을 안내합니다."
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "맞춤 수강신청 접수 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="talkly-card"
      style={{
        marginTop: "28px",
        padding: "28px",
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
        원하는 조건으로
        맞춤 수업 찾기
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
        수업시간, 주당 횟수,
        요일과 강사를 선택하면
        실제 강사 근무시간과
        예외일정, 이미 배정된
        수업을 반영하여 가능한
        시간을 조회합니다.
      </p>

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

          {levelTestId && (
            <div
              style={{
                marginTop:
                  "5px",
                color:
                  "#667085",
                fontSize:
                  "11px",
              }}
            >
              추천 결과를
              기준으로 시작하되
              과정은 변경할 수
              있습니다.
            </div>
          )}
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
                event.target
                  .value;

              setSelectedCourseId(
                next
                  ? Number(
                      next
                    )
                  : ""
              );

              resetWithMessageClear();
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
              getTodayDateText()
            }
            value={
              startDate
            }
            onChange={(
              event
            ) => {
              setStartDate(
                event.target
                  .value
              );
              resetWithMessageClear();
            }}
            style={
              fieldStyle
            }
          />
        </div>

        <div>
          <FieldLabel>
            수업 시간
          </FieldLabel>

          <select
            value={
              durationMinutes
            }
            onChange={(
              event
            ) => {
              setDurationMinutes(
                Number(
                  event.target
                    .value
                )
              );
              resetWithMessageClear();
            }}
            style={
              fieldStyle
            }
          >
            {usableDurations.map(
              (value) => (
                <option
                  key={
                    value
                  }
                  value={
                    value
                  }
                >
                  {value}분
                </option>
              )
            )}
          </select>
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
              const next =
                Number(
                  event.target
                    .value
                );

              setLessonsPerWeek(
                next
              );

              setSelectedDays(
                []
              );

              resetWithMessageClear();
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
          marginTop: "22px",
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
                  toggleDay(
                    day
                  )
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
          토요일과 일요일은
          동시에 선택할 수
          없습니다. 주말 수업은
          기본 평일 수업료의
          1.5배 정책이
          적용됩니다.
        </div>
      </div>

      <div
        style={{
          marginTop: "22px",
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
              resetWithMessageClear();
            }}
          >
            가능한 강사 모두
            찾기
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
                resetWithMessageClear();
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
                  setSelectedTeacherId(
                    event.target
                      .value
                  );
                  resetWithMessageClear();
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

      {hasWeekend && (
        <div
          style={{
            marginTop: "18px",
            padding:
              "13px 15px",
            border:
              "1px solid #fedf89",
            borderRadius:
              "10px",
            background:
              "#fffaeb",
            color:
              "#93370d",
            fontSize:
              "12px",
            lineHeight: 1.7,
            fontWeight: 700,
          }}
        >
          선택한 일정에 주말
          수업이 포함되어
          있습니다. 주말 수업은
          평일 수업료의 1.5배로
          계산됩니다.
        </div>
      )}

      {successMessage && (
        <div
          style={{
            marginTop: "18px",
            padding:
              "13px 15px",
            border:
              "1px solid #abefc6",
            borderRadius:
              "10px",
            background:
              "#ecfdf3",
            color:
              "#067647",
            fontSize:
              "12px",
            lineHeight: 1.7,
            fontWeight: 700,
          }}
        >
          {successMessage}
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

      <button
        type="button"
        onClick={
          searchAvailability
        }
        disabled={
          searching
        }
        style={{
          marginTop: "22px",
          minHeight: "50px",
          padding:
            "0 22px",
          border: 0,
          borderRadius:
            "11px",
          background:
            searching
              ? "#98a2b3"
              : "#0a1f44",
          color: "#ffffff",
          fontFamily:
            "inherit",
          fontSize:
            "14px",
          fontWeight: 900,
          cursor:
            searching
              ? "wait"
              : "pointer",
        }}
      >
        {searching
          ? "가능 시간 조회 중..."
          : "실제 가능한 강사 · 시간 찾기"}
      </button>

      {dayResults.length >
        0 && (
        <div
          style={{
            marginTop: "28px",
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
                "20px",
            }}
          >
            선택한 모든 요일에
            가능한 강사
          </h3>

          {combinations.length ===
          0 ? (
            <div
              style={{
                marginTop:
                  "14px",
                padding:
                  "18px",
                border:
                  "1px dashed #d0d5dd",
                borderRadius:
                  "12px",
                color:
                  "#667085",
                lineHeight:
                  1.7,
              }}
            >
              조건에 맞는
              동일 강사가
              없습니다.
            </div>
          ) : (
            <div
              style={{
                marginTop:
                  "14px",
                display:
                  "grid",
                gap: "12px",
              }}
            >
              {combinations.map(
                (
                  teacher
                ) => {
                  const active =
                    selectedCombinationTeacherId ===
                    teacher.teacherUserId;

                  return (
                    <button
                      type="button"
                      key={
                        teacher.teacherUserId
                      }
                      onClick={() => {
                        setSelectedCombinationTeacherId(
                          teacher.teacherUserId
                        );
                        setSelectedTimes(
                          {}
                        );
                        setErrorMessage(
                          ""
                        );
                      }}
                      style={{
                        padding:
                          "17px",
                        border: active
                          ? "2px solid #2f6fed"
                          : "1px solid #e4e7ec",
                        borderRadius:
                          "12px",
                        background:
                          active
                            ? "#f5f8ff"
                            : "#ffffff",
                        textAlign:
                          "left",
                        fontFamily:
                          "inherit",
                        cursor:
                          "pointer",
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

                      <div
                        style={{
                          marginTop:
                            "8px",
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
                            (
                              day
                            ) => {
                              const slot =
                                teacher.slotsByDay[
                                  day
                                ];

                              return `${
                                DAY_LABELS[
                                  day
                                ] ??
                                day
                              } ${
                                slot?.date ??
                                ""
                              } · ${
                                slot?.times.length ??
                                0
                              }개 가능`;
                            }
                          )
                          .join(
                            " / "
                          )}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {selectedCombination && (
        <div
          style={{
            marginTop: "26px",
            padding:
              "20px",
            border:
              "1px solid #dbe7ff",
            borderRadius:
              "14px",
            background:
              "#f8fbff",
          }}
        >
          <div
            style={{
              color:
                "#0a1f44",
              fontSize:
                "18px",
              fontWeight:
                900,
            }}
          >
            {
              selectedCombination.displayName
            }
            강사의 희망 시간
            선택
          </div>

          <div
            style={{
              marginTop:
                "15px",
              display:
                "grid",
              gap: "14px",
            }}
          >
            {selectedDays.map(
              (day) => {
                const slot =
                  selectedCombination.slotsByDay[
                    day
                  ];

                return (
                  <div
                    key={day}
                  >
                    <div
                      style={{
                        marginBottom:
                          "7px",
                        color:
                          "#475467",
                        fontSize:
                          "12px",
                        fontWeight:
                          900,
                      }}
                    >
                      {
                        DAY_LABELS[
                          day
                        ]
                      }
                      요일 ·{" "}
                      {
                        slot.date
                      }
                    </div>

                    <div
                      style={{
                        display:
                          "flex",
                        flexWrap:
                          "wrap",
                        gap: "7px",
                      }}
                    >
                      {slot.times.map(
                        (
                          time
                        ) => (
                          <ChoiceButton
                            key={
                              `${day}-${time}`
                            }
                            active={
                              selectedTimes[
                                day
                              ] ===
                              time
                            }
                            onClick={() => {
                              setSelectedTimes(
                                (
                                  current
                                ) => ({
                                  ...current,
                                  [day]:
                                    time,
                                })
                              );
                              setErrorMessage(
                                ""
                              );
                            }}
                          >
                            {
                              time
                            }
                          </ChoiceButton>
                        )
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          <div
            style={{
              marginTop:
                "20px",
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
              lineHeight: 1.8,
            }}
          >
            <strong>
              현재 선택 요약
            </strong>
            <br />
            학생:{" "}
            {childName}
            <br />
            과정:{" "}
            {selectedCourse?.name ??
              "미선택"}
            <br />
            수업:{" "}
            {durationMinutes}분 ·
            주{" "}
            {lessonsPerWeek}회
            <br />
            강사:{" "}
            {
              selectedCombination.displayName
            }
            <br />
            희망 일정:{" "}
            {selectedDays
              .map(
                (
                  day
                ) =>
                  `${
                    DAY_LABELS[
                      day
                    ] ??
                    day
                  } ${
                    selectedTimes[
                      day
                    ] ??
                    "미선택"
                  }`
              )
              .join(
                " · "
              )}
          </div>

          <button
            type="button"
            onClick={
              submitCustomRequest
            }
            disabled={
              !allTimesSelected ||
              submitting ||
              Boolean(
                successMessage
              )
            }
            style={{
              marginTop:
                "16px",
              width: "100%",
              minHeight:
                "50px",
              border: 0,
              borderRadius:
                "11px",
              background:
                !allTimesSelected ||
                submitting ||
                Boolean(
                  successMessage
                )
                  ? "#d0d5dd"
                  : "#0a1f44",
              color:
                !allTimesSelected ||
                submitting ||
                Boolean(
                  successMessage
                )
                  ? "#667085"
                  : "#ffffff",
              fontFamily:
                "inherit",
              fontSize:
                "14px",
              fontWeight:
                900,
              cursor:
                !allTimesSelected ||
                submitting ||
                Boolean(
                  successMessage
                )
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {submitting
              ? "수강신청 접수 중..."
              : successMessage
                ? "수강신청 접수 완료"
                : "희망일정으로 수강신청 접수"}
          </button>

          <div
            style={{
              marginTop:
                "8px",
              color:
                "#98a2b3",
              fontSize:
                "11px",
              lineHeight: 1.6,
            }}
          >
            이 단계에서는
            희망 일정만
            접수합니다. 실제
            강사와 정규 일정은
            TALKLY 관리자가
            가용시간을 다시
            확인하여 배정하며,
            수강기간과 최종
            결제금액은 이후
            확정됩니다.
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "20px",
          paddingTop:
            "17px",
          borderTop:
            "1px solid #eaecf0",
          color:
            "#98a2b3",
          fontSize: "11px",
          lineHeight: 1.7,
        }}
      >
        내부 연결값 · childId{" "}
        {childId}
        {levelTestId
          ? ` · levelTestId ${levelTestId}`
          : ""}
      </div>
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
      onClick={
        onClick
      }
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