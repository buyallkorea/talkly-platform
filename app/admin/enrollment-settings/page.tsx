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

const defaultLessonCounts = [
  1,
  2,
  3,
  4,
  5,
];

const defaultDurations = [
  25,
  45,
  60,
];

type DiscountTier = {
  label: string;
  weeks: number;
  discount_percent: number;
  is_active: boolean;
};

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

/*
 * 수강신청 설정 저장
 */
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

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
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
   * 학생 선택 권한
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
   * 장기 수강 할인
   */
  const longTermDiscountEnabled =
    formData.get(
      "long_term_discount_enabled"
    ) === "on";

  const showLongTermDiscount =
    formData.get(
      "show_long_term_discount"
    ) === "on";

  const discount12Weeks = toNumber(
    formData.get(
      "discount_12_weeks"
    ),
    10
  );

  const discount24Weeks = toNumber(
    formData.get(
      "discount_24_weeks"
    ),
    15
  );

  const discount52Weeks = toNumber(
    formData.get(
      "discount_52_weeks"
    ),
    20
  );

  const longTermDiscounts: DiscountTier[] =
    [
      {
        label: "3개월",
        weeks: 12,
        discount_percent:
          discount12Weeks,
        is_active:
          discount12Weeks > 0,
      },
      {
        label: "6개월",
        weeks: 24,
        discount_percent:
          discount24Weeks,
        is_active:
          discount24Weeks > 0,
      },
      {
        label: "12개월",
        weeks: 52,
        discount_percent:
          discount52Weeks,
        is_active:
          discount52Weeks > 0,
      },
    ];

  /*
   * 선택 가능 요일
   */
  const allowedWeekdays =
    formData
      .getAll("allowed_weekdays")
      .map((value) =>
        String(value)
      );

  /*
   * 선택 가능 시간
   */
  const allowedTimeSlots =
    formData
      .getAll("allowed_time_slots")
      .map((value) =>
        String(value)
      );

  /*
   * 주당 수업 횟수
   */
  const allowedLessonsPerWeek =
    formData
      .getAll(
        "allowed_lessons_per_week"
      )
      .map((value) =>
        Number(value)
      )
      .filter((value) =>
        Number.isFinite(value)
      );

  /*
   * 수업시간
   */
  const allowedDurationMinutes =
    formData
      .getAll(
        "allowed_duration_minutes"
      )
      .map((value) =>
        Number(value)
      )
      .filter((value) =>
        Number.isFinite(value)
      );

  /*
   * 수강기간
   */
  const minCourseWeeks = toNumber(
    formData.get(
      "min_course_weeks"
    ),
    4
  );

  const maxCourseWeeks = toNumber(
    formData.get(
      "max_course_weeks"
    ),
    52
  );

  /*
   * 주말 할증률
   */
  const weekendMultiplier = toNumber(
    formData.get(
      "weekend_multiplier"
    ),
    1.5
  );

  /*
   * 기본 검증
   */
  if (
    allowedWeekdays.length === 0
  ) {
    throw new Error(
      "최소 1개의 수업 가능 요일을 선택해주세요."
    );
  }

  if (
    allowedTimeSlots.length === 0
  ) {
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
    allowedDurationMinutes.length ===
    0
  ) {
    throw new Error(
      "최소 1개의 수업시간을 선택해주세요."
    );
  }

  if (
    minCourseWeeks <= 0 ||
    maxCourseWeeks <
      minCourseWeeks
  ) {
    throw new Error(
      "수강기간 설정을 확인해주세요."
    );
  }

  if (
    weekendMultiplier < 1
  ) {
    throw new Error(
      "주말 할증률은 1배 이상이어야 합니다."
    );
  }

  /*
   * 장기 할인율 검증
   */
  if (
    discount12Weeks < 0 ||
    discount12Weeks > 100 ||
    discount24Weeks < 0 ||
    discount24Weeks > 100 ||
    discount52Weeks < 0 ||
    discount52Weeks > 100
  ) {
    throw new Error(
      "장기 수강 할인율은 0% 이상 100% 이하로 입력해주세요."
    );
  }

  /*
   * 할인기간 사용 시
   * 최대 수강기간 확인
   */
  if (
    longTermDiscountEnabled &&
    maxCourseWeeks < 12
  ) {
    throw new Error(
      "장기 수강 할인을 사용하려면 최대 수강기간을 최소 12주 이상으로 설정해주세요."
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

      long_term_discount_enabled:
        longTermDiscountEnabled,

      show_long_term_discount:
        showLongTermDiscount,

      long_term_discounts:
        longTermDiscounts,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "setting_key",
      "default"
    );

  if (settingsError) {
    throw new Error(
      `수강신청 설정 저장 실패: ${settingsError.message}`
    );
  }

  /*
   * 현재 등록된 모든 과정
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
  for (
    const course
    of courses ?? []
  ) {
    for (
      const duration
      of allowedDurationMinutes
    ) {
      const inputName =
        `price_${course.id}_${duration}`;

      const pricePerLesson =
        toNumber(
          formData.get(
            inputName
          ),
          0
        );

      const {
        error: pricingError,
      } = await supabase
        .from("course_pricing")
        .upsert(
          {
            course_id:
              course.id,

            lesson_duration_minutes:
              duration,

            price_per_lesson:
              pricePerLesson,

            weekend_multiplier:
              weekendMultiplier,

            is_active:
              true,

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
  const params =
    await searchParams;

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
      .from(
        "enrollment_settings"
      )
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

  /*
   * 회당 수강료 Map
   */
  const priceMap =
    new Map<string, number>();

  pricingRows.forEach(
    (item) => {
      priceMap.set(
        `${item.course_id}-${item.lesson_duration_minutes}`,
        item.price_per_lesson
      );
    }
  );

  /*
   * 주말 할증률
   */
  const weekendMultiplier =
    pricingRows.length > 0
      ? Number(
          pricingRows[0]
            .weekend_multiplier
        )
      : 1.5;

  /*
   * 현재 설정
   */
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

  /*
   * 장기 할인 설정
   */
  const rawDiscounts =
    settings.long_term_discounts;

  const discountTiers: DiscountTier[] =
    Array.isArray(
      rawDiscounts
    )
      ? rawDiscounts
      : [];

  const discount12 =
    Number(
      discountTiers.find(
        (item) =>
          Number(
            item.weeks
          ) === 12
      )?.discount_percent ??
        10
    );

  const discount24 =
    Number(
      discountTiers.find(
        (item) =>
          Number(
            item.weeks
          ) === 24
      )?.discount_percent ??
        15
    );

  const discount52 =
    Number(
      discountTiers.find(
        (item) =>
          Number(
            item.weeks
          ) === 52
      )?.discount_percent ??
        20
    );

  return (
    <div>
      {/* 상단 */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <Link
            href="/admin"
            style={{
              color: "inherit",
              textDecoration:
                "none",
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
            학생과 학부모가
            선택할 수 있는
            수업조건, 수강료와
            장기 수강 할인정책을
            관리합니다.
          </p>
        </div>

        <Link
          href="/admin/enrollments"
          style={topLinkStyle}
        >
          수강 관리 →
        </Link>
      </div>

      {/* 저장 완료 */}
      {params.saved === "1" && (
        <div
          style={{
            marginTop: "22px",
            padding:
              "14px 16px",
            border:
              "1px solid rgba(24,160,88,.28)",
            borderRadius:
              "10px",
            background:
              "rgba(24,160,88,.07)",
            color:
              "#16854c",
            fontSize: "14px",
            fontWeight: 800,
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
          flexDirection:
            "column",
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
                Boolean(
                  settings.parent_self_enrollment_enabled
                )
              }
            />

            <ToggleCard
              name="adult_self_enrollment_enabled"
              title="성인 학생 자가 수강신청"
              description="OFF 상태에서는 성인 학생에게 신청 메뉴와 페이지를 공개하지 않습니다."
              defaultChecked={
                Boolean(
                  settings.adult_self_enrollment_enabled
                )
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
              marginBottom:
                "22px",
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
                alignItems:
                  "center",
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

            <p style={hintStyle}>
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
                    key={
                      course.id
                    }
                    style={
                      coursePriceCardStyle
                    }
                  >
                    <div
                      style={{
                        fontWeight:
                          800,
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
                  key={
                    duration
                  }
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
                  key={
                    day.value
                  }
                  name="allowed_weekdays"
                  value={
                    day.value
                  }
                  label={
                    day.label
                  }
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
                  marginTop:
                    "7px",
                  display:
                    "flex",
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
                    settings.min_course_weeks ??
                    4
                  }
                  style={
                    inputStyle
                  }
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
                  marginTop:
                    "7px",
                  display:
                    "flex",
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
                    settings.max_course_weeks ??
                    52
                  }
                  style={
                    inputStyle
                  }
                />

                <span>
                  주
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "14px",
              padding:
                "13px 15px",
              borderRadius:
                "10px",
              background:
                "rgba(47,111,237,.06)",
              border:
                "1px solid rgba(47,111,237,.14)",
              fontSize: "12px",
              lineHeight: 1.7,
              color: "#526071",
            }}
          >
            12개월 장기 수강
            할인을 사용하려면 최대
            수강기간을 52주 이상으로
            설정하는 것을 권장합니다.
          </div>
        </section>

        {/* 장기 수강 할인 */}
        <section
          style={sectionStyle}
        >
          <SectionHeader
            title="장기 수강 할인"
            description="3개월·6개월·12개월 등 장기간 선결제 수강 시 적용할 할인율을 설정합니다."
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
              name="long_term_discount_enabled"
              title="장기 수강 할인 사용"
              description="장기간 수강을 선택하면 기간별 할인율을 적용할 수 있도록 합니다."
              defaultChecked={
                settings.long_term_discount_enabled ??
                true
              }
            />

            <ToggleCard
              name="show_long_term_discount"
              title="수강신청 화면에 할인 혜택 표시"
              description="학부모와 학생에게 정상가, 할인율, 할인 후 금액과 절약 금액을 보여줍니다."
              defaultChecked={
                settings.show_long_term_discount ??
                true
              }
            />
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            <DiscountInput
              title="3개월 수강"
              weeks={12}
              name="discount_12_weeks"
              defaultValue={
                discount12
              }
            />

            <DiscountInput
              title="6개월 수강"
              weeks={24}
              name="discount_24_weeks"
              defaultValue={
                discount24
              }
            />

            <DiscountInput
              title="12개월 수강"
              weeks={52}
              name="discount_52_weeks"
              defaultValue={
                discount52
              }
              recommended
            />
          </div>

          <div
            style={{
              marginTop: "20px",
              padding:
                "18px",
              border:
                "1px solid rgba(47,111,237,.18)",
              borderRadius:
                "12px",
              background:
                "rgba(47,111,237,.05)",
            }}
          >
            <div
              style={{
                fontSize:
                  "14px",
                fontWeight:
                  800,
                color:
                  "#101828",
              }}
            >
              고객 화면 표시 예시
            </div>

            <div
              style={{
                marginTop:
                  "12px",
                display:
                  "flex",
                gap: "9px",
                flexWrap:
                  "wrap",
              }}
            >
              <PromoBadge
                text={`3개월 ${discount12}% 할인`}
              />

              <PromoBadge
                text={`6개월 ${discount24}% 할인`}
              />

              <PromoBadge
                text={`12개월 ${discount52}% 할인 · 최대 혜택`}
              />
            </div>

            <div
              style={{
                marginTop:
                  "16px",
                padding:
                  "16px",
                borderRadius:
                  "10px",
                background:
                  "#ffffff",
                border:
                  "1px solid rgba(15,39,76,.10)",
              }}
            >
              <div
                style={{
                  fontSize:
                    "12px",
                  color:
                    "#7b8493",
                }}
              >
                예시 · 정상가
                1,440,000원
              </div>

              <div
                style={{
                  marginTop:
                    "7px",
                  display:
                    "flex",
                  alignItems:
                    "baseline",
                  gap: "9px",
                  flexWrap:
                    "wrap",
                }}
              >
                <span
                  style={{
                    textDecoration:
                      "line-through",
                    color:
                      "#98a2b3",
                  }}
                >
                  1,440,000원
                </span>

                <strong
                  style={{
                    fontSize:
                      "20px",
                    color:
                      "#0b2855",
                  }}
                >
                  {Math.round(
                    1440000 *
                      (1 -
                        discount52 /
                          100)
                  ).toLocaleString(
                    "ko-KR"
                  )}
                  원
                </strong>

                <span
                  style={{
                    color:
                      "#16854c",
                    fontWeight:
                      800,
                  }}
                >
                  {Math.round(
                    1440000 *
                      (discount52 /
                        100)
                  ).toLocaleString(
                    "ko-KR"
                  )}
                  원 절약
                </span>
              </div>
            </div>

            <p
              style={{
                margin:
                  "12px 0 0",
                fontSize:
                  "12px",
                opacity: 0.6,
                lineHeight:
                  1.7,
              }}
            >
              이 화면의 금액은
              표시 예시입니다. 실제
              수강신청 화면에서는
              선택한 과정, 수업시간,
              주당 횟수, 주말 수업
              여부에 따라 계산한
              정상가를 기준으로
              할인금액과 최종
              수강료를 표시하게
              됩니다.
            </p>
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
                Boolean(
                  settings.allow_student_choose_teacher
                )
              }
            />

            <ToggleCard
              name="allow_student_choose_curriculum"
              title="학생 커리큘럼 선택"
              description="ON으로 변경하면 학생이 수강신청 시 커리큘럼을 직접 선택할 수 있습니다."
              defaultChecked={
                Boolean(
                  settings.allow_student_choose_curriculum
                )
              }
            />

            <ToggleCard
              name="show_estimated_price"
              title="예상 수강료 표시"
              description="수업시간·요일·기간에 따른 예상 수강료를 신청 화면에 표시합니다."
              defaultChecked={
                Boolean(
                  settings.show_estimated_price
                )
              }
            />
          </div>
        </section>

        {/* 저장 버튼 */}
        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            gap: "10px",
            paddingBottom:
              "30px",
          }}
        >
          <Link
            href="/admin"
            style={
              cancelButtonStyle
            }
          >
            취소
          </Link>

          <button
            type="submit"
            style={
              saveButtonStyle
            }
          >
            설정 저장
          </button>
        </div>
      </form>
    </div>
  );
}

/*
 * 제목
 */
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
        marginBottom:
          "20px",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: "20px",
          color: "#101828",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin:
            "7px 0 0",
          fontSize: "13px",
          color: "#7b8493",
          lineHeight:
            1.65,
        }}
      >
        {description}
      </p>
    </div>
  );
}

