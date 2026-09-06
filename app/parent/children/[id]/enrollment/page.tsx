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

  searchParams: Promise<{
    levelTestId?: string;
  }>;
};

type RecommendedCourse = {
  id: number;
  name: string;
} | null;

export default async function ParentChildEnrollmentPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const resolvedSearchParams =
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
   * 4. 레벨테스트 추천 과정 확인
   *
   * URL에 levelTestId가 있을 때만 동작합니다.
   *
   * 반드시 확인할 조건:
   * - 현재 로그인 학부모의 테스트
   * - 현재 자녀의 테스트
   * - status = completed
   * - final_level 존재
   * - final_course_id 존재
   *
   * URL에 courseId 자체를 넘기지 않고
   * levelTestId를 기준으로 서버에서 다시 확인합니다.
   * -------------------------------------------------------
   */
  let levelTestId:
    number | null = null;

  let recommendedCourse:
    RecommendedCourse = null;

  let recommendedLevel:
    string | null = null;

  if (
    resolvedSearchParams.levelTestId
  ) {
    const parsedLevelTestId =
      Number(
        resolvedSearchParams.levelTestId
      );

    if (
      Number.isInteger(
        parsedLevelTestId
      ) &&
      parsedLevelTestId > 0
    ) {
      const {
        data: levelTest,
        error: levelTestError,
      } = await supabase
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
          parsedLevelTestId
        )
        .eq(
          "parent_user_id",
          user.id
        )
        .eq(
          "child_id",
          childId
        )
        .maybeSingle();

      if (levelTestError) {
        throw new Error(
          `레벨테스트 추천정보 조회 실패: ${levelTestError.message}`
        );
      }

      if (
        levelTest &&
        levelTest.status ===
          "completed" &&
        levelTest.final_level &&
        levelTest.final_course_id
      ) {
        const {
          data: course,
          error: courseError,
        } = await supabase
          .from("courses")
          .select(`
            id,
            name
          `)
          .eq(
            "id",
            levelTest.final_course_id
          )
          .maybeSingle();

        if (courseError) {
          throw new Error(
            `추천 프로그램 조회 실패: ${courseError.message}`
          );
        }

        if (course) {
          levelTestId =
            levelTest.id;

          recommendedLevel =
            levelTest.final_level;

          recommendedCourse = {
            id:
              course.id,
            name:
              course.name,
          };
        }
      }
    }
  }

  /*
   * -------------------------------------------------------
   * 5. 수강신청 기본 설정 조회
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
   * 6. 관리자가 학부모 자가 수강신청을 OFF한 경우
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
   * 7. 공개 + 신청 가능한 표준 수강 일정 조회
   *
   * 여기서는 모든 공개 일정을 읽습니다.
   * 추천 course_id 필터는 Client selector에서 처리합니다.
   *
   * 이유:
   * 학부모가 "다른 과정도 보기"를 선택했을 때
   * 다시 서버 요청 없이 기존 전체 선택 구조로
   * 전환할 수 있게 하기 위함입니다.
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
   * 8. 화면
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
          href={
            levelTestId
              ? `/parent/level-tests/${levelTestId}`
              : `/parent/children/${child.id}`
          }
          style={{
            color:
              "var(--talkly-blue)",
            textDecoration:
              "none",
            fontWeight: 800,
            fontSize: "14px",
          }}
        >
          {levelTestId
            ? "← 레벨테스트 결과"
            : "← 자녀 상세"}
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
            {recommendedCourse
              ? "레벨테스트 결과를 기준으로 추천 프로그램의 신청 가능한 일정을 먼저 보여드립니다. 주당 수업 횟수, 요일과 시간을 선택해 원하는 일정을 찾을 수 있습니다."
              : "학년, 주당 수업 횟수, 요일과 시간을 선택하면 조건에 맞는 TALKLY 수업 일정을 찾아드립니다."}
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

          {/* 레벨테스트 추천 정보 */}

          {recommendedCourse && (
            <div
              style={{
                marginTop: "24px",
                padding:
                  "18px 20px",
                border:
                  "1px solid #abefc6",
                borderRadius:
                  "14px",
                background:
                  "#ecfdf3",
              }}
            >
              <div
                style={{
                  color:
                    "#067647",
                  fontSize:
                    "11px",
                  fontWeight:
                    900,
                  letterSpacing:
                    "0.06em",
                }}
              >
                LEVEL TEST RECOMMENDATION
              </div>

              <div
                style={{
                  marginTop:
                    "8px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap:
                    "16px",
                  flexWrap:
                    "wrap",
                }}
              >
                {recommendedLevel && (
                  <div>
                    <div
                      style={{
                        color:
                          "#047857",
                        fontSize:
                          "11px",
                        fontWeight:
                          700,
                      }}
                    >
                      최종 레벨
                    </div>

                    <strong
                      style={{
                        display:
                          "block",
                        marginTop:
                          "4px",
                        color:
                          "#065f46",
                        fontSize:
                          "18px",
                      }}
                    >
                      {recommendedLevel}
                    </strong>
                  </div>
                )}

                <div>
                  <div
                    style={{
                      color:
                        "#047857",
                      fontSize:
                        "11px",
                      fontWeight:
                        700,
                    }}
                  >
                    추천 프로그램
                  </div>

                  <strong
                    style={{
                      display:
                        "block",
                      marginTop:
                        "4px",
                      color:
                        "#065f46",
                      fontSize:
                        "18px",
                    }}
                  >
                    {recommendedCourse.name}
                  </strong>
                </div>
              </div>
            </div>
          )}
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
          recommendedCourse={
            recommendedCourse
          }
          recommendedLevel={
            recommendedLevel
          }
          levelTestId={
            levelTestId
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