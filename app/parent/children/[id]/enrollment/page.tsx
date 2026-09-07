import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

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
  allow_student_choose_teacher: boolean | null;
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

function InfoBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        minHeight: "30px",
        padding: "0 10px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: "#f2f4f7",
        color: "#475467",
        fontSize: "12px",
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
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

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
          원하는 수업 조건과
          희망시간을 먼저 선택하면,
          실제 강사 근무시간과
          예외일정 및 이미 배정된
          수업을 반영하여 가능한
          강사를 찾아드립니다.
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
            추천 프로그램을
            기본으로 선택해두었습니다.
            필요하면 다른 교육과정으로
            변경할 수 있습니다.
          </div>
        </section>
      )}

      <CustomEnrollmentScheduler
        childId={child.id}
        childName={child.name}
        allowedWeekdays={
          allowedWeekdays
        }
        allowedTimeSlots={
          allowedTimeSlots
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
              "1px solid #b2ccff",
            borderRadius:
              "10px",
            background:
              "#eff8ff",
            color: "#175cd3",
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