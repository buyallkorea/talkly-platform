import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";

export default async function ChildrenPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "parent") {
    redirect("/");
  }

  const { data: children, error } = await supabase
    .from("children")
    .select(`
      id,
      name,
      birth_date,
      school_name,
      grade,
      learning_goal,
      created_at
    `)
    .eq("parent_user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
        userName={profile.name}
      />

      <main className="talkly-dashboard-main">
        <div
          style={{
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/parent"
            style={{
              color: "var(--talkly-blue)",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            ← 학부모 대시보드
          </Link>
        </div>

        <section
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "34px 36px",
            borderRadius: "22px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f1f6ff 58%, #e8f1ff 100%)",
            border: "1px solid #e1e9f5",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: "680px" }}>
              <div className="talkly-eyebrow">
                MY CHILDREN
              </div>

              <h1
                className="talkly-dashboard-title"
                style={{ marginTop: "6px" }}
              >
                자녀 관리
              </h1>

              <p
                style={{
                  margin: "10px 0 0",
                  color: "var(--text-secondary)",
                  fontSize: "16px",
                  lineHeight: 1.75,
                }}
              >
                자녀 정보를 등록하고 수업, 출결, 학습평가까지
                한 곳에서 관리하세요.
              </p>
            </div>

            <Link
              href="/parent/children/new"
              className="talkly-button talkly-button-primary"
            >
              + 자녀 등록
            </Link>
          </div>

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "-55px",
              bottom: "-95px",
              width: "270px",
              height: "270px",
              borderRadius: "50%",
              background: "rgba(63, 117, 220, 0.09)",
            }}
          />

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "120px",
              top: "-70px",
              width: "160px",
              height: "160px",
              borderRadius: "50%",
              border: "1px solid rgba(63,117,220,0.10)",
            }}
          />
        </section>

        <section
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              등록 자녀
            </div>

            <div className="talkly-stat-value">
              {children?.length ?? 0}명
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              현재 활성화된 자녀
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              학습관리
            </div>

            <div
              className="talkly-stat-value"
              style={{ fontSize: "24px" }}
            >
              수업 · 출결 · 평가
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              자녀별 학습정보 확인
            </div>
          </div>
        </section>

        {!children || children.length === 0 ? (
          <section
            className="talkly-card"
            style={{
              marginTop: "28px",
              padding: "36px",
              background:
                "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
            }}
          >
            <div
              style={{
                width: "58px",
                height: "58px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "18px",
                background: "var(--talkly-blue-light)",
                color: "var(--talkly-blue)",
                fontSize: "26px",
                fontWeight: 900,
              }}
            >
              +
            </div>

            <h2
              style={{
                margin: "18px 0 0",
                color: "var(--talkly-navy)",
                fontSize: "24px",
              }}
            >
              등록된 자녀가 없습니다.
            </h2>

            <p
              style={{
                margin: "10px 0 22px",
                color: "var(--text-muted)",
                lineHeight: 1.7,
              }}
            >
              자녀를 등록하면 수업 일정, 출결, 학습평가를
              한 곳에서 관리할 수 있습니다.
            </p>

            <Link
              href="/parent/children/new"
              className="talkly-button talkly-button-primary"
            >
              첫 자녀 등록하기
            </Link>
          </section>
        ) : (
          <section
            style={{
              marginTop: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: "16px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="talkly-section-label">
                  CHILD PROFILES
                </div>

                <h2
                  style={{
                    margin: "5px 0 0",
                    color: "var(--talkly-navy)",
                    fontSize: "25px",
                  }}
                >
                  등록 자녀
                </h2>
              </div>

              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                총 {children.length}명
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "18px",
              }}
            >
              {children.map((child) => (
                <Link
                  key={child.id}
                  href={`/parent/children/${child.id}`}
                  className="talkly-card talkly-card-hover"
                  style={{
                    display: "block",
                    padding: "26px",
                    textDecoration: "none",
                    color: "inherit",
                    background:
                      "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        width: "54px",
                        height: "54px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "17px",
                        background:
                          "linear-gradient(145deg, #eaf2ff 0%, #dce9ff 100%)",
                        color: "var(--talkly-blue)",
                        fontSize: "22px",
                        fontWeight: 900,
                        flexShrink: 0,
                        border: "1px solid #dfe9f6",
                      }}
                    >
                      {child.name.slice(0, 1)}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          margin: 0,
                          color: "var(--talkly-navy)",
                          fontSize: "22px",
                        }}
                      >
                        {child.name}
                      </h3>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "var(--text-muted)",
                          fontSize: "13px",
                        }}
                      >
                        자녀 학습정보
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "22px",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {[
                      ["생년월일", child.birth_date || "-"],
                      ["학교", child.school_name || "-"],
                      ["학년", child.grade || "-"],
                      ["학습 목표", child.learning_goal || "-"],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        style={{
                          padding: "14px",
                          borderRadius: "11px",
                          background: "var(--talkly-blue-soft)",
                          border: "1px solid #e7edf5",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "11px",
                            fontWeight: 800,
                          }}
                        >
                          {label}
                        </div>

                        <div
                          style={{
                            marginTop: "5px",
                            color: "var(--talkly-navy)",
                            fontSize: "14px",
                            fontWeight: 800,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={String(value)}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      marginTop: "22px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      paddingTop: "18px",
                      borderTop: "1px solid var(--border-light)",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "13px",
                      }}
                    >
                      수업 · 출결 · 학습평가 관리
                    </span>

                    <span
                      style={{
                        color: "var(--talkly-blue)",
                        fontWeight: 900,
                        fontSize: "14px",
                      }}
                    >
                      상세보기 →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <style>{`
        @media (max-width: 560px) {
          .talkly-dashboard-main {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}