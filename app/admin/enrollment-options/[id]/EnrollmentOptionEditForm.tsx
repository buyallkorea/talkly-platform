"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Course = {
  id: number;
  name: string;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

type Settings = {
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

type OptionData = {
  id: number;
  title: string;
  course_id: number;
  target_group: string;

  lesson_duration_minutes: number;
  lessons_per_week: number;

  preferred_days: string[];
  preferred_times: Record<string, string>;

  course_weeks: number;
  start_date: string;
  end_date: string;

  total_lessons: number;

  price_per_lesson: number;
  weekend_multiplier: number | string;

  weekday_lesson_count: number;
  weekend_lesson_count: number;

  estimated_price: number;

  capacity: number | null;
  enrolled_count: number;

  teacher_user_id: string | null;
  curriculum_name: string | null;

  is_published: boolean;
  is_open: boolean;

  admin_note: string | null;
};

type ScheduleRow = {
  weekday: string;
  time: string;
};

const TARGET_GROUPS = [
  ["age_5_7_phonics", "5~7세 파닉스"],

  ["elementary_1", "초등 1학년"],
  ["elementary_2", "초등 2학년"],
  ["elementary_3", "초등 3학년"],
  ["elementary_4", "초등 4학년"],
  ["elementary_5", "초등 5학년"],
  ["elementary_6", "초등 6학년"],

  ["middle_1", "중등 1학년"],
  ["middle_2", "중등 2학년"],
  ["middle_3", "중등 3학년"],

  ["high_1", "고등 1학년"],
  ["high_2", "고등 2학년"],
  ["high_3", "고등 3학년"],

  ["university", "대학생"],
  ["adult", "성인"],
  ["senior", "실버"],
] as const;

const DAY_LABELS: Record<string, string> = {
  Monday: "월요일",
  Tuesday: "화요일",
  Wednesday: "수요일",
  Thursday: "목요일",
  Friday: "금요일",
  Saturday: "토요일",
  Sunday: "일요일",
};

const DAY_NUMBERS: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function parseDate(value: string) {
  return new Date(
    `${value}T00:00:00.000Z`
  );
}

function addDays(
  date: Date,
  days: number
) {
  const copy = new Date(date);

  copy.setUTCDate(
    copy.getUTCDate() + days
  );

  return copy;
}

function formatDate(date: Date) {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
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

  return formatDate(
    addDays(
      parseDate(startDate),
      weeks * 7 - 1
    )
  );
}

function calculateLessons(
  startDate: string,
  weeks: number,
  schedule: ScheduleRow[]
) {
  if (
    !startDate ||
    weeks <= 0 ||
    schedule.length === 0 ||
    schedule.some(
      (item) =>
        !item.weekday ||
        !item.time
    )
  ) {
    return {
      total: 0,
      weekday: 0,
      weekend: 0,
    };
  }

  const start =
    parseDate(startDate);

  const end =
    addDays(
      start,
      weeks * 7
    );

  let current =
    new Date(start);

  let total = 0;
  let weekday = 0;
  let weekend = 0;

  while (current < end) {
    const dayNumber =
      current.getUTCDay();

    for (const item of schedule) {
      if (
        DAY_NUMBERS[
          item.weekday
        ] !== dayNumber
      ) {
        continue;
      }

      total += 1;

      if (
        dayNumber === 0 ||
        dayNumber === 6
      ) {
        weekend += 1;
      } else {
        weekday += 1;
      }
    }

    current =
      addDays(current, 1);
  }

  return {
    total,
    weekday,
    weekend,
  };
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

export default function EnrollmentOptionEditForm({
  option,
  courses,
  teachers,
  settings,
  pricingRows,
}: {
  option: OptionData;
  courses: Course[];
  teachers: Teacher[];
  settings: Settings;
  pricingRows: PricingRow[];
}) {
  const router =
    useRouter();

  const [title, setTitle] =
    useState(option.title);

  const [
    targetGroup,
    setTargetGroup,
  ] = useState(
    option.target_group
  );

  const [
    courseId,
    setCourseId,
  ] = useState(
    String(option.course_id)
  );

  const [
    lessonDuration,
    setLessonDuration,
  ] = useState(
    String(
      option.lesson_duration_minutes
    )
  );

  const [
    lessonsPerWeek,
    setLessonsPerWeek,
  ] = useState(
    String(
      option.lessons_per_week
    )
  );

  const [
    startDate,
    setStartDate,
  ] = useState(
    option.start_date
  );

  const [
    courseWeeks,
    setCourseWeeks,
  ] = useState(
    String(option.course_weeks)
  );

  const [
    capacity,
    setCapacity,
  ] = useState(
    option.capacity === null
      ? ""
      : String(option.capacity)
  );

  const [
    teacherUserId,
    setTeacherUserId,
  ] = useState(
    option.teacher_user_id ?? ""
  );

  const [
    curriculumName,
    setCurriculumName,
  ] = useState(
    option.curriculum_name ?? ""
  );

  const [
    adminNote,
    setAdminNote,
  ] = useState(
    option.admin_note ?? ""
  );

  const [
    isPublished,
    setIsPublished,
  ] = useState(
    option.is_published
  );

  const [
    isOpen,
    setIsOpen,
  ] = useState(
    option.is_open
  );

  const initialSchedule =
    option.preferred_days.map(
      (weekday) => ({
        weekday,

        time:
          option.preferred_times?.[
            weekday
          ] ?? "",
      })
    );

  const [
    schedule,
    setSchedule,
  ] = useState<ScheduleRow[]>(
    initialSchedule
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
   * 주당 수업 횟수 변경
   */
  function changeLessonsPerWeek(
    value: string
  ) {
    setLessonsPerWeek(value);

    const count =
      Number(value);

    setSchedule((current) =>
      Array.from(
        {
          length: count,
        },
        (_, index) =>
          current[index] ?? {
            weekday: "",
            time: "",
          }
      )
    );
  }

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
                [field]:
                  value,
              }
            : item
      )
    );
  }

  const selectedPricing =
    useMemo(() => {
      return (
        pricingRows.find(
          (row) =>
            row.course_id ===
              Number(courseId) &&
            row.lesson_duration_minutes ===
              Number(
                lessonDuration
              )
        ) ?? null
      );
    }, [
      courseId,
      lessonDuration,
      pricingRows,
    ]);

  const lessonCounts =
    useMemo(() => {
      return calculateLessons(
        startDate,
        Number(courseWeeks),
        schedule
      );
    }, [
      startDate,
      courseWeeks,
      schedule,
    ]);

  const endDate =
    useMemo(() => {
      return calculateEndDate(
        startDate,
        Number(courseWeeks)
      );
    }, [
      startDate,
      courseWeeks,
    ]);

  const pricePreview =
    useMemo(() => {
      if (!selectedPricing) {
        return {
          perLesson: 0,
          multiplier: 1,
          weekdayPrice: 0,
          weekendPrice: 0,
          total: 0,
        };
      }

      const perLesson =
        Number(
          selectedPricing
            .price_per_lesson
        );

      const multiplier =
        Number(
          selectedPricing
            .weekend_multiplier
        );

      const weekdayPrice =
        lessonCounts.weekday *
        perLesson;

      const weekendPrice =
        lessonCounts.weekend *
        perLesson *
        multiplier;

      return {
        perLesson,
        multiplier,
        weekdayPrice,
        weekendPrice,

        total:
          Math.round(
            weekdayPrice +
              weekendPrice
          ),
      };
    }, [
      selectedPricing,
      lessonCounts,
    ]);

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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!title.trim()) {
      setErrorMessage(
        "일정명을 입력해주세요."
      );
      return;
    }

    if (!targetGroup) {
      setErrorMessage(
        "학년/대상을 선택해주세요."
      );
      return;
    }

    if (!courseId) {
      setErrorMessage(
        "과정을 선택해주세요."
      );
      return;
    }

    if (
      schedule.length !==
      Number(lessonsPerWeek)
    ) {
      setErrorMessage(
        "수업 일정을 확인해주세요."
      );
      return;
    }

    if (
      schedule.some(
        (item) =>
          !item.weekday ||
          !item.time
      )
    ) {
      setErrorMessage(
        "모든 수업의 요일과 시간을 선택해주세요."
      );
      return;
    }

    const selectedDays =
      schedule.map(
        (item) =>
          item.weekday
      );

    if (
      new Set(
        selectedDays
      ).size !==
      selectedDays.length
    ) {
      setErrorMessage(
        "같은 요일을 중복 선택할 수 없습니다."
      );
      return;
    }

    if (!selectedPricing) {
      setErrorMessage(
        "선택한 과정과 수업시간의 수강료가 없습니다."
      );
      return;
    }

    if (
      capacity &&
      Number(capacity) <
        option.enrolled_count
    ) {
      setErrorMessage(
        `현재 신청 인원이 ${option.enrolled_count}명이므로 정원을 그보다 작게 변경할 수 없습니다.`
      );
      return;
    }

    setSubmitting(true);

    try {
      const response =
        await fetch(
          `/api/admin/enrollment-options/${option.id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                title:
                  title.trim(),

                targetGroup,

                courseId:
                  Number(courseId),

                lessonDurationMinutes:
                  Number(
                    lessonDuration
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

                capacity:
                  capacity
                    ? Number(
                        capacity
                      )
                    : null,

                teacherUserId:
                  teacherUserId ||
                  null,

                curriculumName:
                  curriculumName.trim() ||
                  null,

                adminNote:
                  adminNote.trim() ||
                  null,

                isPublished,

                isOpen,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "수정에 실패했습니다."
        );

        setSubmitting(false);
        return;
      }

      router.push(
        "/admin/enrollment-options"
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "수정 중 오류가 발생했습니다."
      );

      setSubmitting(false);
    }
  }

  async function handleDelete() {
    const confirmed =
      window.confirm(
        "이 수강 가능 일정을 삭제하시겠습니까?"
      );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/enrollment-options/${option.id}`,
          {
            method: "DELETE",
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "삭제에 실패했습니다."
        );

        setDeleting(false);
        return;
      }

      router.push(
        "/admin/enrollment-options"
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "삭제 중 오류가 발생했습니다."
      );

      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      style={{
        marginTop: "28px",
        display: "flex",
        flexDirection:
          "column",
        gap: "20px",
      }}
    >
      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="기본 정보"
          description="일정명과 대상, 교육과정을 수정합니다."
        />

        <div className="two-grid">
          <Field label="일정명">
            <input
              value={title}
              onChange={(e) =>
                setTitle(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </Field>

          <Field label="학년 / 대상">
            <select
              value={
                targetGroup
              }
              onChange={(e) =>
                setTargetGroup(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              {TARGET_GROUPS.map(
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
          </Field>

          <Field label="과정">
            <select
              value={courseId}
              onChange={(e) =>
                setCourseId(
                  e.target.value
                )
              }
              style={inputStyle}
            >
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
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="정원">
            <input
              type="number"
              min={
                Math.max(
                  1,
                  option.enrolled_count
                )
              }
              value={capacity}
              onChange={(e) =>
                setCapacity(
                  e.target.value
                )
              }
              placeholder="비워두면 제한 없음"
              style={inputStyle}
            />
          </Field>
        </div>

        <div
          style={{
            marginTop: "12px",
            fontSize: "12px",
            opacity: 0.55,
          }}
        >
          현재 신청 인원:{" "}
          <strong>
            {option.enrolled_count}
            명
          </strong>
        </div>
      </section>

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="수업 조건"
          description="수업시간, 주당 횟수, 기간을 수정합니다."
        />

        <div className="two-grid">
          <Field label="1회 수업시간">
            <select
              value={
                lessonDuration
              }
              onChange={(e) =>
                setLessonDuration(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              {settings.allowed_duration_minutes.map(
                (duration) => (
                  <option
                    key={
                      duration
                    }
                    value={
                      duration
                    }
                  >
                    {duration}분
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="주당 수업 횟수">
            <select
              value={
                lessonsPerWeek
              }
              onChange={(e) =>
                changeLessonsPerWeek(
                  e.target.value
                )
              }
              style={inputStyle}
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

          <Field label="수강 시작일">
            <input
              type="date"
              value={
                startDate
              }
              onChange={(e) =>
                setStartDate(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </Field>

          <Field label="수강기간">
            <select
              value={
                courseWeeks
              }
              onChange={(e) =>
                setCourseWeeks(
                  e.target.value
                )
              }
              style={inputStyle}
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

        <div
          style={infoStyle}
        >
          계산된 수강기간:{" "}
          <strong>
            {startDate} ~{" "}
            {endDate}
          </strong>
        </div>
      </section>

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="매주 수업 일정"
          description="요일과 시작 시간을 수정합니다."
        />

        <div
          style={{
            display: "flex",
            flexDirection:
              "column",
            gap: "10px",
          }}
        >
          {schedule.map(
            (item, index) => (
              <div
                key={index}
                className="schedule-grid"
              >
                <strong>
                  수업{" "}
                  {index + 1}
                </strong>

                <select
                  value={
                    item.weekday
                  }
                  onChange={(e) =>
                    updateSchedule(
                      index,
                      "weekday",
                      e.target
                        .value
                    )
                  }
                  style={
                    inputStyle
                  }
                >
                  <option value="">
                    요일
                  </option>

                  {settings.allowed_weekdays.map(
                    (day) => (
                      <option
                        key={day}
                        value={day}
                      >
                        {
                          DAY_LABELS[
                            day
                          ]
                        }
                      </option>
                    )
                  )}
                </select>

                <select
                  value={
                    item.time
                  }
                  onChange={(e) =>
                    updateSchedule(
                      index,
                      "time",
                      e.target
                        .value
                    )
                  }
                  style={
                    inputStyle
                  }
                >
                  <option value="">
                    시간
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

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="강사 및 커리큘럼"
          description="강사는 미리 배정하거나 신청 후 결정할 수 있습니다."
        />

        <div className="two-grid">
          <Field label="담당 강사">
            <select
              value={
                teacherUserId
              }
              onChange={(e) =>
                setTeacherUserId(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                신청 후 배정
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
                      "이름 미등록 강사"}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="커리큘럼 / 교재">
            <input
              value={
                curriculumName
              }
              onChange={(e) =>
                setCurriculumName(
                  e.target.value
                )
              }
              style={inputStyle}
              placeholder="예: Phonics Level 1"
            />
          </Field>
        </div>
      </section>

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="예상 수강료"
          description="변경한 일정 기준으로 다시 계산됩니다."
        />

        <div className="price-grid">
          <PriceBox
            label="회당"
            value={`${formatMoney(
              pricePreview.perLesson
            )}원`}
          />

          <PriceBox
            label="평일 수업"
            value={`${lessonCounts.weekday}회`}
            sub={`${formatMoney(
              pricePreview.weekdayPrice
            )}원`}
          />

          <PriceBox
            label="주말 수업"
            value={`${lessonCounts.weekend}회`}
            sub={`× ${pricePreview.multiplier}`}
          />

          <PriceBox
            label="총 회차"
            value={`${lessonCounts.total}회`}
          />
        </div>

        <div
          style={totalStyle}
        >
          <span>
            예상 총 수강료
          </span>

          <strong
            style={{
              fontSize: "27px",
              color:
                "#8fb4ff",
            }}
          >
            {formatMoney(
              pricePreview.total
            )}
            원
          </strong>
        </div>
      </section>

      <section
        style={sectionStyle}
      >
        <SectionTitle
          title="공개 및 신청 상태"
          description="학생에게 노출할지, 신규 신청을 받을지 설정합니다."
        />

        <div className="two-grid">
          <Toggle
            title="학생/학부모에게 공개"
            checked={
              isPublished
            }
            onChange={
              setIsPublished
            }
          />

          <Toggle
            title="신청 가능"
            checked={isOpen}
            onChange={
              setIsOpen
            }
          />
        </div>
      </section>

      <section
        style={sectionStyle}
      >
        <Field label="관리자 메모">
          <textarea
            rows={4}
            value={adminNote}
            onChange={(e) =>
              setAdminNote(
                e.target.value
              )
            }
            style={{
              ...inputStyle,
              resize:
                "vertical",
            }}
          />
        </Field>
      </section>

      {errorMessage && (
        <div
          style={errorStyle}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={
            handleDelete
          }
          disabled={
            deleting ||
            submitting
          }
          style={{
            ...buttonStyle,
            background:
              "rgba(217,48,37,.14)",
            color:
              "#ff9d95",
            border:
              "1px solid rgba(217,48,37,.4)",
          }}
        >
          {deleting
            ? "삭제 중..."
            : "일정 삭제"}
        </button>

        <button
          type="submit"
          disabled={
            submitting ||
            deleting
          }
          style={{
            ...buttonStyle,
            background:
              "#2f6fed",
            color: "#fff",
            border:
              "1px solid #2f6fed",
          }}
        >
          {submitting
            ? "저장 중..."
            : "변경사항 저장"}
        </button>
      </div>

      <style>{`
        .two-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .schedule-grid {
          display: grid;
          grid-template-columns:
            90px minmax(0,1fr)
            minmax(0,1fr);
          gap: 12px;
          align-items: center;
          padding: 13px;
          border:
            1px solid rgba(255,255,255,.12);
          border-radius: 10px;
        }

        .price-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0,1fr));
          gap: 10px;
        }

        @media(max-width:760px) {
          .two-grid,
          .price-grid,
          .schedule-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  );
}

function SectionTitle({
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
          opacity: 0.55,
          fontSize: "13px",
          lineHeight: 1.65,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: "8px",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

function Toggle({
  title,
  checked,
  onChange,
}: {
  title: string;
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems:
          "center",
        gap: "12px",
        padding: "16px",
        border:
          "1px solid rgba(255,255,255,.12)",
        borderRadius: "10px",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) =>
          onChange(
            e.target.checked
          )
        }
        style={{
          width: "18px",
          height: "18px",
          accentColor:
            "#2f6fed",
        }}
      />

      <strong>
        {title}
      </strong>
    </label>
  );
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
        padding: "16px",
        border:
          "1px solid rgba(255,255,255,.12)",
        borderRadius: "10px",
      }}
    >
      <div
        style={{
          opacity: 0.5,
          fontSize: "12px",
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display: "block",
          marginTop: "8px",
          fontSize: "20px",
        }}
      >
        {value}
      </strong>

      {sub && (
        <div
          style={{
            marginTop: "5px",
            opacity: 0.5,
            fontSize: "11px",
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
    "1px solid rgba(255,255,255,.15)",
  borderRadius: "14px",
  background:
    "rgba(255,255,255,.025)",
};

const inputStyle = {
  width: "100%",
  boxSizing:
    "border-box" as const,
  padding: "12px 13px",
  border:
    "1px solid rgba(255,255,255,.18)",
  borderRadius: "9px",
  background:
    "rgba(255,255,255,.06)",
  color: "inherit",
  fontFamily: "inherit",
  fontSize: "14px",
};

const infoStyle = {
  marginTop: "14px",
  padding: "12px",
  borderRadius: "9px",
  background:
    "rgba(255,255,255,.05)",
  fontSize: "13px",
};

const totalStyle = {
  marginTop: "14px",
  padding: "20px",
  border:
    "1px solid rgba(47,111,237,.35)",
  borderRadius: "12px",
  background:
    "rgba(47,111,237,.1)",
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
};

const errorStyle = {
  padding: "14px",
  border:
    "1px solid rgba(217,48,37,.5)",
  borderRadius: "10px",
  color: "#ff9d95",
};

const buttonStyle = {
  minHeight: "48px",
  padding: "0 20px",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
};