/*
 * 설정 토글
 */
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
          "1px solid rgba(15,39,76,.11)",
        borderRadius:
          "11px",
        cursor: "pointer",
        background:
          "#ffffff",
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
            color: "#101828",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: "6px",
            fontSize:
              "12px",
            color:
              "#7b8493",
            lineHeight:
              1.6,
          }}
        >
          {description}
        </div>
      </div>
    </label>
  );
}

/*
 * 체크박스 그리드
 */
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
          "1px solid rgba(15,39,76,.11)",
        borderRadius:
          "9px",
        display: "flex",
        alignItems:
          "center",
        gap: "8px",
        cursor: "pointer",
        fontSize:
          "13px",
        fontWeight: 700,
        background:
          "#ffffff",
        color: "#101828",
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

/*
 * 장기 할인 입력
 */
function DiscountInput({
  title,
  weeks,
  name,
  defaultValue,
  recommended = false,
}: {
  title: string;
  weeks: number;
  name: string;
  defaultValue: number;
  recommended?: boolean;
}) {
  return (
    <div
      style={{
        padding: "18px",
        border:
          recommended
            ? "1px solid rgba(47,111,237,.35)"
            : "1px solid rgba(15,39,76,.11)",
        borderRadius:
          "12px",
        background:
          recommended
            ? "rgba(47,111,237,.04)"
            : "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            fontSize:
              "15px",
            fontWeight:
              800,
            color:
              "#101828",
          }}
        >
          {title}
        </div>

        {recommended && (
          <span
            style={{
              padding:
                "5px 8px",
              borderRadius:
                "999px",
              background:
                "rgba(47,111,237,.12)",
              color:
                "#2f6fed",
              fontSize:
                "11px",
              fontWeight:
                800,
            }}
          >
            최대 혜택
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontSize: "12px",
          color: "#7b8493",
        }}
      >
        {weeks}주 기준
      </div>

      <label
        style={{
          ...labelStyle,
          marginTop: "16px",
        }}
      >
        할인율
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
          name={name}
          type="number"
          min="0"
          max="100"
          step="1"
          defaultValue={
            defaultValue
          }
          style={
            inputStyle
          }
        />

        <strong>
          %
        </strong>
      </div>
    </div>
  );
}

