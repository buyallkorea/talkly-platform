"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Child = {
  id: number;
  name: string;
  grade: string | null;
};

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

type EnrollmentSettings = {
  allowed_weekdays: string[];
  allowed_time_slots: string[];
  allowed_lessons_per_week: number[];
  allowed_duration_minutes: number[];
  min_course_weeks: number;
  max_course_weeks: number;
};

type PricingRow = {
  course_id: number;
  lesson_duration_minutes: number;
  price_per_lesson: number;
  weekend_multiplier: number | string;
  is_active: boolean;
};

type ScheduleRow = {
  weekday: string;
  time: string;
};

type PreviewResult = {
  totalLessons: number;
  weekdayLessonCount: number;
  weekendLessonCount: number;
};

const WEEKDAY_LABELS: Record<string, string> = {
  Monday: "월요일",
  Tuesday: "화요일",
  Wednesday: "수요일",
  Thursday: "목요일",
  Friday: "금요일",
  Saturday: "토요일",
  Sunday: "일요일",
};

const WEEKDAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ko-KR").format(
    Math.round(value)
  );
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(date);

  copy.setUTCDate(
    copy.getUTCDate() + days
  );

  return copy;
}

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateEndDate(
  startDate: string,
  weeks: number
) {
  if (!startDate || weeks <= 0) {
    return "";
  }

  const start =
    parseDateOnly(startDate);

  const end =
    addUtcDays(
      start,
      weeks * 7 - 1
    );

  return formatUtcDate(end);
}

function calculateSchedulePreview({
  startDate,
  weeks,
  schedule,
}: {
  startDate: string;
  weeks: number;
  schedule: ScheduleRow[];
}): PreviewResult {
  if (
    !startDate ||
    weeks <= 0 ||
    schedule.length === 0
  ) {
    return {
      totalLessons: 0,
      weekdayLessonCount: 0,
      weekendLessonCount: 0,
    };
  }

  if (
    schedule.some(
      (item) =>
        !item.weekday ||
        !item.time
    )
  ) {
    return {
      totalLessons: 0,
      weekdayLessonCount: 0,
      weekendLessonCount: 0,
    };
  }

  const start =
    parseDateOnly(startDate);

  const endExclusive =
    addUtcDays(start, weeks * 7);

  let current =
    new Date(start);

  let totalLessons = 0;
  let weekdayLessonCount = 0;
  let weekendLessonCount = 0;

  while (current < endExclusive) {
    const currentWeekday =
      current.getUTCDay();

    schedule.forEach((item) => {
      const weekdayNumber =
        WEEKDAY_MAP[item.weekday];

      if (
        weekdayNumber !==
        currentWeekday
      ) {
        return;
      }

      totalLessons += 1;

      if (
        currentWeekday === 0 ||
        currentWeekday === 6
      ) {
        weekendLessonCount += 1;
      } else {
        weekdayLessonCount += 1;
      }
    });

    current =
      addUtcDays(current, 1);
  }

  return {
    totalLessons,
    weekdayLessonCount,
    weekendLessonCount,
  };
}

