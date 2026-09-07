import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

import EnrollmentOptionSelector from "./EnrollmentOptionSelector";
import CustomEnrollmentScheduler from "./CustomEnrollmentScheduler";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    levelTestId?: string;
  }>;
};

type ChildRow = {
  id: number;
  name: string;
  grade: string | null;
  school_name: string | null;
};

type CourseSummary = {
  id: number;
  name: string;
};

type TeacherSummary = {
  user_id: string;
  display_name: string | null;
  nationality: string | null;
};

type LevelTestRow = {
  id: number;
  child_id: number | null;
  parent_user_id: string | null;
  status: string;
  final_level: string | null;
  final_course_id: number | null;
};

type EnrollmentSettingsRow = {
  parent_self_enrollment_enabled: boolean;
  allowed_weekdays: string[] | null;
  allowed_time_slots: string[] | null;
  allowed_lessons_per_week: number[] | null;
  allowed_duration_minutes: number[] | null;
  show_estimated_price: boolean | null;
  allow_student_choose_teacher: boolean | null;
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

type EnrollmentOptionRow = {
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

  curriculum_name: string | null;

  courses: CourseRelation;
};

function parsePositiveInteger(
  value: string | undefined
) {
  if (!value) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

export default async function ParentChildEnrollmentPage({
  params,
  searchParams,
}: PageProps) {
  const { id } =
    await params;

  const query =
    await searchParams;

  const childId =
    Number(id);

  if (
    !Number.isInteger(childId) ||
    childId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  /*
   * =====================================================
   * 1. 로그인 확인
   * =====================================================
   */
  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * =====================================================
   * 2. 학부모 권한 확인
   * =====================================================
   */
  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  /*
   * =====================================================
   * 3. 자녀 확인
   * =====================================================
   */
  const {
    data: childData,
    error: childError,
  } =
    await supabase
      .from("children")
      .select(`
        id,
        name,
        grade,
        school_name
      `)
      .eq("id", childId)
      .eq(
        "parent_user_id",
        user.id
      )
      .eq("is_active", true)
      .maybeSingle();

  if (childError) {
    throw new Error(
      `자녀 정보를 불러오지 못했습니다: ${childError.message}`
    );
  }

  if (!childData) {
    notFound();
  }

  const child =
    childData as ChildRow;

  /*
   * =====================================================
   * 4. 수강 운영 설정
   * =====================================================
   */
  const {
    data: settingsData,
    error: settingsError,
  } =
    await supabase
      .from(
        "enrollment_settings"
      )
      .select(`
        parent_self_enrollment_enabled,
        allowed_weekdays,
        allowed_time_slots,
        allowed_lessons_per_week,
        allowed_duration_minutes,
        show_estimated_price,
        allow_student_choose_teacher
      `)
      .eq(
        "setting_key",
        "default"
      )
      .maybeSingle();

  if (
    settingsError ||
    !settingsData
  ) {
    throw new Error(
      settingsError
        ? `수강신청 설정을 불러오지 못했습니다: ${settingsError.message}`
        : "수강신청 설정을 찾을 수 없습니다."
    );
  }

  const settings =
    settingsData as EnrollmentSettingsRow;

  if (
    !settings.parent_self_enrollment_enabled
  ) {
    return (
      <main
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          padding:
            "34px 20px 70px",
        }}
      >
        <Link
          href={`/parent/children/${child.id}`}
          style={{
            color:
              "var(--talkly-blue)",
            textDecoration:
              "none",
            fontWeight: 800,
          }}
        >
          ← 자녀 상세
        </Link>

        <section
          className="talkly-card"
          style={{
            marginTop: "20px",
            padding: "30px",
          }}
        >
          <div className="talkly-section-label">
            ENROLLMENT
          </div>

          <h1
            style={{
              margin:
                "8px 0 0",
              color:
                "var(--talkly-navy)",
              fontSize: "30px",
            }}
          >
            수강신청
          </h1>

          <div
            style={{
              marginTop: "20px",
              padding:
                "18px 20px",
              border:
                "1px solid #fedf89",
              borderRadius:
                "12px",
              background:
                "#fffaeb",
              color: "#93370d",
              lineHeight: 1.7,
              fontWeight: 700,
            }}
          >
            현재 학부모
            수강신청이 열려 있지
            않습니다.
          </div>
        </section>
      </main>
    );
  }

  const allowedWeekdays =
    (
      settings.allowed_weekdays ??
      []
    ).map(String);

  const allowedTimeSlots =
    (
      settings.allowed_time_slots ??
      []
    ).map(String);

  const allowedLessonsPerWeek =
    (
      settings.allowed_lessons_per_week ??
      []
    )
      .map(Number)
      .filter(
        (value) =>
          Number.isInteger(
            value
          ) &&
          value > 0
      );

  const allowedDurationMinutes =
    (
      settings.allowed_duration_minutes ??
      []
    )
      .map(Number)
      .filter(
        (value) =>
          value === 25 ||
          value === 50
      );

  /*
   * =====================================================
   * 5. 맞춤 신청용 과정 / 강사 목록
   *
   * 과정은 학부모가 선택할 수 있는 활성 교육과정입니다.
   * 강사 목록은 서버에서 필요한 공개 정보만 전달합니다.
   * 근무시간/예외/기존 수업 등 내부 스케줄 정보는
   * 여기서 노출하지 않고 availability API가 계산합니다.
   * =====================================================
   */
  const {
    data: coursesData,
    error: coursesError,
  } = await supabase
    .from("courses")
    .select(`
      id,
      name
    `)
    .eq("is_active", true)
    .order("id", {
      ascending: true,
    });

  if (coursesError) {
    throw new Error(
      `교육과정을 불러오지 못했습니다: ${coursesError.message}`
    );
  }

  const courses =
    (coursesData ?? []) as CourseSummary[];

  const adminClient =
    createAdminClient();

  const {
    data: teachersData,
    error: teachersError,
  } = await adminClient
    .from("teacher_profiles")
    .select(`
      user_id,
      display_name,
      nationality
    `)
    .eq("is_active", true)
    .order("display_name", {
      ascending: true,
      nullsFirst: false,
    });

  if (teachersError) {
    throw new Error(
      `강사 목록을 불러오지 못했습니다: ${teachersError.message}`
    );
  }

  const teachers =
    (teachersData ?? []) as TeacherSummary[];

  /*
   * =====================================================
   * 6. 레벨테스트 추천 연결
   *
   * URL의 levelTestId는 신뢰하지 않고,
   * 현재 학부모 + 현재 자녀 + completed 상태를
   * 서버에서 다시 검증합니다.
   * =====================================================
   */
  const requestedLevelTestId =
    parsePositiveInteger(
      query.levelTestId
    );

  let validLevelTest:
    LevelTestRow | null = null;

  let recommendedCourse:
    CourseSummary | null = null;

  let recommendedLevel:
    string | null = null;

  if (requestedLevelTestId) {
    const {
      data: levelTestData,
      error: levelTestError,
    } =
      await supabase
        .from("level_tests")
        .select(`
          id,
          child_id,
          parent_user_id,
          status,
          final_level,
          final_course_id
        `)
        .eq(
          "id",
          requestedLevelTestId
        )
        .eq(
          "parent_user_id",
          user.id
        )
        .eq(
          "child_id",
          child.id
        )
        .maybeSingle();

    if (
      !levelTestError &&
      levelTestData
    ) {
      const levelTest =
        levelTestData as
          LevelTestRow;

      const finalized =
        levelTest.status ===
          "completed" &&
        Boolean(
          levelTest.final_level
        ) &&
        Boolean(
          levelTest.final_course_id
        );

      if (finalized) {
        validLevelTest =
          levelTest;

        recommendedLevel =
          levelTest.final_level;

        const {
          data: courseData,
          error: courseError,
        } =
          await supabase
            .from("courses")
            .select(`
              id,
              name
            `)
            .eq(
              "id",
              levelTest.final_course_id as number
            )
            .eq(
              "is_active",
              true
            )
            .maybeSingle();

        if (
          !courseError &&
          courseData
        ) {
          recommendedCourse =
            courseData as
              CourseSummary;
        }
      }
    }
  }

  /*
   * =====================================================
   * 7. 기존 표준 수강 가능 일정
   *
   * 기존 EnrollmentOptionSelector를 그대로 유지합니다.
   * 맞춤수업 기능 추가 때문에 표준 일정 기능을
   * 제거하지 않습니다.
   * =====================================================
   */
  const {
    data: optionsData,
    error: optionsError,
  } =
    await supabase
      .from(
        "enrollment_options"
      )
      .select(`
        id,
        title,

        course_id,
        target_group,

        lesson_duration_minutes,
        lessons_per_week,

        preferred_days,
        preferred_times,

        course_weeks,

        start_date,
        end_date,

        total_lessons,

        price_per_lesson,

        weekend_multiplier,

        weekday_lesson_count,
        weekend_lesson_count,

        estimated_price,

        capacity,
        enrolled_count,

        curriculum_name,

        courses (
          id,
          name
        )
      `)
      .eq("is_published", true)
      .eq("is_open", true)
      .order(
        "start_date",
        {
          ascending: true,
        }
      )
      .order("id", {
        ascending: true,
      });

  if (optionsError) {
    throw new Error(
      `수강 가능 일정을 불러오지 못했습니다: ${optionsError.message}`
    );
  }

  const options =
    (optionsData ??
      []) as unknown as
      EnrollmentOptionRow[];

  /*
   * 레벨테스트 추천 과정이 있을 때는
   * 표준 일정도 우선 추천 과정만 전달합니다.
   *
   * EnrollmentOptionSelector 내부의
   * "다른 과정도 보기" 기능이 이미 있다면
   * 해당 컴포넌트가 전체 options가 필요할 수 있으므로,
   * 현재는 전체 options를 유지해 전달하고
   * recommendedCourse prop으로 추천과정을 알려줍니다.
   */
  const selectorOptions =
    options;

  const validLevelTestId =
    validLevelTest?.id ??
    null;

  const backHref =
    validLevelTestId
      ? `/parent/level-tests/${validLevelTestId}`
      : `/parent/children/${child.id}`;

  const backLabel =
    validLevelTestId
      ? "← 레벨테스트 결과"
      : "← 자녀 상세";

  return (
    <main
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
        padding:
          "34px 20px 70px",
      }}
    >
      <Link
        href={backHref}
        style={{
          color:
            "var(--talkly-blue)",
          textDecoration: "none",
          fontWeight: 800,
        }}
      >
        {backLabel}
      </Link>

      {/* ================================================= */}
      {/* 페이지 헤더 */}
      {/* ================================================= */}

      <section
        className="talkly-card"
        style={{
          marginTop: "20px",
          padding: "30px",
        }}
      >
        <div className="talkly-section-label">
          ENROLLMENT
        </div>

        <h1
          style={{
            margin: "8px 0 0",
            color:
              "var(--talkly-navy)",
            fontSize: "32px",
            letterSpacing:
              "-0.03em",
          }}
        >
          {child.name} 학생
          수강신청
        </h1>

        <p
          style={{
            margin:
              "10px 0 0",
            color:
              "var(--text-muted)",
            lineHeight: 1.75,
          }}
        >
          표준 수강 일정에서
          선택하거나, 강사의 실제
          가용시간을 확인하여 맞춤
          수업을 신청할 수
          있습니다.
        </p>

        <div
          style={{
            marginTop: "18px",
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <InfoBadge>
            {child.grade ??
              "학년 미등록"}
          </InfoBadge>

          {child.school_name && (
            <InfoBadge>
              {child.school_name}
            </InfoBadge>
          )}
        </div>
      </section>

      {/* ================================================= */}
      {/* 레벨테스트 추천 */}
      {/* ================================================= */}

      {recommendedCourse && (
        <section
          style={{
            marginTop: "20px",
            padding: "22px 24px",
            border:
              "1px solid #b2ccff",
            borderRadius:
              "15px",
            background:
              "#eff8ff",
          }}
        >
          <div
            style={{
              color: "#175cd3",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            LEVEL TEST
            RECOMMENDATION
          </div>

          <div
            style={{
              marginTop: "7px",
              color: "#0a1f44",
              fontSize: "22px",
              fontWeight: 900,
            }}
          >
            {
              recommendedCourse.name
            }
          </div>

          {recommendedLevel && (
            <div
              style={{
                marginTop: "5px",
                color: "#475467",
                fontSize: "13px",
                lineHeight: 1.7,
              }}
            >
              최종 레벨:{" "}
              <strong>
                {
                  recommendedLevel
                }
              </strong>
            </div>
          )}

          <div
            style={{
              marginTop: "8px",
              color: "#667085",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            추천 프로그램은
            교육과정 추천이며,
            수업시간·요일·강사·기간은
            아래에서 별도로
            선택합니다.
          </div>
        </section>
      )}

      {/* ================================================= */}
      {/* 맞춤 수업 */}
      {/* ================================================= */}

      <CustomEnrollmentScheduler
        childId={child.id}
        childName={child.name}
        allowedWeekdays={
          allowedWeekdays
        }
        allowedLessonsPerWeek={
          allowedLessonsPerWeek
        }
        allowedDurationMinutes={
          allowedDurationMinutes
        }
        courses={courses}
        teachers={teachers}
        allowTeacherChoice={
          settings.allow_student_choose_teacher !==
          false
        }
        recommendedCourse={
          recommendedCourse
        }
        recommendedLevel={
          recommendedLevel
        }
        levelTestId={
          validLevelTestId
        }
      />

      {/* ================================================= */}
      {/* 기존 표준 일정 */}
      {/* ================================================= */}

      <section
        style={{
          marginTop: "28px",
        }}
      >
        <div
          style={{
            padding:
              "0 2px 4px",
          }}
        >
          <div className="talkly-section-label">
            STANDARD SCHEDULE
          </div>

          <h2
            style={{
              margin:
                "7px 0 0",
              color:
                "var(--talkly-navy)",
              fontSize: "25px",
            }}
          >
            미리 등록된 표준
            수업 일정
          </h2>

          <p
            style={{
              margin:
                "8px 0 0",
              color:
                "var(--text-muted)",
              lineHeight: 1.7,
            }}
          >
            TALKLY가 미리 등록한
            수강 가능 일정 중에서
            바로 선택하는 기존
            방식도 계속 이용할 수
            있습니다.
          </p>
        </div>

        <EnrollmentOptionSelector
          child={{
            id: child.id,
            name: child.name,
            grade: child.grade,
          }}
          options={
            selectorOptions as any
          }
          allowedWeekdays={
            allowedWeekdays
          }
          allowedTimeSlots={
            allowedTimeSlots
          }
          allowedLessonsPerWeek={
            allowedLessonsPerWeek
          }
          showEstimatedPrice={
            settings.show_estimated_price !==
            false
          }
          recommendedCourse={
            recommendedCourse
          }
          recommendedLevel={
            recommendedLevel
          }
          levelTestId={
            validLevelTestId
          }
        />
      </section>

      <div
        style={{
          marginTop: "30px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href={`/parent/children/${child.id}/enrollment-requests`}
          style={{
            minHeight: "46px",
            padding: "0 17px",
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            border:
              "1px solid #d0d5dd",
            borderRadius:
              "10px",
            background:
              "#ffffff",
            color: "#344054",
            textDecoration:
              "none",
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          수강신청 현황
        </Link>

        <Link
          href={`/parent/children/${child.id}`}
          style={{
            minHeight: "46px",
            padding: "0 17px",
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            border:
              "1px solid #dbe7ff",
            borderRadius:
              "10px",
            background:
              "#f5f8ff",
            color: "#2f6fed",
            textDecoration:
              "none",
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          자녀 상세로 돌아가기
        </Link>
      </div>
    </main>
  );
}

function InfoBadge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius:
          "999px",
        background:
          "#f2f4f7",
        color: "#475467",
        fontSize: "11px",
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}