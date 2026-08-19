"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

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

type Pricing = {
  course_id: number;
  lesson_duration_minutes: number;
  price_per_lesson: number;
  weekend_multiplier: number | string;
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
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatDate(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getEndDate(startDate: string, weeks: number) {
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
      (item) => !item.weekday || !item.time
    )
  ) {
    return {
      total: 0,
      weekday: 0,
      weekend: 0,
    };
  }

  const start = parseDate(startDate);
  const end = addDays(start, weeks * 7);

  let current = new Date(start);

  let total = 0;
  let weekday = 0;
  let weekend = 0;

  while (current < end) {
    const dayNumber = current.getUTCDay();

    for (const item of schedule) {
      if (DAY_NUMBERS[item.weekday] !== dayNumber) {
        continue;
      }

      total += 1;

      if (dayNumber === 0 || dayNumber === 6) {
        weekend += 1;
      } else {
        weekday += 1;
      }
    }

    current = addDays(current, 1);
  }

  return {
    total,
    weekday,
    weekend,
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ko-KR").format(
    Math.round(value)
  );
}

export default function EnrollmentOptionForm() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pricing, setPricing] = useState<Pricing[]>([]);

  const [title, setTitle] = useState("");
  const [targetGroup, setTargetGroup] = useState("");
  const [courseId, setCourseId] = useState("");

  const [
    lessonDurationMinutes,
    setLessonDurationMinutes,
  ] = useState("");

  const [
    lessonsPerWeek,
    setLessonsPerWeek,
  ] = useState("");

  const [courseWeeks, setCourseWeeks] = useState("");
  const [startDate, setStartDate] = useState("");

  const [schedule, setSchedule] =
    useState<ScheduleRow[]>([]);

  const [capacity, setCapacity] = useState("");

  const [
    teacherUserId,
    setTeacherUserId,
  ] = useState("");

  const [
    curriculumName,
    setCurriculumName,
  ] = useState("");

  const [adminNote, setAdminNote] = useState("");

  const [isPublished, setIsPublished] =
    useState(false);

  const [isOpen, setIsOpen] =
    useState(true);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [
        coursesResult,
        teachersResult,
        settingsResult,
        pricingResult,
      ] = await Promise.all([
        supabase
          .from("courses")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("teacher_profiles")
          .select("user_id, display_name")
          .eq("is_active", true)
          .order("display_name"),

        supabase
          .from("enrollment_settings")
          .select(`
            allowed_weekdays,
            allowed_time_slots,
            allowed_lessons_per_week,
            allowed_duration_minutes,
            min_course_weeks,
            max_course_weeks
          `)
          .eq("setting_key", "default")
          .single(),

        supabase
          .from("course_pricing")
          .select(`
            course_id,
            lesson_duration_minutes,
            price_per_lesson,
            weekend_multiplier
          `)
          .eq("is_active", true),
      ]);

      const firstError =
        coursesResult.error ||
        teachersResult.error ||
        settingsResult.error ||
        pricingResult.error;

      if (firstError) {
        setErrorMessage(firstError.message);
        setLoading(false);
        return;
      }

      setCourses(coursesResult.data ?? []);
      setTeachers(teachersResult.data ?? []);

      const loadedSettings =
        settingsResult.data as Settings;

      setSettings(loadedSettings);

      setPricing(
        (pricingResult.data ?? []) as Pricing[]
      );

      if (
        loadedSettings.allowed_duration_minutes.length > 0
      ) {
        setLessonDurationMinutes(
          String(
            loadedSettings.allowed_duration_minutes[0]
          )
        );
      }

      if (
        loadedSettings.allowed_lessons_per_week.length > 0
      ) {
        setLessonsPerWeek(
          String(
            loadedSettings.allowed_lessons_per_week[0]
          )
        );
      }

      setCourseWeeks(
        String(loadedSettings.min_course_weeks)
      );

      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    const count = Number(lessonsPerWeek);

    if (!count || count <= 0) {
      setSchedule([]);
      return;
    }

    setSchedule((current) =>
      Array.from(
        { length: count },
        (_, index) =>
          current[index] ?? {
            weekday: "",
            time: "",
          }
      )
    );
  }, [lessonsPerWeek]);

  const selectedPricing = useMemo(() => {
    if (!courseId || !lessonDurationMinutes) {
      return null;
    }

    return (
      pricing.find(
        (row) =>
          row.course_id === Number(courseId) &&
          row.lesson_duration_minutes ===
            Number(lessonDurationMinutes)
      ) ?? null
    );
  }, [
    courseId,
    lessonDurationMinutes,
    pricing,
  ]);

  const lessonCounts = useMemo(() => {
    return calculateLessons(
      startDate,
      Number(courseWeeks),
      schedule
    );
  }, [startDate, courseWeeks, schedule]);

  const endDate = useMemo(() => {
    return getEndDate(
      startDate,
      Number(courseWeeks)
    );
  }, [startDate, courseWeeks]);

  const pricePreview = useMemo(() => {
    if (!selectedPricing) {
      return {
        pricePerLesson: 0,
        multiplier: 1,
        weekdayPrice: 0,
        weekendPrice: 0,
        total: 0,
      };
    }

    const pricePerLesson =
      Number(selectedPricing.price_per_lesson);

    const multiplier =
      Number(selectedPricing.weekend_multiplier);

    const weekdayPrice =
      lessonCounts.weekday * pricePerLesson;

    const weekendPrice =
      lessonCounts.weekend *
      pricePerLesson *
      multiplier;

    return {
      pricePerLesson,
      multiplier,
      weekdayPrice,
      weekendPrice,

      total: Math.round(
        weekdayPrice + weekendPrice
      ),
    };
  }, [selectedPricing, lessonCounts]);

  function updateSchedule(
    index: number,
    key: keyof ScheduleRow,
    value: string
  ) {
    setSchedule((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value,
            }
          : item
      )
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!title.trim()) {
      setErrorMessage("일정명을 입력해주세요.");
      return;
    }

    if (!targetGroup) {
      setErrorMessage(
        "학년/대상을 선택해주세요."
      );
      return;
    }

    if (!courseId) {
      setErrorMessage("과정을 선택해주세요.");
      return;
    }

    if (!startDate) {
      setErrorMessage(
        "수강 시작일을 선택해주세요."
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
      schedule.map((item) => item.weekday);

    if (
      new Set(selectedDays).size !==
      selectedDays.length
    ) {
      setErrorMessage(
        "같은 요일을 중복 선택할 수 없습니다."
      );
      return;
    }

    if (!selectedPricing) {
      setErrorMessage(
        "선택한 과정과 수업시간의 수강료 설정이 없습니다."
      );
      return;
    }

    if (lessonCounts.total <= 0) {
      setErrorMessage(
        "생성 가능한 수업 일정이 없습니다."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/admin/enrollment-options",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title: title.trim(),

            targetGroup,

            courseId:
              Number(courseId),

            lessonDurationMinutes:
              Number(
                lessonDurationMinutes
              ),

            lessonsPerWeek:
              Number(lessonsPerWeek),

            schedule,

            courseWeeks:
              Number(courseWeeks),

            startDate,

            capacity:
              capacity.trim()
                ? Number(capacity)
                : null,

            teacherUserId:
              teacherUserId || null,

            curriculumName:
              curriculumName.trim() ||
              null,

            adminNote:
              adminNote.trim() || null,

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
            "일정 생성에 실패했습니다."
        );

        setSubmitting(false);
        return;
      }

      router.push(
        "/admin/enrollment-options"
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "일정 생성 중 오류가 발생했습니다."
      );

      setSubmitting(false);
    }
  }

  if (loading) {
    return <p>설정을 불러오는 중입니다...</p>;
  }

  if (!settings) {
    return (
      <p>
        수강신청 설정을 불러올 수 없습니다.
      </p>
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
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <section style={sectionStyle}>
        <SectionTitle
          title="기본 정보"
          description="학생에게 표시될 일정명과 대상, 과정을 설정합니다."
        />

        <div className="two-grid">
          <Field label="일정명">
            <input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="예: 초등 3학년 화·목 19시반"
              style={inputStyle}
            />
          </Field>

          <Field label="학년 / 대상">
            <select
              value={targetGroup}
              onChange={(e) =>
                setTargetGroup(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                선택해주세요
              </option>

              {TARGET_GROUPS.map(
                ([value, label]) => (
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
                setCourseId(e.target.value)
              }
              style={inputStyle}
            >
              <option value="">
                과정 선택
              </option>

              {courses.map((course) => (
                <option
                  key={course.id}
                  value={course.id}
                >
                  {course.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="정원">
            <input
              type="number"
              min="1"
              value={capacity}
              onChange={(e) =>
                setCapacity(e.target.value)
              }
              placeholder="비워두면 제한 없음"
              style={inputStyle}
            />
          </Field>
        </div>
      </section>

      <section style={sectionStyle}>
        <SectionTitle
          title="수업 조건"
          description="수업시간, 주당 횟수, 시작일과 수강기간을 설정합니다."
        />

        <div className="two-grid">
          <Field label="1회 수업시간">
            <select
              value={lessonDurationMinutes}
              onChange={(e) =>
                setLessonDurationMinutes(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              {settings.allowed_duration_minutes.map(
                (minutes) => (
                  <option
                    key={minutes}
                    value={minutes}
                  >
                    {minutes}분
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="주당 수업 횟수">
            <select
              value={lessonsPerWeek}
              onChange={(e) =>
                setLessonsPerWeek(
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
              value={startDate}
              onChange={(e) =>
                setStartDate(e.target.value)
              }
              style={inputStyle}
            />
          </Field>

          <Field label="수강기간">
            <select
              value={courseWeeks}
              onChange={(e) =>
                setCourseWeeks(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              {weekOptions.map((weeks) => (
                <option
                  key={weeks}
                  value={weeks}
                >
                  {weeks}주
                </option>
              ))}
            </select>
          </Field>
        </div>

        {startDate && (
          <div style={infoBarStyle}>
            수강기간{" "}
            <strong>
              {startDate} ~ {endDate}
            </strong>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <SectionTitle
          title="매주 수업 일정"
          description="주당 수업 횟수만큼 요일과 시간을 지정합니다."
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
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
                  수업 {index + 1}
                </strong>

                <select
                  value={item.weekday}
                  onChange={(e) =>
                    updateSchedule(
                      index,
                      "weekday",
                      e.target.value
                    )
                  }
                  style={inputStyle}
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
                        {DAY_LABELS[day]}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={item.time}
                  onChange={(e) =>
                    updateSchedule(
                      index,
                      "time",
                      e.target.value
                    )
                  }
                  style={inputStyle}
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

      <section style={sectionStyle}>
        <SectionTitle
          title="강사 및 커리큘럼"
          description="강사를 미리 지정할 수도 있고 신청 후 배정할 수도 있습니다."
        />

        <div className="two-grid">
          <Field label="담당 강사">
            <select
              value={teacherUserId}
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

              {teachers.map((teacher) => (
                <option
                  key={teacher.user_id}
                  value={teacher.user_id}
                >
                  {teacher.display_name ||
                    "이름 미등록 강사"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="커리큘럼 / 교재">
            <input
              value={curriculumName}
              onChange={(e) =>
                setCurriculumName(
                  e.target.value
                )
              }
              placeholder="예: Phonics Level 1"
              style={inputStyle}
            />
          </Field>
        </div>
      </section>

      <section style={sectionStyle}>
        <SectionTitle
          title="수강료 계산"
          description="관리자 수강료 설정값과 실제 평일·주말 회차를 기준으로 계산합니다."
        />

        {!selectedPricing ? (
          <div style={warningStyle}>
            과정과 수업시간에 맞는
            수강료를 확인해주세요.
          </div>
        ) : (
          <>
            <div className="price-grid">
              <PriceBox
                label="회당 수강료"
                value={`${formatMoney(
                  pricePreview.pricePerLesson
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

            <div style={totalPriceStyle}>
              <span>
                예상 총 수강료
              </span>

              <strong
                style={{
                  fontSize: "28px",
                  color: "#8fb4ff",
                }}
              >
                {formatMoney(
                  pricePreview.total
                )}
                원
              </strong>
            </div>
          </>
        )}
      </section>

      <section style={sectionStyle}>
        <SectionTitle
          title="공개 및 신청 상태"
          description="비공개로 저장해 검토한 뒤 나중에 공개할 수 있습니다."
        />

        <div className="two-grid">
          <Toggle
            title="학생/학부모에게 공개"
            checked={isPublished}
            onChange={setIsPublished}
          />

          <Toggle
            title="수강신청 가능"
            checked={isOpen}
            onChange={setIsOpen}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <Field label="관리자 메모">
          <textarea
            value={adminNote}
            onChange={(e) =>
              setAdminNote(e.target.value)
            }
            rows={4}
            placeholder="학생에게 공개되지 않는 내부 메모"
            style={{
              ...inputStyle,
              resize: "vertical",
            }}
          />
        </Field>
      </section>

      {errorMessage && (
        <div style={errorStyle}>
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          minHeight: "52px",
          border: 0,
          borderRadius: "10px",
          background: "#2f6fed",
          color: "#ffffff",
          fontSize: "16px",
          fontWeight: 900,
          cursor: submitting
            ? "default"
            : "pointer",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting
          ? "일정 생성 중..."
          : "수강 가능 일정 생성"}
      </button>

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
            90px minmax(0, 1fr)
            minmax(0, 1fr);
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
            repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        @media (max-width: 760px) {
          .two-grid,
          .price-grid {
            grid-template-columns: 1fr;
          }

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
    <div style={{ marginBottom: "20px" }}>
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
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "16px",
        border:
          "1px solid rgba(255,255,255,.12)",
        borderRadius: "10px",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) =>
          onChange(e.target.checked)
        }
        style={{
          width: "18px",
          height: "18px",
          accentColor: "#2f6fed",
        }}
      />

      <strong>{title}</strong>
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
        minHeight: "100px",
        border:
          "1px solid rgba(255,255,255,.12)",
        borderRadius: "10px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          opacity: 0.5,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display: "block",
          marginTop: "9px",
          fontSize: "20px",
        }}
      >
        {value}
      </strong>

      {sub && (
        <div
          style={{
            marginTop: "5px",
            fontSize: "11px",
            opacity: 0.48,
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
  boxSizing: "border-box" as const,
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

const infoBarStyle = {
  marginTop: "14px",
  padding: "12px 14px",
  borderRadius: "9px",
  background:
    "rgba(255,255,255,.05)",
  fontSize: "13px",
};

const warningStyle = {
  padding: "16px",
  border:
    "1px dashed rgba(255,255,255,.18)",
  borderRadius: "10px",
  fontSize: "13px",
  opacity: 0.65,
};

const totalPriceStyle = {
  marginTop: "15px",
  padding: "20px",
  border:
    "1px solid rgba(47,111,237,.35)",
  borderRadius: "12px",
  background:
    "rgba(47,111,237,.11)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
};

const errorStyle = {
  padding: "14px",
  border:
    "1px solid rgba(217,48,37,.6)",
  borderRadius: "10px",
  color: "#ff9d95",
  background:
    "rgba(217,48,37,.08)",
};