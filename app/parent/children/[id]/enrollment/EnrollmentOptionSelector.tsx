"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Child = {
  id: number;
  name: string;
  grade: string | null;
};

type CourseRelation =
  | {
      id: number;
      name: string;
    }
  | {
      id: number;
      name: string;
    }[]
  | null;

type RecommendedCourse = {
  id: number;
  name: string;
} | null;

type EnrollmentOption = {
  id: number;
  title: string;

  course_id: number;
  target_group: string;

  lesson_duration_minutes: number;
  lessons_per_week: number;

  preferred_days: string[];
  preferred_times: Record<
    string,
    string
  >;

  course_weeks: number;

  start_date: string;
  end_date: string;

  total_lessons: number;

  price_per_lesson: number;

  weekend_multiplier:
    | number
    | string;

  weekday_lesson_count: number;
  weekend_lesson_count: number;

  estimated_price: number;

  capacity:
    | number
    | null;

  enrolled_count: number;

  curriculum_name:
    | string
    | null;

  courses:
    CourseRelation;
};

const TARGET_OPTIONS = [
  [
    "age_5_7_phonics",
    "5~7세 파닉스",
  ],

  [
    "elementary_1",
    "초등 1학년",
  ],
  [
    "elementary_2",
    "초등 2학년",
  ],
  [
    "elementary_3",
    "초등 3학년",
  ],
  [
    "elementary_4",
    "초등 4학년",
  ],
  [
    "elementary_5",
    "초등 5학년",
  ],
  [
    "elementary_6",
    "초등 6학년",
  ],

  [
    "middle_1",
    "중등 1학년",
  ],
  [
    "middle_2",
    "중등 2학년",
  ],
  [
    "middle_3",
    "중등 3학년",
  ],

  [
    "high_1",
    "고등 1학년",
  ],
  [
    "high_2",
    "고등 2학년",
  ],
  [
    "high_3",
    "고등 3학년",
  ],

  [
    "university",
    "대학생",
  ],
  [
    "adult",
    "성인",
  ],
  [
    "senior",
    "실버",
  ],
] as const;

const DAY_LABELS:
  Record<string, string> = {
    Monday: "월",
    Tuesday: "화",
    Wednesday: "수",
    Thursday: "목",
    Friday: "금",
    Saturday: "토",
    Sunday: "일",
  };

const ELEMENTARY = [
  "elementary_1",
  "elementary_2",
  "elementary_3",
  "elementary_4",
  "elementary_5",
  "elementary_6",
];

const MIDDLE = [
  "middle_1",
  "middle_2",
  "middle_3",
];

const HIGH = [
  "high_1",
  "high_2",
  "high_3",
];

/*
 * 선택한 학년/대상에 따라
 * 보여줄 수 있는 표준 일정 범위
 */
function getAllowedTargets(
  selectedTarget: string
) {
  /*
   * 초등
   * → 영유아 파닉스 ~ 중등
   */
  if (
    ELEMENTARY.includes(
      selectedTarget
    )
  ) {
    return [
      "age_5_7_phonics",
      ...ELEMENTARY,
      ...MIDDLE,
    ];
  }

  /*
   * 중등
   * → 초등 ~ 고등
   */
  if (
    MIDDLE.includes(
      selectedTarget
    )
  ) {
    return [
      ...ELEMENTARY,
      ...MIDDLE,
      ...HIGH,
    ];
  }

  /*
   * 고등
   * → 중등 ~ 대학생
   */
  if (
    HIGH.includes(
      selectedTarget
    )
  ) {
    return [
      ...MIDDLE,
      ...HIGH,
      "university",
    ];
  }

  /*
   * 대학생
   * → 대학생 / 성인 / 실버
   */
  if (
    selectedTarget ===
    "university"
  ) {
    return [
      "university",
      "adult",
      "senior",
    ];
  }

  /*
   * 성인
   */
  if (
    selectedTarget ===
    "adult"
  ) {
    return [
      "university",
      "adult",
      "senior",
    ];
  }

  /*
   * 실버
   */
  if (
    selectedTarget ===
    "senior"
  ) {
    return [
      "adult",
      "senior",
    ];
  }

  /*
   * 영유아
   */
  if (
    selectedTarget ===
    "age_5_7_phonics"
  ) {
    return [
      "age_5_7_phonics",
      ...ELEMENTARY,
    ];
  }

  return [
    selectedTarget,
  ];
}