export default function EnrollmentForm() {
  const router = useRouter();

  const [children, setChildren] =
    useState<Child[]>([]);

  const [courses, setCourses] =
    useState<Course[]>([]);

  const [teachers, setTeachers] =
    useState<Teacher[]>([]);

  const [settings, setSettings] =
    useState<EnrollmentSettings | null>(
      null
    );

  const [pricingRows, setPricingRows] =
    useState<PricingRow[]>([]);

  const [childId, setChildId] =
    useState("");

  const [courseId, setCourseId] =
    useState("");

  const [
    teacherUserId,
    setTeacherUserId,
  ] = useState("");

  const [
    lessonDurationMinutes,
    setLessonDurationMinutes,
  ] = useState("");

  const [
    lessonsPerWeek,
    setLessonsPerWeek,
  ] = useState("");

  const [startDate, setStartDate] =
    useState("");

  const [courseWeeks, setCourseWeeks] =
    useState("");

  const [schedule, setSchedule] =
    useState<ScheduleRow[]>([]);

  const [loadingData, setLoadingData] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
   * 학생 / 과정 / 강사 /
   * 관리자 수강설정 / 수강료 조회
   */
  useEffect(() => {
    async function loadData() {
      const supabase =
        createClient();

      setLoadingData(true);
      setErrorMessage("");

      const [
        childrenResult,
        coursesResult,
        teachersResult,
        settingsResult,
        pricingResult,
      ] = await Promise.all([
        supabase
          .from("children")
          .select(
            "id, name, grade"
          )
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("courses")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("teacher_profiles")
          .select(
            "user_id, display_name"
          )
          .eq("is_active", true)
          .order("display_name"),

        supabase
          .from(
            "enrollment_settings"
          )
          .select(`
            allowed_weekdays,
            allowed_time_slots,
            allowed_lessons_per_week,
            allowed_duration_minutes,
            min_course_weeks,
            max_course_weeks
          `)
          .eq(
            "setting_key",
            "default"
          )
          .single(),

        supabase
          .from("course_pricing")
          .select(`
            course_id,
            lesson_duration_minutes,
            price_per_lesson,
            weekend_multiplier,
            is_active
          `)
          .eq("is_active", true),
      ]);

      const firstError =
        childrenResult.error ||
        coursesResult.error ||
        teachersResult.error ||
        settingsResult.error ||
        pricingResult.error;

      if (firstError) {
        setErrorMessage(
          `수강등록 정보를 불러오지 못했습니다: ${firstError.message}`
        );

        setLoadingData(false);
        return;
      }

      setChildren(
        childrenResult.data ?? []
      );

      setCourses(
        coursesResult.data ?? []
      );

      setTeachers(
        teachersResult.data ?? []
      );

      setSettings(
        settingsResult.data as
          EnrollmentSettings
      );

      setPricingRows(
        (pricingResult.data ??
          []) as PricingRow[]
      );

      /*
       * 관리자 설정의 기본값을
       * 최초 선택값으로 적용
       */
      const loadedSettings =
        settingsResult.data as
          EnrollmentSettings;

      if (
        loadedSettings
          .allowed_duration_minutes
          .length > 0
      ) {
        setLessonDurationMinutes(
          String(
            loadedSettings
              .allowed_duration_minutes[0]
          )
        );
      }

      if (
        loadedSettings
          .allowed_lessons_per_week
          .length > 0
      ) {
        setLessonsPerWeek(
          String(
            loadedSettings
              .allowed_lessons_per_week[0]
          )
        );
      }

      setCourseWeeks(
        String(
          loadedSettings
            .min_course_weeks
        )
      );

      setLoadingData(false);
    }

    loadData();
  }, []);

  /*
   * 주당 횟수가 변경되면
   * 요일/시간 입력칸 수도 맞춤
   */
  useEffect(() => {
    const count =
      Number(lessonsPerWeek);

    if (
      !Number.isFinite(count) ||
      count <= 0
    ) {
      setSchedule([]);
      return;
    }

    setSchedule((current) => {
      const next = Array.from(
        { length: count },
        (_, index) =>
          current[index] ?? {
            weekday: "",
            time: "",
          }
      );

      return next;
    });
  }, [lessonsPerWeek]);

  /*
   * 현재 과정 + 수업시간의
   * 회당 수강료 조회
   */
  const selectedPricing =
    useMemo(() => {
      if (
        !courseId ||
        !lessonDurationMinutes
      ) {
        return null;
      }

      return (
        pricingRows.find(
          (row) =>
            row.course_id ===
              Number(courseId) &&
            row.lesson_duration_minutes ===
              Number(
                lessonDurationMinutes
              )
        ) ?? null
      );
    }, [
      courseId,
      lessonDurationMinutes,
      pricingRows,
    ]);

  /*
   * 종료일
   */
  const calculatedEndDate =
    useMemo(() => {
      return calculateEndDate(
        startDate,
        Number(courseWeeks)
      );
    }, [
      startDate,
      courseWeeks,
    ]);

  /*
   * 실제 날짜 기준
   * 평일/주말 회차 계산
   */
  const schedulePreview =
    useMemo(() => {
      return calculateSchedulePreview({
        startDate,
        weeks:
          Number(courseWeeks),
        schedule,
      });
    }, [
      startDate,
      courseWeeks,
      schedule,
    ]);

  /*
   * 수강료 계산
   */
  const tuitionPreview =
    useMemo(() => {
      if (!selectedPricing) {
        return {
          pricePerLesson: 0,
          weekendMultiplier: 1,
          weekdayPrice: 0,
          weekendPrice: 0,
          totalPrice: 0,
        };
      }

      const pricePerLesson =
        Number(
          selectedPricing
            .price_per_lesson
        );

      const weekendMultiplier =
        Number(
          selectedPricing
            .weekend_multiplier
        );

      const weekdayPrice =
        schedulePreview
          .weekdayLessonCount *
        pricePerLesson;

      const weekendPrice =
        schedulePreview
          .weekendLessonCount *
        pricePerLesson *
        weekendMultiplier;

      return {
        pricePerLesson,
        weekendMultiplier,

        weekdayPrice,

        weekendPrice,

        totalPrice:
          Math.round(
            weekdayPrice +
              weekendPrice
          ),
      };
    }, [
      selectedPricing,
      schedulePreview,
    ]);

  function updateSchedule(
    index: number,
    field: keyof ScheduleRow,
    value: string
  ) {
    setSchedule((current) =>
      current.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item
      )
    );
  }

  function validateSchedule() {
    if (
      schedule.length !==
      Number(lessonsPerWeek)
    ) {
      return "주당 수업 횟수를 확인해주세요.";
    }

    for (
      let index = 0;
      index < schedule.length;
      index += 1
    ) {
      const item =
        schedule[index];

      if (!item.weekday) {
        return `${
          index + 1
        }번째 수업 요일을 선택해주세요.`;
      }

      if (!item.time) {
        return `${
          index + 1
        }번째 수업 시간을 선택해주세요.`;
      }
    }

    /*
     * 같은 요일을 두 번 선택하면
     * 현재 구조에서는 허용하지 않음.
     */
    const weekdays =
      schedule.map(
        (item) => item.weekday
      );

    const uniqueWeekdays =
      new Set(weekdays);

    if (
      uniqueWeekdays.size !==
      weekdays.length
    ) {
      return "같은 요일을 중복 선택할 수 없습니다.";
    }

    return "";
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!childId) {
      setErrorMessage(
        "학생을 선택해주세요."
      );
      return;
    }

    if (!courseId) {
      setErrorMessage(
        "수강 과정을 선택해주세요."
      );
      return;
    }

    if (
      !lessonDurationMinutes
    ) {
      setErrorMessage(
        "수업시간을 선택해주세요."
      );
      return;
    }

    if (!lessonsPerWeek) {
      setErrorMessage(
        "주당 수업 횟수를 선택해주세요."
      );
      return;
    }

    if (!startDate) {
      setErrorMessage(
        "수강 시작일을 선택해주세요."
      );
      return;
    }

    if (!courseWeeks) {
      setErrorMessage(
        "수강기간을 선택해주세요."
      );
      return;
    }

    const scheduleError =
      validateSchedule();

    if (scheduleError) {
      setErrorMessage(
        scheduleError
      );
      return;
    }

    if (!selectedPricing) {
      setErrorMessage(
        "선택한 과정과 수업시간의 회당 수강료가 등록되어 있지 않습니다."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response =
        await fetch(
          "/api/admin/enrollments",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              childId:
                Number(childId),

              courseId:
                Number(courseId),

              teacherUserId:
                teacherUserId ||
                null,

              lessonDurationMinutes:
                Number(
                  lessonDurationMinutes
                ),

              lessonsPerWeek:
                Number(
                  lessonsPerWeek
                ),

              startDate,

              courseWeeks:
                Number(
                  courseWeeks
                ),

              schedule,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "수강 등록에 실패했습니다."
        );

        setSubmitting(false);
        return;
      }

      /*
       * 생성된 수강 상세로 이동
       */
      router.push(
        `/admin/enrollments/${result.enrollmentId}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "ENROLLMENT CREATE ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "수강 등록 중 오류가 발생했습니다."
      );

      setSubmitting(false);
    }
  }

  if (loadingData) {
    return (
      <div
        style={{
          padding: "24px",
          border:
            "1px solid rgba(255,255,255,0.14)",
          borderRadius: "12px",
        }}
      >
        수강등록 정보를 불러오는
        중입니다...
      </div>
    );
  }

  if (!settings) {
    return (
      <div
        style={{
          padding: "20px",
          border:
            "1px solid #d93025",
          borderRadius: "10px",
          color: "#d93025",
        }}
      >
        수강신청 설정을 불러올 수
        없습니다.
      </div>
    );
  }

  const weekOptions =
    Array.from(
      {
        length:
          settings.max_course_weeks -
          settings.min_course_weeks +
          1,
      },
      (_, index) =>
        settings.min_course_weeks +
        index
    );

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "22px",
      }}
    >
      {/* 학생 / 과정 */}
      <section style={sectionStyle}>
        <SectionHeader
          title="학생 및 과정"
          description="수강할 학생과 과정을 선택합니다."
        />

        <div className="form-grid">
          <Field>
            <label style={labelStyle}>
              학생
            </label>

            <select
              value={childId}
              onChange={(event) =>
                setChildId(
                  event.target.value
                )
              }
              required
              style={fieldStyle}
            >
              <option value="">
                학생을 선택해주세요
              </option>

              {children.map(
                (child) => (
                  <option
                    key={child.id}
                    value={child.id}
                  >
                    {child.name}
                    {child.grade
                      ? ` (${child.grade})`
                      : ""}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field>
            <label style={labelStyle}>
              수강 과정
            </label>

            <select
              value={courseId}
              onChange={(event) =>
                setCourseId(
                  event.target.value
                )
              }
              required
              style={fieldStyle}
            >
              <option value="">
                과정을 선택해주세요
              </option>

              {courses.map(
                (course) => (
                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.name}
                  </option>
                )
              )}
            </select>
          </Field>
        </div>
      </section>

      {/* 수업 조건 */}
      <section style={sectionStyle}>
        <SectionHeader
          title="수업 조건"
          description="관리자 수강신청 설정에서 허용한 조건만 표시됩니다."
        />

        <div className="form-grid">
          <Field>
            <label style={labelStyle}>
              1회 수업시간
            </label>

            <select
              value={
                lessonDurationMinutes
              }
              onChange={(event) =>
                setLessonDurationMinutes(
                  event.target.value
                )
              }
              style={fieldStyle}
            >
              {settings.allowed_duration_minutes.map(
                (duration) => (
                  <option
                    key={duration}
                    value={duration}
                  >
                    {duration}분
                  </option>
                )
              )}
            </select>
          </Field>

          <Field>
            <label style={labelStyle}>
              주당 수업 횟수
            </label>

            <select
              value={
                lessonsPerWeek
              }
              onChange={(event) =>
                setLessonsPerWeek(
                  event.target.value
                )
              }
              style={fieldStyle}
            >
              {settings.allowed_lessons_per_week.map(
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
          </Field>

          <Field>
            <label style={labelStyle}>
              수강 시작일
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(
                  event.target.value
                )
              }
              required
              style={fieldStyle}
            />
          </Field>

          <Field>
            <label style={labelStyle}>
              수강기간
            </label>

            <select
              value={courseWeeks}
              onChange={(event) =>
                setCourseWeeks(
                  event.target.value
                )
              }
              style={fieldStyle}
            >
              {weekOptions.map(
                (weeks) => (
                  <option
                    key={weeks}
                    value={weeks}
                  >
                    {weeks}주
                  </option>
                )
              )}
            </select>
          </Field>
        </div>

        {calculatedEndDate && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px 14px",
              borderRadius: "9px",
              background:
                "rgba(255,255,255,0.05)",
              fontSize: "13px",
            }}
          >
            예상 수강기간:{" "}
            <strong>
              {startDate}
            </strong>
            {" ~ "}
            <strong>
              {calculatedEndDate}
            </strong>
          </div>
        )}
      </section>

      {/* 요일 / 시간 */}
      <section style={sectionStyle}>
        <SectionHeader
          title="매주 수업 일정"
          description="주당 수업 횟수만큼 요일과 시작 시간을 지정합니다."
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {schedule.map(
            (item, index) => (
              <div
                key={index}
                className="schedule-row"
              >
                <div
                  style={{
                    minWidth: "70px",
                    fontWeight: 900,
                  }}
                >
                  수업 {index + 1}
                </div>

                <select
                  value={item.weekday}
                  onChange={(event) =>
                    updateSchedule(
                      index,
                      "weekday",
                      event.target.value
                    )
                  }
                  style={fieldStyle}
                >
                  <option value="">
                    요일 선택
                  </option>

                  {settings.allowed_weekdays.map(
                    (weekday) => (
                      <option
                        key={weekday}
                        value={weekday}
                      >
                        {WEEKDAY_LABELS[
                          weekday
                        ] ?? weekday}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={item.time}
                  onChange={(event) =>
                    updateSchedule(
                      index,
                      "time",
                      event.target.value
                    )
                  }
                  style={fieldStyle}
                >
                  <option value="">
                    시간 선택
                  </option>

                  {settings.allowed_time_slots.map(
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
            )
          )}
        </div>
      </section>

      {/* 강사 */}
      <section style={sectionStyle}>
        <SectionHeader
          title="담당 강사"
          description="관리자가 담당 강사를 지정합니다. 아직 확정되지 않았다면 나중에 배정할 수 있습니다."
        />

        <Field>
          <select
            value={teacherUserId}
            onChange={(event) =>
              setTeacherUserId(
                event.target.value
              )
            }
            style={fieldStyle}
          >
            <option value="">
              나중에 배정
            </option>

            {teachers.map(
              (teacher) => (
                <option
                  key={teacher.user_id}
                  value={
                    teacher.user_id
                  }
                >
                  {teacher.display_name ||
                    "이름 미등록 강사"}
                </option>
              )
            )}
          </select>
        </Field>

        <div
          style={{
            marginTop: "14px",
            padding: "12px 14px",
            borderRadius: "9px",
            border:
              "1px dashed rgba(255,255,255,0.18)",
            fontSize: "12px",
            opacity: 0.6,
            lineHeight: 1.7,
          }}
        >
          커리큘럼/교재 배정은 현재
          DB 연결 구조를 확인한 뒤 이
          영역에 추가합니다.
        </div>
      </section>

      {/* 예상 회차 및 수강료 */}
      <section style={sectionStyle}>
        <SectionHeader
          title="예상 수강료"
          description="실제 선택한 요일을 기준으로 평일과 주말 회차를 구분해 계산합니다."
        />

        {!courseId ? (
          <div style={noticeStyle}>
            먼저 수강 과정을
            선택해주세요.
          </div>
        ) : !selectedPricing ? (
          <div
            style={{
              ...noticeStyle,
              borderColor:
                "rgba(217,48,37,0.4)",
              color: "#ff9d95",
            }}
          >
            선택한 과정의{" "}
            {lessonDurationMinutes}분
            회당 수강료가 등록되어
            있지 않습니다.
          </div>
        ) : (
          <>
            <div className="price-grid">
              <PriceBox
                label="회당 수강료"
                value={`${formatMoney(
                  tuitionPreview
                    .pricePerLesson
                )}원`}
              />

              <PriceBox
                label="평일 수업"
                value={`${schedulePreview.weekdayLessonCount}회`}
                sub={`${formatMoney(
                  tuitionPreview
                    .weekdayPrice
                )}원`}
              />

              <PriceBox
                label="주말 수업"
                value={`${schedulePreview.weekendLessonCount}회`}
                sub={`× ${tuitionPreview.weekendMultiplier} / ${formatMoney(
                  tuitionPreview
                    .weekendPrice
                )}원`}
              />

              <PriceBox
                label="총 수업 회차"
                value={`${schedulePreview.totalLessons}회`}
              />
            </div>

            <div
              style={{
                marginTop: "16px",
                padding: "20px",
                borderRadius: "12px",
                background:
                  "rgba(47,111,237,0.13)",
                border:
                  "1px solid rgba(47,111,237,0.34)",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "18px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    opacity: 0.65,
                  }}
                >
                  예상 총 수강료
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "12px",
                    opacity: 0.5,
                  }}
                >
                  평일 회차 + 주말 회차
                  할증 적용
                </div>
              </div>

              <strong
                style={{
                  fontSize: "28px",
                  color: "#8fb4ff",
                }}
              >
                {formatMoney(
                  tuitionPreview
                    .totalPrice
                )}
                원
              </strong>
            </div>
          </>
        )}
      </section>

      {errorMessage && (
        <div
          style={{
            padding: "14px",
            border:
              "1px solid rgba(217,48,37,0.65)",
            borderRadius: "10px",
            background:
              "rgba(217,48,37,0.08)",
            color: "#ff9d95",
            fontSize: "14px",
            lineHeight: 1.65,
          }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          minHeight: "52px",
          border: "none",
          borderRadius: "10px",
          background: submitting
            ? "rgba(47,111,237,0.55)"
            : "#2f6fed",
          color: "#ffffff",
          fontFamily: "inherit",
          fontSize: "16px",
          fontWeight: 900,
          cursor: submitting
            ? "default"
            : "pointer",
        }}
      >
        {submitting
          ? "수강과 수업 일정을 생성하는 중..."
          : "수강 생성"}
      </button>

      <style>{`
        .form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .schedule-row {
          display: grid;
          grid-template-columns:
            80px minmax(0, 1fr)
            minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          padding: 14px;
          border:
            1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
        }

        .price-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        @media (max-width: 800px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .schedule-row {
            grid-template-columns: 1fr;
          }

          .price-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .price-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        marginBottom: "20px",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "20px",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin: "7px 0 0",
          fontSize: "13px",
          opacity: 0.55,
          lineHeight: 1.65,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function Field({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}

function PriceBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        minHeight: "110px",
        padding: "16px",
        borderRadius: "10px",
        border:
          "1px solid rgba(255,255,255,0.12)",
        background:
          "rgba(255,255,255,0.035)",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          opacity: 0.55,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "9px",
          fontSize: "20px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>

      {sub && (
        <div
          style={{
            marginTop: "6px",
            fontSize: "11px",
            opacity: 0.5,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

const sectionStyle = {
  padding: "24px",
  border:
    "1px solid rgba(255,255,255,0.16)",
  borderRadius: "14px",
  background:
    "rgba(255,255,255,0.03)",
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "13px",
  fontWeight: 800,
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "12px 13px",
  border:
    "1px solid rgba(255,255,255,0.18)",
  borderRadius: "9px",
  background:
    "rgba(255,255,255,0.06)",
  color: "inherit",
  fontFamily: "inherit",
  fontSize: "14px",
};

const noticeStyle = {
  padding: "16px",
  border:
    "1px dashed rgba(255,255,255,0.18)",
  borderRadius: "10px",
  fontSize: "13px",
  opacity: 0.7,
};