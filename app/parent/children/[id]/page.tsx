import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";
import DeactivateChildButton from "./DeactivateChildButton";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ChildDetailPage({
  params,
}: PageProps) {
  const { id } =
    await params;

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
  } = await supabase
    .from("profiles")
    .select(
      "role, name"
    )
    .eq(
      "id",
      user.id
    )
    .single();

  if (
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  const {
    data: child,
    error,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      birth_date,
      school_name,
      grade,
      learning_goal,
      is_active,
      created_at
    `)
    .eq(
      "id",
      id
    )
    .eq(
      "parent_user_id",
      user.id
    )
    .eq(
      "is_active",
      true
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!child) {
    notFound();
  }

  const menuCards = [
    {
      title:
        "수업",
      description:
        "전체 수업 일정과 회차별 수업 정보를 확인합니다.",
      href:
        `/parent/children/${child.id}/classes`,
      label:
        "CLASSES",
    },
    {
      title:
        "출결",
      description:
        "전체 출석 및 결석 기록을 확인합니다.",
      href:
        `/parent/children/${child.id}/attendance`,
      label:
        "ATTENDANCE",
    },
    {
      title:
        "학습 평가",
      description:
        "강사 평가와 AI 수업 분석을 회차별로 함께 확인합니다.",
      href:
        `/parent/children/${child.id}/evaluations`,
      label:
        "LEARNING REPORT",
    },
  ];

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
        userName={
          profile.name
        }
      />

      <main className="talkly-dashboard-main">
        <div
          style={{
            marginBottom:
              "20px",
          }}
        >
          <Link
            href="/parent/children"
            style={{
              color:
                "var(--talkly-blue)",
              textDecoration:
                "none",
              fontSize:
                "14px",
              fontWeight:
                800,
            }}
          >
            ← 자녀 목록
          </Link>
        </div>

        <section
          style={{
            position:
              "relative",
            overflow:
              "hidden",
            padding:
              "32px",
            borderRadius:
              "22px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f1f6ff 65%, #e8f1ff 100%)",
            border:
              "1px solid #e1e9f5",
            boxShadow:
              "var(--shadow-card)",
          }}
        >
          <div
            style={{
              position:
                "relative",
              zIndex:
                1,
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap:
                "24px",
              flexWrap:
                "wrap",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  "18px",
              }}
            >
              <div
                style={{
                  width:
                    "64px",
                  height:
                    "64px",
                  borderRadius:
                    "20px",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  background:
                    "var(--talkly-blue)",
                  color:
                    "#ffffff",
                  fontSize:
                    "27px",
                  fontWeight:
                    900,
                }}
              >
                {child.name.slice(
                  0,
                  1
                )}
              </div>

              <div>
                <div className="talkly-section-label">
                  STUDENT
                  PROFILE
                </div>

                <h1
                  className="talkly-dashboard-title"
                  style={{
                    marginTop:
                      "5px",
                  }}
                >
                  {child.name}
                </h1>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                    color:
                      "var(--text-secondary)",
                  }}
                >
                  자녀의 수업과
                  학습 정보를
                  관리합니다.
                </p>
              </div>
            </div>

            <Link
              href={`/parent/children/${child.id}/edit`}
              className="talkly-button talkly-button-secondary"
            >
              정보 수정
            </Link>
          </div>
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop:
              "24px",
            padding:
              "28px",
          }}
        >
          <div className="talkly-section-label">
            BASIC INFORMATION
          </div>

          <h2
            style={{
              margin:
                "5px 0 20px",
              color:
                "var(--talkly-navy)",
              fontSize:
                "23px",
            }}
          >
            기본 정보
          </h2>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap:
                "12px",
            }}
          >
            {[
              [
                "이름",
                child.name,
              ],
              [
                "생년월일",
                child.birth_date ||
                  "-",
              ],
              [
                "학교",
                child.school_name ||
                  "-",
              ],
              [
                "학년",
                child.grade ||
                  "-",
              ],
            ].map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={
                    label
                  }
                  style={{
                    padding:
                      "16px",
                    borderRadius:
                      "11px",
                    background:
                      "var(--talkly-blue-soft)",
                    border:
                      "1px solid #e5ecf6",
                  }}
                >
                  <div
                    style={{
                      color:
                        "var(--text-muted)",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                    }}
                  >
                    {
                      label
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "6px",
                      color:
                        "var(--talkly-navy)",
                      fontSize:
                        "15px",
                      fontWeight:
                        800,
                    }}
                  >
                    {
                      value
                    }
                  </div>
                </div>
              )
            )}
          </div>

          <div
            style={{
              marginTop:
                "12px",
              padding:
                "18px",
              borderRadius:
                "11px",
              background:
                "var(--talkly-blue-soft)",
              border:
                "1px solid #e5ecf6",
            }}
          >
            <div
              style={{
                color:
                  "var(--text-muted)",
                fontSize:
                  "12px",
                fontWeight:
                  700,
              }}
            >
              학습 목표
            </div>

            <div
              style={{
                marginTop:
                  "7px",
                color:
                  "var(--talkly-navy)",
                fontSize:
                  "15px",
                fontWeight:
                  700,
                lineHeight:
                  1.7,
                whiteSpace:
                  "pre-wrap",
              }}
            >
              {child.learning_goal ||
                "-"}
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop:
              "28px",
          }}
        >
          <div className="talkly-section-label">
            LEARNING MANAGEMENT
          </div>

          <h2
            style={{
              margin:
                "5px 0 16px",
              color:
                "var(--talkly-navy)",
              fontSize:
                "24px",
            }}
          >
            학습 관리
          </h2>

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(230px, 1fr))",
              gap:
                "16px",
            }}
          >
            {menuCards.map(
              (item) => (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className="talkly-card talkly-card-hover"
                  style={{
                    display:
                      "block",
                    padding:
                      "24px",
                    textDecoration:
                      "none",
                    color:
                      "inherit",
                  }}
                >
                  <div
                    style={{
                      color:
                        "var(--talkly-blue)",
                      fontSize:
                        "11px",
                      fontWeight:
                        900,
                      letterSpacing:
                        "0.08em",
                    }}
                  >
                    {
                      item.label
                    }
                  </div>

                  <h3
                    style={{
                      margin:
                        "9px 0 0",
                      color:
                        "var(--talkly-navy)",
                      fontSize:
                        "20px",
                    }}
                  >
                    {
                      item.title
                    }
                  </h3>

                  <p
                    style={{
                      margin:
                        "9px 0 0",
                      color:
                        "var(--text-muted)",
                      fontSize:
                        "14px",
                      lineHeight:
                        1.65,
                    }}
                  >
                    {
                      item.description
                    }
                  </p>

                  <div
                    style={{
                      marginTop:
                        "20px",
                      color:
                        "var(--talkly-blue)",
                      fontSize:
                        "14px",
                      fontWeight:
                        900,
                    }}
                  >
                    확인하기 →
                  </div>
                </Link>
              )
            )}

            <div
              className="talkly-card"
              style={{
                padding:
                  "24px",
                opacity:
                  0.72,
              }}
            >
              <div
                style={{
                  color:
                    "var(--text-muted)",
                  fontSize:
                    "11px",
                  fontWeight:
                    900,
                  letterSpacing:
                    "0.08em",
                }}
              >
                LEVEL
              </div>

              <h3
                style={{
                  margin:
                    "9px 0 0",
                  color:
                    "var(--talkly-navy)",
                  fontSize:
                    "20px",
                }}
              >
                레벨
              </h3>

              <p
                style={{
                  margin:
                    "9px 0 0",
                  color:
                    "var(--text-muted)",
                  fontSize:
                    "14px",
                  lineHeight:
                    1.65,
                }}
              >
                학습 레벨 및
                레벨 변화 기능을
                준비하고 있습니다.
              </p>

              <span
                className="talkly-badge"
                style={{
                  display:
                    "inline-flex",
                  marginTop:
                    "20px",
                }}
              >
                준비 중
              </span>
            </div>
          </div>
        </section>

        <section
          className="talkly-card"
          style={{
            marginTop:
              "32px",
            padding:
              "26px",
            border:
              "1px solid #eadfe0",
            background:
              "#fffafa",
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap:
                "22px",
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color:
                    "#9c5555",
                  fontSize:
                    "11px",
                  fontWeight:
                    900,
                }}
              >
                CHILD
                REGISTRATION
              </div>

              <h3
                style={{
                  margin:
                    "6px 0 0",
                  color:
                    "var(--talkly-navy)",
                }}
              >
                자녀 등록 관리
              </h3>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  color:
                    "var(--text-muted)",
                }}
              >
                등록을 해제해도
                기존 수업 및 학습
                기록은 삭제되지
                않습니다.
              </p>
            </div>

            <DeactivateChildButton
              childId={
                child.id
              }
            />
          </div>
        </section>
      </main>
    </div>
  );
}