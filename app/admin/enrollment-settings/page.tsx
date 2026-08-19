import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

const weekdayOptions = [
  { value: "Monday", label: "월" },
  { value: "Tuesday", label: "화" },
  { value: "Wednesday", label: "수" },
  { value: "Thursday", label: "목" },
  { value: "Friday", label: "금" },
  { value: "Saturday", label: "토" },
  { value: "Sunday", label: "일" },
];

const defaultTimeSlots = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

const defaultLessonCounts = [1, 2, 3, 4, 5];
const defaultDurations = [25, 45, 60];

function toNumber(
  value: FormDataEntryValue | null,
  fallback = 0
) {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

async function saveEnrollmentSettings(
  formData: FormData
) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  /*
   * 자가 수강신청 공개 여부
   */
  const adultSelfEnrollmentEnabled =
    formData.get(
      "adult_self_enrollment_enabled"
    ) === "on";

  const parentSelfEnrollmentEnabled =
    formData.get(
      "parent_self_enrollment_enabled"
    ) === "on";

  /*
   * 학생이 직접 선택할 수 있는 항목
   */
  const allowStudentChooseTeacher =
    formData.get(
      "allow_student_choose_teacher"
    ) === "on";

  const allowStudentChooseCurriculum =
    formData.get(
      "allow_student_choose_curriculum"
    ) === "on";

  const showEstimatedPrice =
    formData.get(
      "show_estimated_price"
    ) === "on";

  /*
   * 선택 가능 요일
   */
  const allowedWeekdays =
    formData
      .getAll("allowed_weekdays")
      .map((value) => String(value));

  /*
   * 선택 가능 시간
   */
  const allowedTimeSlots =
    formData
      .getAll("allowed_time_slots")
      .map((value) => String(value));

  /*
   * 주당 수업 횟수
   */
  const allowedLessonsPerWeek =
    formData
      .getAll("allowed_lessons_per_week")
      .map((value) => Number(value))
      .filter((value) =>
        Number.isFinite(value)
      );

  /*
   * 수업시간
   */
  const allowedDurationMinutes =
    formData
      .getAll("allowed_duration_minutes")
      .map((value) => Number(value))
      .filter((value) =>
        Number.isFinite(value)
      );

  const minCourseWeeks = toNumber(
    formData.get("min_course_weeks"),
    4
  );

  const maxCourseWeeks = toNumber(
    formData.get("max_course_weeks"),
    24
  );

  /*
   * 주말 할증률
   */
  const weekendMultiplier = toNumber(
    formData.get("weekend_multiplier"),
    1.5
  );

  if (allowedWeekdays.length === 0) {
    throw new Error(
      "최소 1개의 수업 가능 요일을 선택해주세요."
    );
  }

  if (allowedTimeSlots.length === 0) {
    throw new Error(
      "최소 1개의 수업 가능 시간을 선택해주세요."
    );
  }

  if (
    allowedLessonsPerWeek.length === 0
  ) {
    throw new Error(
      "최소 1개의 주당 수업 횟수를 선택해주세요."
    );
  }

  if (
    allowedDurationMinutes.length === 0
  ) {
    throw new Error(
      "최소 1개의 수업시간을 선택해주세요."
    );
  }

  if (
    minCourseWeeks <= 0 ||
    maxCourseWeeks < minCourseWeeks
  ) {
    throw new Error(
      "수강기간 설정을 확인해주세요."
    );
  }

  if (weekendMultiplier < 1) {
    throw new Error(
      "주말 할증률은 1배 이상이어야 합니다."
    );
  }

  /*
   * 관리자 기본 설정 저장
   */
  const {
    error: settingsError,
  } = await supabase
    .from("enrollment_settings")
    .update({
      adult_self_enrollment_enabled:
        adultSelfEnrollmentEnabled,

      parent_self_enrollment_enabled:
        parentSelfEnrollmentEnabled,

      allowed_weekdays:
        allowedWeekdays,

      allowed_time_slots:
        allowedTimeSlots,

      allowed_lessons_per_week:
        allowedLessonsPerWeek,

      allowed_duration_minutes:
        allowedDurationMinutes,

      min_course_weeks:
        minCourseWeeks,

      max_course_weeks:
        maxCourseWeeks,

      allow_student_choose_teacher:
        allowStudentChooseTeacher,

      allow_student_choose_curriculum:
        allowStudentChooseCurriculum,

      show_estimated_price:
        showEstimatedPrice,

      updated_at:
        new Date().toISOString(),
    })
    .eq("setting_key", "default");

  if (settingsError) {
    throw new Error(
      `수강신청 설정 저장 실패: ${settingsError.message}`
    );
  }

  /*
   * 현재 등록된 모든 과정 확인
   */
  const {
    data: courses,
    error: coursesError,
  } = await supabase
    .from("courses")
    .select("id, name")
    .order("id", {
      ascending: true,
    });

  if (coursesError) {
    throw new Error(
      coursesError.message
    );
  }

  /*
   * 과정별 / 수업시간별
   * 회당 수강료 저장
   */
  for (const course of courses ?? []) {
    for (
      const duration
      of allowedDurationMinutes
    ) {
      const inputName =
        `price_${course.id}_${duration}`;

      const pricePerLesson =
        toNumber(
          formData.get(inputName),
          0
        );

      const {
        error: pricingError,
      } = await supabase
        .from("course_pricing")
        .upsert(
          {
            course_id: course.id,

            lesson_duration_minutes:
              duration,

            price_per_lesson:
              pricePerLesson,

            weekend_multiplier:
              weekendMultiplier,

            is_active: true,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "course_id,lesson_duration_minutes",
          }
        );

      if (pricingError) {
        throw new Error(
          `수강료 저장 실패: ${pricingError.message}`
        );
      }
    }
  }

  revalidatePath(
    "/admin/enrollment-settings"
  );

  redirect(
    "/admin/enrollment-settings?saved=1"
  );
}