function PromoBadge({
  text,
}: {
  text: string;
}) {
  return (
    <span
      style={{
        display:
          "inline-flex",
        alignItems:
          "center",
        minHeight: "30px",
        padding:
          "0 10px",
        borderRadius:
          "999px",
        background:
          "rgba(47,111,237,.10)",
        color:
          "#2f6fed",
        fontSize: "12px",
        fontWeight: 800,
      }}
    >
      {text}
    </span>
  );
}

/*
 * 공통 스타일
 */
const sectionStyle = {
  padding: "24px",
  border:
    "1px solid rgba(15,39,76,.10)",
  borderRadius: "14px",
  background:
    "rgba(255,255,255,.72)",
};

const coursePriceCardStyle = {
  padding: "18px",
  border:
    "1px solid rgba(15,39,76,.10)",
  borderRadius: "12px",
  background: "#ffffff",
};

const labelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 700,
  color: "#526071",
};

const inputStyle = {
  width: "100%",
  boxSizing:
    "border-box" as const,
  padding:
    "11px 12px",
  border:
    "1px solid rgba(15,39,76,.15)",
  borderRadius:
    "9px",
  background:
    "#ffffff",
  color:
    "#101828",
  fontFamily:
    "inherit",
  fontSize:
    "14px",
};

const hintStyle = {
  margin: "8px 0 0",
  fontSize: "11px",
  color: "#8a94a3",
  lineHeight: 1.6,
};

const emptyStyle = {
  padding: "20px",
  border:
    "1px dashed rgba(15,39,76,.18)",
  borderRadius: "10px",
  color: "#7b8493",
};

const topLinkStyle = {
  padding: "10px 14px",
  border:
    "1px solid rgba(15,39,76,.14)",
  borderRadius: "10px",
  color: "#101828",
  background: "#ffffff",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 700,
};

const cancelButtonStyle = {
  minHeight: "46px",
  padding: "0 20px",
  display:
    "inline-flex",
  alignItems: "center",
  justifyContent:
    "center",
  border:
    "1px solid rgba(15,39,76,.15)",
  borderRadius:
    "10px",
  color: "#101828",
  background: "#ffffff",
  textDecoration:
    "none",
  fontWeight: 700,
};

const saveButtonStyle = {
  minHeight: "46px",
  padding: "0 24px",
  border: "none",
  borderRadius:
    "10px",
  background:
    "#2f6fed",
  color: "#ffffff",
  fontFamily:
    "inherit",
  fontSize:
    "14px",
  fontWeight:
    900,
  cursor: "pointer",
};