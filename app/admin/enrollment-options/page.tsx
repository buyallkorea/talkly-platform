import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

const TARGET_LABELS: Record<string, string> = {
  age_5_7_phonics: "5~7세 파닉스",

  elementary_1: "초등 1학년",
  elementary_2: "초등 2학년",
  elementary_3: "초등 3학년",
  elementary_4: "초등 4학년",
  elementary_5: "초등 5학년",
  elementary_6: "초등 6학년",

  middle_1: "중등 1학년",
  middle_2: "중등 2학년",
  middle_3: "중등 3학년",

  high_1: "고등 1학년",
  high_2: "고등 2학년",
  high_3: "고등 3학년",

  university: "대학생",
  adult: "성인",
  senior: "실버",
};

const DAY_LABELS: Record<string, string> = {
  Monday: "월",
  Tuesday: "화",
  Wednesday: "수",
  Thursday: "목",
  Friday: "금",
  Saturday: "토",
  Sunday: "일",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatSchedule(
  days: string[] | null,
  times: Record<string, string> | null
) {
  if (!days || days.length === 0) {
    return "-";
  }

  return days
    .map((day) => {
      const label = DAY_LABELS[day] ?? day;
      const time = times?.[day];

      return time
        ? `${label} ${time}`
        : label;
    })
    .join(" · ");
}

export default async function EnrollmentOptionsPage() {
  const supabase = await createClient();

  /*
   * 관리자 권한 확인
   */
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
   * 표준 수강 가능 일정 조회
   */
  const {
    data: options,
    error,
  } = await supabase
    .from("enrollment_options")
    .select(`
      id,
      title,
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
      estimated_price,
      capacity,
      enrolled_count,
      is_published,
      is_open,
      created_at,
      courses (
        id,
        name
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px",
      }}
    >
      {/* 상단 */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
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
              opacity: 0.65,
            }}
          >
            ← 관리자 대시보드
          </Link>

          <h1
            style={{
              margin: "14px 0 0",
              fontSize: "32px",
              letterSpacing: "-0.03em",
            }}
          >
            수강 가능 일정 관리
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.6,
              lineHeight: 1.7,
            }}
          >
            학생과 학부모에게 공개할 표준 수업 일정을
            생성하고 관리합니다.
          </p>
        </div>

        <Link
          href="/admin/enrollment-options/new"
          style={{
            minHeight: "44px",
            padding: "0 18px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            background: "#2f6fed",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 900,
          }}
        >
          + 새 일정 만들기
        </Link>
      </div>

      {/* 구조 안내 */}

      <div
        style={{
          marginTop: "28px",
          padding: "18px",
          borderRadius: "12px",
          border:
            "1px solid rgba(47,111,237,0.28)",
          background:
            "rgba(47,111,237,0.07)",
          fontSize: "13px",
          lineHeight: 1.8,
        }}
      >
        <strong>표준 수강 일정</strong>
        <br />
        여기서 만든 일정은 학생·학부모가
        수강신청할 때 선택할 수 있는 공개 수업
        후보가 됩니다.
        <br />
        특정 학생만을 위한 별도 요일·시간 수업은
        기존의 <strong>개별 맞춤 수강 등록</strong>을
        사용합니다.
      </div>

      {/* 일정 목록 */}

      <section
        style={{
          marginTop: "24px",
          border:
            "1px solid rgba(255,255,255,0.14)",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom:
              "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <strong>
            등록된 수강 가능 일정
          </strong>

          <span
            style={{
              marginLeft: "8px",
              fontSize: "12px",
              opacity: 0.5,
            }}
          >
            {options?.length ?? 0}개
          </span>
        </div>

        {!options || options.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              opacity: 0.55,
            }}
          >
            아직 등록된 수강 가능 일정이 없습니다.
            <br />
            <br />
            <Link
              href="/admin/enrollment-options/new"
              style={{
                color: "#8fb4ff",
                fontWeight: 800,
              }}
            >
              첫 번째 일정 만들기 →
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            {options.map((option) => {
              const courseRelation =
                option.courses as unknown as
                  | {
                      id?: number | null;
                      name?: string | null;
                    }
                  | Array<{
                      id?: number | null;
                      name?: string | null;
                    }>
                  | null;

              const courseName =
                Array.isArray(courseRelation)
                  ? courseRelation[0]?.name ?? "-"
                  : courseRelation?.name ?? "-";

              const capacityText =
                option.capacity === null
                  ? "정원 제한 없음"
                  : `${option.enrolled_count}/${option.capacity}명`;

              return (
                <div
                  key={option.id}
                  style={{
                    padding: "20px",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "20px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        flex: "1 1 600px",
                      }}
                    >
                      {/* 상태 */}

                      <div
                        style={{
                          display: "flex",
                          gap: "7px",
                          flexWrap: "wrap",
                          marginBottom: "10px",
                        }}
                      >
                        <Badge>
                          {TARGET_LABELS[
                            option.target_group
                          ] ??
                            option.target_group}
                        </Badge>

                        <Badge>
                          {option.lesson_duration_minutes}
                          분
                        </Badge>

                        <Badge>
                          주 {option.lessons_per_week}회
                        </Badge>

                        {option.is_published ? (
                          <Badge variant="success">
                            공개
                          </Badge>
                        ) : (
                          <Badge variant="muted">
                            비공개
                          </Badge>
                        )}

                        {option.is_open ? (
                          <Badge variant="success">
                            신청 가능
                          </Badge>
                        ) : (
                          <Badge variant="danger">
                            신청 마감
                          </Badge>
                        )}
                      </div>

                      <h2
                        style={{
                          margin: 0,
                          fontSize: "19px",
                        }}
                      >
                        {option.title}
                      </h2>

                      <div
                        style={{
                          marginTop: "6px",
                          fontSize: "13px",
                          opacity: 0.58,
                        }}
                      >
                        {courseName ??
                          "과정 정보 없음"}
                      </div>

                      {/* 일정 정보 */}

                      <div
                        style={{
                          marginTop: "16px",
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: "12px",
                        }}
                      >
                        <Info
                          label="수업 일정"
                          value={formatSchedule(
                            option.preferred_days,
                            option.preferred_times
                          )}
                        />

                        <Info
                          label="수강기간"
                          value={`${option.start_date} ~ ${option.end_date}`}
                        />

                        <Info
                          label="기간 / 회차"
                          value={`${option.course_weeks}주 · 총 ${option.total_lessons}회`}
                        />

                        <Info
                          label="신청 현황"
                          value={capacityText}
                        />
                      </div>

                      {/* 가격 */}

                      <div
                        style={{
                          marginTop: "16px",
                          display: "flex",
                          gap: "18px",
                          flexWrap: "wrap",
                          fontSize: "13px",
                        }}
                      >
                        <span>
                          회당{" "}
                          <strong>
                            {formatMoney(
                              option.price_per_lesson
                            )}
                            원
                          </strong>
                        </span>

                        <span>
                          주말{" "}
                          <strong>
                            ×{" "}
                            {Number(
                              option.weekend_multiplier
                            )}
                          </strong>
                        </span>

                        <span>
                          예상 총액{" "}
                          <strong
                            style={{
                              color: "#8fb4ff",
                            }}
                          >
                            {formatMoney(
                              option.estimated_price
                            )}
                            원
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* 관리 버튼 */}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                      }}
                    >
                      <Link
                        href={`/admin/enrollment-options/${option.id}`}
                        style={{
                          minHeight: "40px",
                          padding: "0 14px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border:
                            "1px solid rgba(255,255,255,0.16)",
                          borderRadius: "9px",
                          color: "inherit",
                          textDecoration: "none",
                          fontSize: "13px",
                          fontWeight: 800,
                        }}
                      >
                        관리 →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div
        style={{
          marginTop: "20px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin/enrollments/new"
          style={secondaryLinkStyle}
        >
          개별 맞춤 수강 등록
        </Link>

        <Link
          href="/admin/enrollment-settings"
          style={secondaryLinkStyle}
        >
          수강신청 설정
        </Link>

        <Link
          href="/admin/enrollments"
          style={secondaryLinkStyle}
        >
          전체 수강 관리
        </Link>
      </div>
    </main>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?:
    | "default"
    | "success"
    | "danger"
    | "muted";
}) {
  let background =
    "rgba(47,111,237,0.13)";

  let color = "#9dbbff";

  if (variant === "success") {
    background =
      "rgba(46,160,67,0.13)";
    color = "#86e29d";
  }

  if (variant === "danger") {
    background =
      "rgba(217,48,37,0.12)";
    color = "#ff9d95";
  }

  if (variant === "muted") {
    background =
      "rgba(255,255,255,0.07)";
    color = "rgba(255,255,255,0.65)";
  }

  return (
    <span
      style={{
        padding: "5px 8px",
        borderRadius: "999px",
        background,
        color,
        fontSize: "11px",
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function Info({
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
          fontSize: "11px",
          opacity: 0.45,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontSize: "13px",
          fontWeight: 700,
          lineHeight: 1.55,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const secondaryLinkStyle = {
  minHeight: "40px",
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border:
    "1px solid rgba(255,255,255,0.14)",
  borderRadius: "9px",
  color: "inherit",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 700,
};