function guessTargetFromGrade(
  grade: string | null
) {
  if (!grade) {
    return "";
  }

  const text =
    grade.trim();

  if (
    text.includes("초")
  ) {
    const number =
      text.match(/[1-6]/)?.[0];

    if (number) {
      return `elementary_${number}`;
    }
  }

  if (
    text.includes("중")
  ) {
    const number =
      text.match(/[1-3]/)?.[0];

    if (number) {
      return `middle_${number}`;
    }
  }

  if (
    text.includes("고")
  ) {
    const number =
      text.match(/[1-3]/)?.[0];

    if (number) {
      return `high_${number}`;
    }
  }

  return "";
}

function getCourseName(
  courses: CourseRelation
) {
  if (!courses) {
    return "-";
  }

  if (
    Array.isArray(courses)
  ) {
    return (
      courses[0]?.name ??
      "-"
    );
  }

  return courses.name;
}

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "ko-KR"
  ).format(
    Math.round(value)
  );
}

export default function EnrollmentOptionSelector({
  child,
  options,
  allowedWeekdays,
  allowedTimeSlots,
  allowedLessonsPerWeek,
  showEstimatedPrice,
  recommendedCourse,
  recommendedLevel,
  levelTestId,
}: {
  child: Child;

  options:
    EnrollmentOption[];

  allowedWeekdays:
    string[];

  allowedTimeSlots:
    string[];

  allowedLessonsPerWeek:
    number[];

  showEstimatedPrice:
    boolean;

  recommendedCourse:
    RecommendedCourse;

  recommendedLevel:
    string | null;

  levelTestId:
    number | null;
}) {
  const router =
    useRouter();

  /*
   * -------------------------------------------------------
   * 레벨테스트 추천과정 모드
   *
   * 추천과정이 있으면 최초 진입 시 true.
   * 학부모가 "다른 과정도 보기"를 누르면 false.
   * -------------------------------------------------------
   */
  const [
    useRecommendedCourse,
    setUseRecommendedCourse,
  ] = useState(
    Boolean(
      recommendedCourse
    )
  );

  const [
    targetGroup,
    setTargetGroup,
  ] = useState(
    guessTargetFromGrade(
      child.grade
    )
  );

  const [
    lessonsPerWeek,
    setLessonsPerWeek,
  ] = useState("");

  const [
    selectedDays,
    setSelectedDays,
  ] = useState<string[]>([]);

  const [
    selectedTime,
    setSelectedTime,
  ] = useState("");

  const [
    submittingOptionId,
    setSubmittingOptionId,
  ] = useState<number | null>(
    null
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const allowedTargets =
    useMemo(() => {
      if (!targetGroup) {
        return [];
      }

      return getAllowedTargets(
        targetGroup
      );
    }, [targetGroup]);

  /*
   * -------------------------------------------------------
   * 실제 일정 필터
   *
   * 1. 추천과정 모드
   *    → final_course_id와 같은 course_id만
   *
   * 2. 일반 모드
   *    → 기존 학년/대상 확장범위 사용
   *
   * 그 뒤
   * 주당횟수 → 요일 → 시간 → 정원
   * 순서로 필터합니다.
   * -------------------------------------------------------
   */
  const filteredOptions =
    useMemo(() => {
      if (
        !useRecommendedCourse &&
        !targetGroup
      ) {
        return [];
      }

      return options.filter(
        (option) => {
          /*
           * 추천 프로그램 모드
           */
          if (
            useRecommendedCourse &&
            recommendedCourse
          ) {
            if (
              option.course_id !==
              recommendedCourse.id
            ) {
              return false;
            }
          } else {
            /*
             * 일반 수강신청 모드
             */
            if (
              !allowedTargets.includes(
                option.target_group
              )
            ) {
              return false;
            }
          }

          /*
           * 주당 횟수
           */
          if (
            lessonsPerWeek &&
            option.lessons_per_week !==
              Number(
                lessonsPerWeek
              )
          ) {
            return false;
          }

          /*
           * 선택한 요일을
           * 모두 포함하는 일정
           */
          if (
            selectedDays.length >
            0
          ) {
            const hasAllDays =
              selectedDays.every(
                (day) =>
                  option.preferred_days.includes(
                    day
                  )
              );

            if (!hasAllDays) {
              return false;
            }
          }

          /*
           * 희망 시간
           *
           * 일정의 요일별 시간 중
           * 하나라도 선택시간과 같으면 표시
           */
          if (selectedTime) {
            const times =
              Object.values(
                option.preferred_times ??
                  {}
              );

            if (
              !times.includes(
                selectedTime
              )
            ) {
              return false;
            }
          }

          /*
           * 정원 마감 일정 제외
           */
          if (
            option.capacity !==
              null &&
            option.enrolled_count >=
              option.capacity
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      options,
      targetGroup,
      allowedTargets,
      lessonsPerWeek,
      selectedDays,
      selectedTime,
      useRecommendedCourse,
      recommendedCourse,
    ]);

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  function resetScheduleFilters() {
    setLessonsPerWeek("");
    setSelectedDays([]);
    setSelectedTime("");
    clearMessages();
  }

  function toggleDay(
    day: string
  ) {
    setSelectedDays(
      (current) =>
        current.includes(day)
          ? current.filter(
              (item) =>
                item !== day
            )
          : [
              ...current,
              day,
            ]
    );

    clearMessages();
  }

  function showOtherCourses() {
    setUseRecommendedCourse(
      false
    );

    /*
     * 추천과정에서 선택했던
     * 일정 조건은 유지합니다.
     *
     * 학부모가 같은 요일/시간 조건으로
     * 다른 과정을 비교할 수 있습니다.
     */
    clearMessages();
  }

  function returnToRecommendedCourse() {
    if (!recommendedCourse) {
      return;
    }

    setUseRecommendedCourse(
      true
    );

    clearMessages();
  }

  /*
   * 일정 카드의 신청 버튼
   */
  async function submitRequest(
    option: EnrollmentOption
  ) {
    setErrorMessage("");
    setSuccessMessage("");

    const confirmed =
      window.confirm(
        `${option.title}\n\n이 일정으로 ${child.name} 학생의 수강신청을 진행하시겠습니까?`
      );

    if (!confirmed) {
      return;
    }

    setSubmittingOptionId(
      option.id
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
                childId:
                  child.id,

                enrollmentOptionId:
                  option.id,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "수강신청에 실패했습니다."
        );

        setSubmittingOptionId(
          null
        );

        return;
      }

      setSuccessMessage(
        `${option.title} 수강신청이 접수되었습니다. 관리자 승인 후 수강정보에 반영됩니다.`
      );

      setSubmittingOptionId(
        null
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "수강신청 중 오류가 발생했습니다."
      );

      setSubmittingOptionId(
        null
      );
    }
  }

  return (
    <div
      style={{
        marginTop: "28px",
        display: "flex",
        flexDirection:
          "column",
        gap: "22px",
      }}
    >
      {/* ===================================================
          레벨테스트 추천 프로그램
      =================================================== */}

      {recommendedCourse && (
        <section
          style={{
            padding: "24px",
            border:
              useRecommendedCourse
                ? "1px solid #abefc6"
                : "1px solid #dce4ee",
            borderRadius: "16px",
            background:
              useRecommendedCourse
                ? "linear-gradient(135deg, #ecfdf3 0%, #ffffff 100%)"
                : "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "flex-start",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color:
                    useRecommendedCourse
                      ? "#067647"
                      : "#667085",
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing:
                    "0.06em",
                }}
              >
                LEVEL TEST RECOMMENDATION
              </div>

              <h2
                style={{
                  margin:
                    "7px 0 0",
                  color:
                    useRecommendedCourse
                      ? "#065f46"
                      : "#0a1f44",
                  fontSize: "22px",
                  letterSpacing:
                    "-0.02em",
                }}
              >
                {recommendedCourse.name}
              </h2>

              <div
                style={{
                  marginTop: "9px",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                {recommendedLevel && (
                  <SmallBadge>
                    최종 레벨{" "}
                    {recommendedLevel}
                  </SmallBadge>
                )}

                <SmallBadge>
                  TALKLY 추천 프로그램
                </SmallBadge>
              </div>

              <p
                style={{
                  margin:
                    "12px 0 0",
                  color: "#667085",
                  fontSize: "12px",
                  lineHeight: 1.7,
                }}
              >
                {useRecommendedCourse
                  ? "현재 레벨테스트에서 확정된 추천 프로그램의 신청 가능한 일정만 표시하고 있습니다."
                  : "현재 다른 과정까지 함께 확인하고 있습니다. 언제든 추천 프로그램 일정으로 돌아갈 수 있습니다."}
              </p>
            </div>

            <button
              type="button"
              onClick={
                useRecommendedCourse
                  ? showOtherCourses
                  : returnToRecommendedCourse
              }
              style={{
                minHeight:
                  "42px",
                padding:
                  "0 16px",
                border:
                  useRecommendedCourse
                    ? "1px solid #a6f4c5"
                    : "1px solid #b2ccff",
                borderRadius:
                  "9px",
                background:
                  "#ffffff",
                color:
                  useRecommendedCourse
                    ? "#067647"
                    : "#2f6fed",
                fontFamily:
                  "inherit",
                fontSize:
                  "12px",
                fontWeight:
                  900,
                cursor:
                  "pointer",
              }}
            >
              {useRecommendedCourse
                ? "다른 과정도 보기"
                : "추천 프로그램으로 돌아가기"}
            </button>
          </div>

          {levelTestId && (
            <div
              style={{
                marginTop:
                  "16px",
                paddingTop:
                  "14px",
                borderTop:
                  "1px solid rgba(6,118,71,0.12)",
                color:
                  "#667085",
                fontSize:
                  "11px",
                lineHeight:
                  1.6,
              }}
            >
              레벨테스트 최종 결과를
              기준으로 추천된 과정입니다.
              추천 과정은 강제 선택이 아니며,
              다른 과정도 비교하여 신청할 수
              있습니다.
            </div>
          )}
        </section>
      )}

      {/* ===================================================
          조건 선택
      =================================================== */}

      <section
        className="talkly-card"
        style={{
          padding: "28px",
        }}
      >
        <div className="talkly-section-label">
          FIND YOUR CLASS
        </div>

        <h2
          style={{
            margin:
              "7px 0 0",

            color:
              "var(--talkly-navy)",

            fontSize:
              "25px",
          }}
        >
          원하는 수업 조건을
          선택해주세요.
        </h2>

        <p
          style={{
            color:
              "var(--text-muted)",

            lineHeight: 1.7,
          }}
        >
          {useRecommendedCourse &&
          recommendedCourse
            ? "추천 프로그램 안에서 주당 수업 횟수, 요일과 시간을 선택하면 조건에 맞는 공개 수업 일정만 표시됩니다."
            : "학년, 주당 횟수, 요일과 시간을 선택하면 조건에 맞는 공개 수업 일정만 표시됩니다."}
        </p>

        <div
          className="filter-grid"
        >
          {/* 학년 / 추천과정 */}

          <div>
            <label
              style={labelStyle}
            >
              {useRecommendedCourse &&
              recommendedCourse
                ? "추천 프로그램"
                : "학년 / 대상"}
            </label>

            {useRecommendedCourse &&
            recommendedCourse ? (
              <div
                style={{
                  ...fieldStyle,
                  display:
                    "flex",
                  alignItems:
                    "center",
                  background:
                    "#f0fdf4",
                  border:
                    "1px solid #abefc6",
                  color:
                    "#067647",
                  fontWeight:
                    900,
                }}
              >
                {recommendedCourse.name}
              </div>
            ) : (
              <select
                value={
                  targetGroup
                }
                onChange={(e) => {
                  setTargetGroup(
                    e.target.value
                  );

                  clearMessages();
                }}
                style={fieldStyle}
              >
                <option value="">
                  학년 선택
                </option>

                {TARGET_OPTIONS.map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            )}
          </div>

          {/* 주당 횟수 */}

          <div>
            <label
              style={labelStyle}
            >
              주당 수업 횟수
            </label>

            <select
              value={
                lessonsPerWeek
              }
              onChange={(e) => {
                setLessonsPerWeek(
                  e.target.value
                );

                clearMessages();
              }}
              style={fieldStyle}
            >
              <option value="">
                전체
              </option>

              {allowedLessonsPerWeek.map(
                (count) => (
                  <option
                    key={count}
                    value={count}
                  >
                    주 {count}회
                  </option>
                )
              )}
            </select>
          </div>

          {/* 희망 시간 */}

          <div>
            <label
              style={labelStyle}
            >
              희망 시간
            </label>

            <select
              value={
                selectedTime
              }
              onChange={(e) => {
                setSelectedTime(
                  e.target.value
                );

                clearMessages();
              }}
              style={fieldStyle}
            >
              <option value="">
                전체 시간
              </option>

              {allowedTimeSlots.map(
                (time) => (
                  <option
                    key={time}
                    value={time}
                  >
                    {time}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* 요일 */}

        <div
          style={{
            marginTop: "22px",
          }}
        >
          <label
            style={labelStyle}
          >
            희망 요일
          </label>

          <div
            className="weekday-grid"
          >
            {allowedWeekdays.map(
              (day) => {
                const selected =
                  selectedDays.includes(
                    day
                  );

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      toggleDay(day)
                    }
                    style={{
                      padding:
                        "12px 10px",

                      borderRadius:
                        "10px",

                      border:
                        selected
                          ? "1px solid #3d78e8"
                          : "1px solid #dce4ee",

                      background:
                        selected
                          ? "#eaf2ff"
                          : "#ffffff",

                      color:
                        selected
                          ? "#2f6fed"
                          : "#0a1f44",

                      fontWeight:
                        800,

                      cursor:
                        "pointer",
                    }}
                  >
                    {DAY_LABELS[
                      day
                    ] ?? day}
                  </button>
                );
              }
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={
            resetScheduleFilters
          }
          style={{
            marginTop: "18px",

            border: 0,

            background:
              "transparent",

            color:
              "var(--talkly-blue)",

            fontWeight: 800,

            cursor:
              "pointer",
          }}
        >
          수업 조건 초기화
        </button>
      </section>

      {/* ===================================================
          메시지
      =================================================== */}

      {successMessage && (
        <div
          style={{
            padding:
              "16px 18px",

            borderRadius:
              "12px",

            border:
              "1px solid #a8dfbd",

            background:
              "#effaf3",

            color:
              "#177a42",

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
            padding:
              "16px 18px",

            borderRadius:
              "12px",

            border:
              "1px solid #efaaa4",

            background:
              "#fff5f4",

            color:
              "#bc2f26",

            lineHeight: 1.7,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* ===================================================
          신청 가능한 일정
      =================================================== */}

      <section
        className="talkly-card"
        style={{
          padding: "28px",
        }}
      >
        <div
          style={{
            display: "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap: "12px",

            flexWrap:
              "wrap",
          }}
        >
          <div>
            <div className="talkly-section-label">
              AVAILABLE CLASSES
            </div>

            <h2
              style={{
                margin:
                  "7px 0 0",

                color:
                  "var(--talkly-navy)",
              }}
            >
              신청 가능한 수업
            </h2>
          </div>

          <strong
            style={{
              color:
                "var(--text-muted)",
            }}
          >
            {
              filteredOptions.length
            }
            개
          </strong>
        </div>

        {useRecommendedCourse &&
        recommendedCourse &&
        filteredOptions.length ===
          0 ? (
          <div
            style={emptyStyle}
          >
            현재{" "}
            <strong>
              {recommendedCourse.name}
            </strong>
            에 등록된 신청 가능 일정이
            없습니다.
            <br />
            <br />
            다른 과정의 일정을
            확인하시려면{" "}
            <button
              type="button"
              onClick={
                showOtherCourses
              }
              style={{
                border: 0,
                padding: 0,
                background:
                  "transparent",
                color:
                  "#2f6fed",
                fontFamily:
                  "inherit",
                fontSize:
                  "inherit",
                fontWeight:
                  900,
                cursor:
                  "pointer",
              }}
            >
              다른 과정도 보기
            </button>
            를 선택해주세요.
          </div>
        ) : !useRecommendedCourse &&
          !targetGroup ? (
          <div
            style={emptyStyle}
          >
            먼저 학년/대상을
            선택해주세요.
          </div>
        ) : filteredOptions.length ===
          0 ? (
          <div
            style={emptyStyle}
          >
            선택하신 조건에
            맞는 수업 일정이
            없습니다.
            <br />
            요일이나 시간을
            변경해서 다시
            찾아보세요.
          </div>
        ) : (
          <div
            style={{
              marginTop:
                "20px",

              display:
                "grid",

              gap: "16px",
            }}
          >
            {filteredOptions.map(
              (option) => {
                const isSubmitting =
                  submittingOptionId ===
                  option.id;

                const isRecommendedOption =
                  Boolean(
                    recommendedCourse &&
                      option.course_id ===
                        recommendedCourse.id
                  );

                return (
                  <article
                    key={
                      option.id
                    }
                    style={{
                      padding:
                        "22px",

                      borderRadius:
                        "14px",

                      border:
                        isRecommendedOption &&
                        useRecommendedCourse
                          ? "1px solid #abefc6"
                          : "1px solid #dce4ee",

                      background:
                        "#ffffff",

                      boxShadow:
                        isRecommendedOption &&
                        useRecommendedCourse
                          ? "0 8px 24px rgba(6,118,71,0.07)"
                          : "0 8px 22px rgba(10,31,68,0.04)",
                    }}
                  >
                    {/* 상단 */}

                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        alignItems:
                          "flex-start",

                        gap:
                          "18px",

                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap:
                              "7px",
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <div
                            style={{
                              color:
                                "#3978ef",

                              fontSize:
                                "12px",

                              fontWeight:
                                900,
                            }}
                          >
                            {getCourseName(
                              option.courses
                            )}
                          </div>

                          {isRecommendedOption && (
                            <span
                              style={{
                                padding:
                                  "4px 7px",
                                borderRadius:
                                  "999px",
                                background:
                                  "#ecfdf3",
                                color:
                                  "#067647",
                                fontSize:
                                  "9px",
                                fontWeight:
                                  900,
                              }}
                            >
                              추천 과정
                            </span>
                          )}
                        </div>

                        <h3
                          style={{
                            margin:
                              "6px 0 0",

                            color:
                              "#0a1f44",

                            fontSize:
                              "21px",

                            letterSpacing:
                              "-0.02em",
                          }}
                        >
                          {
                            option.title
                          }
                        </h3>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",

                          gap:
                            "7px",

                          flexWrap:
                            "wrap",
                        }}
                      >
                        <Badge>
                          {
                            option.lesson_duration_minutes
                          }
                          분
                        </Badge>

                        <Badge>
                          주{" "}
                          {
                            option.lessons_per_week
                          }
                          회
                        </Badge>
                      </div>
                    </div>

                    {/* 정보 */}

                    <div
                      className="option-info-grid"
                    >
                      <OptionInfo
                        label="수업"
                        value={`${option.lesson_duration_minutes}분 · 주 ${option.lessons_per_week}회`}
                      />

                      <OptionInfo
                        label="요일 / 시간"
                        value={
                          option.preferred_days
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
                                  option
                                    .preferred_times?.[
                                    day
                                  ] ??
                                  ""
                                }`
                            )
                            .join(
                              " · "
                            )
                        }
                      />

                      <OptionInfo
                        label="기간"
                        value={`${option.course_weeks}주 · 총 ${option.total_lessons}회`}
                      />

                      <OptionInfo
                        label="수강기간"
                        value={`${option.start_date} ~ ${option.end_date}`}
                      />

                      {option.capacity !==
                        null && (
                        <OptionInfo
                          label="신청 현황"
                          value={`${option.enrolled_count}/${option.capacity}명`}
                        />
                      )}

                      {option.curriculum_name && (
                        <OptionInfo
                          label="커리큘럼"
                          value={
                            option.curriculum_name
                          }
                        />
                      )}
                    </div>

                    {/* 가격 + 신청 */}

                    <div
                      style={{
                        marginTop:
                          "20px",

                        paddingTop:
                          "18px",

                        borderTop:
                          "1px solid #e6ecf4",

                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        alignItems:
                          "center",

                        gap:
                          "18px",

                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        {showEstimatedPrice ? (
                          <>
                            <div
                              style={{
                                color:
                                  "#7c8899",

                                fontSize:
                                  "12px",
                              }}
                            >
                              예상 수강료
                            </div>

                            <strong
                              style={{
                                display:
                                  "block",

                                marginTop:
                                  "4px",

                                color:
                                  "#0a1f44",

                                fontSize:
                                  "24px",
                              }}
                            >
                              {formatMoney(
                                option.estimated_price
                              )}
                              원
                            </strong>

                            {Number(
                              option.weekend_multiplier
                            ) >
                              1 &&
                              option.weekend_lesson_count >
                                0 && (
                                <div
                                  style={{
                                    marginTop:
                                      "4px",

                                    color:
                                      "#8a96a8",

                                    fontSize:
                                      "11px",
                                  }}
                                >
                                  주말 수업{" "}
                                  {
                                    option.weekend_lesson_count
                                  }
                                  회 · ×{" "}
                                  {Number(
                                    option.weekend_multiplier
                                  )}
                                  할증 포함
                                </div>
                              )}
                          </>
                        ) : (
                          <div
                            style={{
                              color:
                                "#7c8899",

                              fontSize:
                                "13px",
                            }}
                          >
                            상세 수강료는
                            신청 후
                            확인합니다.
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          submitRequest(
                            option
                          )
                        }
                        disabled={
                          isSubmitting ||
                          submittingOptionId !==
                            null
                        }
                        style={{
                          minHeight:
                            "48px",

                          padding:
                            "0 22px",

                          border: 0,

                          borderRadius:
                            "10px",

                          background:
                            isRecommendedOption
                              ? "#0A1F44"
                              : "#3978ef",

                          color:
                            "#ffffff",

                          fontFamily:
                            "inherit",

                          fontSize:
                            "15px",

                          fontWeight:
                            900,

                          cursor:
                            isSubmitting
                              ? "default"
                              : "pointer",

                          boxShadow:
                            isRecommendedOption
                              ? "0 8px 18px rgba(10,31,68,0.20)"
                              : "0 8px 18px rgba(57,120,239,0.2)",

                          opacity:
                            submittingOptionId !==
                              null &&
                            !isSubmitting
                              ? 0.5
                              : 1,
                        }}
                      >
                        {isSubmitting
                          ? "신청 중..."
                          : "수강신청하기 →"}
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>

      <style>{`
        .filter-grid {
          margin-top: 22px;
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 14px;
        }

        .weekday-grid {
          margin-top: 8px;
          display: grid;
          grid-template-columns:
            repeat(
              7,
              minmax(0, 1fr)
            );
          gap: 8px;
        }

        .option-info-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(
                150px,
                1fr
              )
            );
          gap: 14px;
        }

        @media(max-width: 760px) {
          .filter-grid {
            grid-template-columns:
              1fr;
          }

          .weekday-grid {
            grid-template-columns:
              repeat(
                4,
                minmax(
                  0,
                  1fr
                )
              );
          }
        }
      `}</style>
    </div>
  );
}

function Badge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span
      style={{
        padding:
          "6px 9px",

        borderRadius:
          "999px",

        background:
          "#edf4ff",

        color:
          "#3978ef",

        fontSize:
          "11px",

        fontWeight:
          900,
      }}
    >
      {children}
    </span>
  );
}

function SmallBadge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span
      style={{
        padding:
          "5px 8px",
        borderRadius:
          "999px",
        background:
          "#ffffff",
        border:
          "1px solid #a6f4c5",
        color:
          "#067647",
        fontSize:
          "10px",
        fontWeight:
          900,
      }}
    >
      {children}
    </span>
  );
}

function OptionInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          color:
            "#8894a7",

          fontSize:
            "11px",

          fontWeight:
            700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",

          color:
            "#0a1f44",

          fontSize:
            "13px",

          fontWeight:
            800,

          lineHeight:
            1.5,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block",

  color:
    "#0a1f44",

  fontSize:
    "13px",

  fontWeight:
    800,

  marginBottom:
    "7px",
};

const fieldStyle = {
  width:
    "100%",

  minHeight:
    "46px",

  boxSizing:
    "border-box" as const,

  padding:
    "12px 13px",

  border:
    "1px solid #dce4ee",

  borderRadius:
    "10px",

  background:
    "#ffffff",

  color:
    "#0a1f44",

  fontFamily:
    "inherit",

  fontSize:
    "14px",
};

const emptyStyle = {
  marginTop:
    "20px",

  padding:
    "42px 20px",

  border:
    "1px dashed #d7e0ec",

  borderRadius:
    "12px",

  color:
    "#7b8798",

  textAlign:
    "center" as const,

  lineHeight:
    1.8,
};