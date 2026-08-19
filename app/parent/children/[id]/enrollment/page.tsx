import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";
import EnrollmentOptionSelector from "./EnrollmentOptionSelector";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ParentChildEnrollmentPage({
  params,
}: PageProps) {
  const { id } = await params;

  const childId = Number(id);

  if (
    !Number.isInteger(childId) ||
    childId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  /*
   * -------------------------------------------------------
   * 1. 로그인 확인
   * -------------------------------------------------------
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /*
   * -------------------------------------------------------
   * 2. 학부모 권한 확인
   * -------------------------------------------------------
   */
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      profileError.message
    );
  }

  if (
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  /*
   * -------------------------------------------------------
   * 3. 학부모 본인의 자녀 확인
   * -------------------------------------------------------
   */
  const {
    data: child,
    error: childError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      grade,
      school_name,
      birth_date,
      is_active
    `)
    .eq("id", childId)
    .eq(
      "parent_user_id",
      user.id
    )
    .eq(
      "is_active",
      true
    )
    .maybeSingle();

  if (childError) {
    throw new Error(
      childError.message
    );
  }

  if (!child) {
    notFound();
  }

  /*
   * -------------------------------------------------------
   * 4. 수강신청 기본 설정 조회
   *
   * 반드시 setting_key = default 한 건만 사용합니다.
   * RLS에서도 authenticated 사용자가 default 설정을
   * 읽을 수 있도록 정책을 추가했습니다.
   * -------------------------------------------------------
   */
  const {
    data: settings,
    error: settingsError,
  } = await supabase
    .from(
      "enrollment_settings"
    )
    .select(`
      setting_key,
      parent_self_enrollment_enabled,
      allowed_weekdays,
      allowed_time_slots,
      allowed_lessons_per_week,
      show_estimated_price
    `)
    .eq(
      "setting_key",
      "default"
    )
    .maybeSingle();

  if (settingsError) {
    throw new Error(
      `수강신청 설정 조회 실패: ${settingsError.message}`
    );
  }

  if (!settings) {
    throw new Error(
      "기본 수강신청 설정(default)을 찾을 수 없습니다."
    );
  }

  /*
   * -------------------------------------------------------
   * 5. 관리자가 학부모 자가 수강신청을 OFF한 경우
   *
   * 메뉴 숨김뿐 아니라 URL 직접 접근도 차단합니다.
   * -------------------------------------------------------
   */
  if (
    !settings
      .parent_self_enrollment_enabled
  ) {
    redirect(
      `/parent/children/${childId}`
    );
  }

  /*
   * -------------------------------------------------------
   * 6. 학생/학부모에게 공개되어 있고
   * 현재 신청 가능한 표준 수강 일정 조회
   *
   * enrollment_options RLS에서도
   * 공개 + 신청가능 행만 일반 사용자가 볼 수 있습니다.
   * -------------------------------------------------------
   */
  const {
    data: options,
    error: optionsError,
  } = await supabase
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

      is_published,
      is_open,

      courses (
        id,
        name
      )
    `)
    .eq(
      "is_published",
      true
    )
    .eq(
      "is_open",
      true
    )
    .order(
      "start_date",
      {
        ascending: true,
      }
    );

  if (optionsError) {
    throw new Error(
      `수강 가능 일정 조회 실패: ${optionsError.message}`
    );
  }

  /*
   * -------------------------------------------------------
   * 7. 화면
   * -------------------------------------------------------
   */
  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
        userName={
          profile.name
        }
      />

      <main className="talkly-dashboard-main">
        {/* 뒤로가기 */}

        <Link
          href={`/parent/children/${child.id}`}
          style={{
            color:
              "var(--talkly-blue)",
            textDecoration:
              "none",
            fontWeight: 800,
            fontSize: "14px",
          }}
        >
          ← 자녀 상세
        </Link>

        {/* 상단 안내 */}

        <section
          style={{
            marginTop: "22px",
            padding: "30px",
            borderRadius: "22px",

            background:
              "linear-gradient(135deg, #ffffff 0%, #edf4ff 100%)",

            border:
              "1px solid #dce7f5",

            boxShadow:
              "0 12px 34px rgba(10,31,68,0.07)",
          }}
        >
          <div className="talkly-section-label">
            CLASS ENROLLMENT
          </div>

          <h1
            style={{
              margin:
                "8px 0 0",

              color:
                "var(--talkly-navy)",

              fontSize:
                "34px",

              letterSpacing:
                "-0.04em",
            }}
          >
            {child.name} 수강신청
          </h1>

          <p
            style={{
              margin:
                "12px 0 0",

              color:
                "var(--text-muted)",

              lineHeight: 1.75,
            }}
          >
            학년, 주당 수업 횟수,
            요일과 시간을 선택하면
            조건에 맞는 TALKLY
            수업 일정을 찾아드립니다.
          </p>

          {/* 자녀 기본 정보 */}

          <div
            style={{
              marginTop: "22px",

              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            {child.grade && (
              <InfoChip
                label="학년"
                value={
                  child.grade
                }
              />
            )}

            {child.school_name && (
              <InfoChip
                label="학교"
                value={
                  child.school_name
                }
              />
            )}

            {child.birth_date && (
              <InfoChip
                label="생년월일"
                value={
                  child.birth_date
                }
              />
            )}
          </div>
        </section>

        {/* 일정 검색 / 선택 */}

        <EnrollmentOptionSelector
          child={{
            id:
              child.id,

            name:
              child.name,

            grade:
              child.grade,
          }}
          options={
            (options ??
              []) as any
          }
          allowedWeekdays={
            settings.allowed_weekdays ??
            []
          }
          allowedTimeSlots={
            settings.allowed_time_slots ??
            []
          }
          allowedLessonsPerWeek={
            settings
              .allowed_lessons_per_week ??
            []
          }
          showEstimatedPrice={
            settings
              .show_estimated_price
          }
        />
      </main>
    </div>
  );
}

function InfoChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          "10px 14px",

        borderRadius:
          "10px",

        background:
          "rgba(255,255,255,0.82)",

        border:
          "1px solid #dce7f5",
      }}
    >
      <span
        style={{
          color:
            "var(--text-muted)",

          fontSize:
            "11px",

          fontWeight:
            700,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          marginLeft:
            "8px",

          color:
            "var(--talkly-navy)",

          fontSize:
            "13px",
        }}
      >
        {value}
      </strong>
    </div>
  );
}