type PageProps = {
  searchParams: Promise<{
    saved?: string;
  }>;
};

export default async function EnrollmentSettingsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role, name")
      .eq("id", user.id)
      .single();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  const [
    settingsResult,
    coursesResult,
    pricingResult,
  ] = await Promise.all([
    supabase
      .from("enrollment_settings")
      .select("*")
      .eq(
        "setting_key",
        "default"
      )
      .single(),

    supabase
      .from("courses")
      .select("id, name")
      .order("id", {
        ascending: true,
      }),

    supabase
      .from("course_pricing")
      .select(`
        id,
        course_id,
        lesson_duration_minutes,
        price_per_lesson,
        weekend_multiplier,
        is_active
      `)
      .order("course_id", {
        ascending: true,
      })
      .order(
        "lesson_duration_minutes",
        {
          ascending: true,
        }
      ),
  ]);

  const firstError =
    settingsResult.error ||
    coursesResult.error ||
    pricingResult.error;

  if (firstError) {
    throw new Error(
      firstError.message
    );
  }

  const settings =
    settingsResult.data;

  const courses =
    coursesResult.data ?? [];

  const pricingRows =
    pricingResult.data ?? [];

  const priceMap =
    new Map<string, number>();

  pricingRows.forEach((item) => {
    priceMap.set(
      `${item.course_id}-${item.lesson_duration_minutes}`,
      item.price_per_lesson
    );
  });

  const weekendMultiplier =
    pricingRows.length > 0
      ? Number(
          pricingRows[0]
            .weekend_multiplier
        )
      : 1.5;

  const selectedWeekdays =
    settings.allowed_weekdays ??
    [];

  const selectedTimeSlots =
    settings.allowed_time_slots ??
    [];

  const selectedLessonsPerWeek =
    settings.allowed_lessons_per_week ??
    [];

  const selectedDurations =
    settings.allowed_duration_minutes ??
    [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link
            href="/admin"
            style={{
              color: "inherit",
              textDecoration: "none",
              fontSize: "13px",
              opacity: 0.68,
            }}
          >
            ← 관리자 대시보드
          </Link>

          <h1
            style={{
              margin:
                "12px 0 0",
              fontSize: "32px",
              letterSpacing:
                "-0.03em",
            }}
          >
            수강신청 설정
          </h1>

          <p
            style={{
              margin:
                "9px 0 0",
              opacity: 0.6,
              lineHeight: 1.7,
            }}
          >
            학생과 학부모가 선택할 수 있는
            수업조건과 회당 수강료,
            주말 할증률을 관리합니다.
          </p>
        </div>

        <Link
          href="/admin/enrollments"
          style={{
            padding:
              "10px 14px",
            border:
              "1px solid rgba(255,255,255,0.16)",
            borderRadius:
              "10px",
            color: "inherit",
            textDecoration:
              "none",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          수강 관리 →
        </Link>
      </div>

      {params.saved === "1" && (
        <div
          style={{
            marginTop: "22px",
            padding:
              "14px 16px",
            border:
              "1px solid rgba(86,211,138,0.35)",
            borderRadius:
              "10px",
            background:
              "rgba(86,211,138,0.08)",
            color:
              "#9be8ba",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          설정이 저장되었습니다.
        </div>
      )}

      <form
        action={
          saveEnrollmentSettings
        }
        style={{
          marginTop: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* 공개 설정 */}
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="자가 수강신청 공개 설정"
            description="학생 또는 학부모에게 수강신청 기능을 공개할지 설정합니다."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "12px",
            }}
          >
            <ToggleCard
              name="parent_self_enrollment_enabled"
              title="학부모 자녀 수강신청"
              description="학부모가 등록된 자녀의 수업을 직접 신청할 수 있습니다."
              defaultChecked={
                settings.parent_self_enrollment_enabled
              }
            />

            <ToggleCard
              name="adult_self_enrollment_enabled"
              title="성인 학생 자가 수강신청"
              description="OFF 상태에서는 성인 학생에게 신청 메뉴와 페이지를 공개하지 않습니다."
              defaultChecked={
                settings.adult_self_enrollment_enabled
              }
            />
          </div>
        </section>

        {/* 수강료 */}
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="회당 수강료"
            description="과정별로 25분, 45분, 60분 수업의 회당 가격을 설정합니다."
          />

          <div
            style={{
              marginBottom: "22px",
              maxWidth: "300px",
            }}
          >
            <label
              style={labelStyle}
            >
              주말 할증률
            </label>

            <div
              style={{
                marginTop: "7px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <input
                name="weekend_multiplier"
                type="number"
                min="1"
                step="0.01"
                defaultValue={
                  weekendMultiplier
                }
                style={inputStyle}
              />

              <strong>
                배
              </strong>
            </div>

            <p
              style={hintStyle}
            >
              예: 1.50이면 주말
              수업은 평일 회당
              수강료의 1.5배입니다.
            </p>
          </div>

          {courses.length === 0 ? (
            <div
              style={emptyStyle}
            >
              등록된 과정이 없습니다.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: "14px",
              }}
            >
              {courses.map(
                (course) => (
                  <div
                    key={course.id}
                    style={{
                      padding:
                        "18px",
                      border:
                        "1px solid rgba(255,255,255,0.12)",
                      borderRadius:
                        "12px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize:
                          "16px",
                      }}
                    >
                      {course.name}
                    </div>

                    <div
                      style={{
                        marginTop:
                          "14px",
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {defaultDurations.map(
                        (
                          duration
                        ) => (
                          <div
                            key={
                              duration
                            }
                          >
                            <label
                              style={
                                labelStyle
                              }
                            >
                              {
                                duration
                              }
                              분 회당
                              수강료
                            </label>

                            <div
                              style={{
                                marginTop:
                                  "7px",
                                display:
                                  "flex",
                                gap: "8px",
                                alignItems:
                                  "center",
                              }}
                            >
                              <input
                                name={`price_${course.id}_${duration}`}
                                type="number"
                                min="0"
                                step="100"
                                defaultValue={
                                  priceMap.get(
                                    `${course.id}-${duration}`
                                  ) ??
                                  0
                                }
                                style={
                                  inputStyle
                                }
                              />

                              <span>
                                원
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* 수업시간 */}
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="수업시간 선택"
            description="학생 또는 관리자가 선택할 수 있는 1회 수업시간입니다."
          />

          <CheckboxGrid>
            {defaultDurations.map(
              (duration) => (
                <CheckboxItem
                  key={duration}
                  name="allowed_duration_minutes"
                  value={String(
                    duration
                  )}
                  label={`${duration}분`}
                  defaultChecked={
                    selectedDurations.includes(
                      duration
                    )
                  }
                />
              )
            )}
          </CheckboxGrid>
        </section>

        {/* 주당 횟수 */}
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="주당 수업 횟수"
            description="한 주에 몇 회까지 선택할 수 있는지 설정합니다."
          />

          <CheckboxGrid>
            {defaultLessonCounts.map(
              (count) => (
                <CheckboxItem
                  key={count}
                  name="allowed_lessons_per_week"
                  value={String(
                    count
                  )}
                  label={`주 ${count}회`}
                  defaultChecked={
                    selectedLessonsPerWeek.includes(
                      count
                    )
                  }
                />
              )
            )}
          </CheckboxGrid>
        </section>

        {/* 요일 */}
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="수업 가능 요일"
            description="수강신청 시 선택할 수 있는 요일입니다. 토요일과 일요일은 주말 할증 계산에 사용됩니다."
          />

          <CheckboxGrid>
            {weekdayOptions.map(
              (day) => (
                <CheckboxItem
                  key={day.value}
                  name="allowed_weekdays"
                  value={day.value}
                  label={day.label}
                  defaultChecked={
                    selectedWeekdays.includes(
                      day.value
                    )
                  }
                />
              )
            )}
          </CheckboxGrid>
        </section>

        {/* 시간대 */}
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="수업 가능 시간"
            description="수강신청 시 학생 또는 학부모가 선택할 수 있는 시작 시간입니다."
          />

          <CheckboxGrid>
            {defaultTimeSlots.map(
              (time) => (
                <CheckboxItem
                  key={time}
                  name="allowed_time_slots"
                  value={time}
                  label={time}
                  defaultChecked={
                    selectedTimeSlots.includes(
                      time
                    )
                  }
                />
              )
            )}
          </CheckboxGrid>
        </section>

        {/* 기간 */}
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="수강기간"
            description="학생이 선택할 수 있는 최소·최대 수강기간입니다."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 220px))",
              gap: "14px",
            }}
          >
            <div>
              <label
                style={labelStyle}
              >
                최소 수강기간
              </label>

              <div
                style={{
                  marginTop: "7px",
                  display: "flex",
                  alignItems:
                    "center",
                  gap: "8px",
                }}
              >
                <input
                  name="min_course_weeks"
                  type="number"
                  min="1"
                  defaultValue={
                    settings.min_course_weeks
                  }
                  style={inputStyle}
                />

                <span>
                  주
                </span>
              </div>
            </div>

            <div>
              <label
                style={labelStyle}
              >
                최대 수강기간
              </label>

              <div
                style={{
                  marginTop: "7px",
                  display: "flex",
                  alignItems:
                    "center",
                  gap: "8px",
                }}
              >
                <input
                  name="max_course_weeks"
                  type="number"
                  min="1"
                  defaultValue={
                    settings.max_course_weeks
                  }
                  style={inputStyle}
                />

                <span>
                  주
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 학생 선택 권한 */}
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="학생 선택 권한"
            description="강사와 커리큘럼 선택 권한은 현재 관리자에게만 두는 것을 기본값으로 합니다."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "12px",
            }}
          >
            <ToggleCard
              name="allow_student_choose_teacher"
              title="학생 강사 선택"
              description="ON으로 변경하면 학생이 수강신청 시 강사를 직접 선택할 수 있습니다."
              defaultChecked={
                settings.allow_student_choose_teacher
              }
            />

            <ToggleCard
              name="allow_student_choose_curriculum"
              title="학생 커리큘럼 선택"
              description="ON으로 변경하면 학생이 수강신청 시 커리큘럼을 직접 선택할 수 있습니다."
              defaultChecked={
                settings.allow_student_choose_curriculum
              }
            />

            <ToggleCard
              name="show_estimated_price"
              title="예상 수강료 표시"
              description="수업시간·요일·기간에 따른 예상 수강료를 신청 화면에 표시합니다."
              defaultChecked={
                settings.show_estimated_price
              }
            />
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            gap: "10px",
            paddingBottom: "30px",
          }}
        >
          <Link
            href="/admin"
            style={{
              minHeight: "46px",
              padding:
                "0 20px",
              display:
                "inline-flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              border:
                "1px solid rgba(255,255,255,0.18)",
              borderRadius:
                "10px",
              color: "inherit",
              textDecoration:
                "none",
              fontWeight: 700,
            }}
          >
            취소
          </Link>

          <button
            type="submit"
            style={{
              minHeight: "46px",
              padding:
                "0 24px",
              border: "none",
              borderRadius:
                "10px",
              background:
                "#2f6fed",
              color: "#ffffff",
              fontFamily:
                "inherit",
              fontSize: "14px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            설정 저장
          </button>
        </div>
      </form>
    </div>
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
          margin:
            "7px 0 0",
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

function ToggleCard({
  name,
  title,
  description,
  defaultChecked,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: "13px",
        padding: "16px",
        border:
          "1px solid rgba(255,255,255,0.12)",
        borderRadius: "11px",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={
          defaultChecked
        }
        style={{
          width: "18px",
          height: "18px",
          marginTop: "2px",
          accentColor:
            "#2f6fed",
        }}
      />

      <div>
        <div
          style={{
            fontWeight: 800,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: "6px",
            fontSize: "12px",
            opacity: 0.55,
            lineHeight: 1.6,
          }}
        >
          {description}
        </div>
      </div>
    </label>
  );
}

function CheckboxGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(105px, 1fr))",
        gap: "9px",
      }}
    >
      {children}
    </div>
  );
}

function CheckboxItem({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      style={{
        padding: "12px",
        border:
          "1px solid rgba(255,255,255,0.12)",
        borderRadius: "9px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: 700,
      }}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={
          defaultChecked
        }
        style={{
          width: "16px",
          height: "16px",
          accentColor:
            "#2f6fed",
        }}
      />

      {label}
    </label>
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
  fontSize: "13px",
  fontWeight: 700,
  opacity: 0.72,
};

const inputStyle = {
  width: "100%",
  boxSizing:
    "border-box" as const,
  padding: "11px 12px",
  border:
    "1px solid rgba(255,255,255,0.18)",
  borderRadius: "9px",
  background:
    "rgba(255,255,255,0.06)",
  color: "inherit",
  fontFamily: "inherit",
  fontSize: "14px",
};

const hintStyle = {
  margin: "8px 0 0",
  fontSize: "11px",
  opacity: 0.48,
  lineHeight: 1.6,
};

const emptyStyle = {
  padding: "20px",
  border:
    "1px dashed rgba(255,255,255,0.18)",
  borderRadius: "10px",
  opacity: 0.58,
};