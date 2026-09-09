import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import TalklyUserHeader from "@/components/TalklyUserHeader";
import EnrollmentProgressCard from "@/components/parent/EnrollmentProgressCard";
import {
  getEnrollmentProgress,
  type EnrollmentProgressResult,
} from "@/lib/parent/get-enrollment-progress";

export default async function ChildrenPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "parent"
  ) {
    redirect("/");
  }

  const {
    data: children,
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
      created_at
    `)
    .eq(
      "parent_user_id",
      user.id
    )
    .eq("is_active", true)
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      error.message
    );
  }

  /*
   * =========================================================
   * 자녀별 수강 진행 현황
   *
   * 레벨테스트
   * → 수강신청
   * → 일정배정
   * → 결제
   * → 수강시작
   * =========================================================
   */
  let enrollmentProgresses:
    EnrollmentProgressResult[] =
    [];

  if (
    children &&
    children.length > 0
  ) {
    const progressResults =
      await Promise.all(
        children.map(
          (child) =>
            getEnrollmentProgress({
              parentUserId:
                user.id,
              childId:
                child.id,
            })
        )
      );

    enrollmentProgresses =
      progressResults.filter(
        (
          progress
        ): progress is EnrollmentProgressResult =>
          progress !== null
      );
  }

  /*
   * 자녀 ID별로 진행현황을 빠르게 찾기 위한 Map
   */
  const progressByChildId =
    new Map(
      enrollmentProgresses.map(
        (progress) => [
          progress.childId,
          progress,
        ]
      )
    );

  return (
    <div className="talkly-dashboard">
      <TalklyUserHeader
        role="parent"
        userName={
          profile.name
        }
      />

      <main className="talkly-dashboard-main">
        {/* ==============================
            뒤로가기
        ============================== */}

        <div
          style={{
            marginBottom:
              "18px",
            display:
              "flex",
            alignItems:
              "center",
            gap: "14px",
            flexWrap:
              "wrap",
          }}
        >
          <Link
            href="/parent"
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
            ← 학부모 대시보드
          </Link>
        </div>

        {/* ==============================
            Hero
        ============================== */}

        <section
          style={{
            position:
              "relative",
            overflow:
              "hidden",
            padding:
              "34px 36px",
            borderRadius:
              "22px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f1f6ff 58%, #e8f1ff 100%)",
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
              zIndex: 1,
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: "24px",
              flexWrap:
                "wrap",
            }}
          >
            <div
              style={{
                maxWidth:
                  "680px",
              }}
            >
              <div className="talkly-eyebrow">
                MY CHILDREN
              </div>

              <h1
                className="talkly-dashboard-title"
                style={{
                  marginTop:
                    "6px",
                }}
              >
                자녀 관리
              </h1>

              <p
                style={{
                  margin:
                    "10px 0 0",
                  color:
                    "var(--text-secondary)",
                  fontSize:
                    "16px",
                  lineHeight:
                    1.75,
                }}
              >
                자녀 정보를 등록하고
                수업, 출결,
                학습평가와 수강
                진행상황까지 한 곳에서
                관리하세요.
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
              position:
                "absolute",
              right:
                "-55px",
              bottom:
                "-95px",
              width:
                "270px",
              height:
                "270px",
              borderRadius:
                "50%",
              background:
                "rgba(63, 117, 220, 0.09)",
            }}
          />

          <div
            aria-hidden="true"
            style={{
              position:
                "absolute",
              right:
                "120px",
              top: "-70px",
              width:
                "160px",
              height:
                "160px",
              borderRadius:
                "50%",
              border:
                "1px solid rgba(63,117,220,0.10)",
            }}
          />
        </section>

        {/* ==============================
            요약
        ============================== */}

        <section
          style={{
            marginTop:
              "22px",
            display:
              "grid",
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
              {children?.length ??
                0}
              명
            </div>

            <div
              style={{
                marginTop:
                  "6px",
                color:
                  "var(--text-muted)",
                fontSize:
                  "13px",
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
              style={{
                fontSize:
                  "24px",
              }}
            >
              수업 · 출결 · 평가
            </div>

            <div
              style={{
                marginTop:
                  "6px",
                color:
                  "var(--text-muted)",
                fontSize:
                  "13px",
              }}
            >
              자녀별 학습정보 확인
            </div>
          </div>

          <div className="talkly-card talkly-stat-card">
            <div className="talkly-stat-label">
              수강관리
            </div>

            <div
              className="talkly-stat-value"
              style={{
                fontSize:
                  "24px",
              }}
            >
              신청 · 배정 · 결제
            </div>

            <div
              style={{
                marginTop:
                  "6px",
                color:
                  "var(--text-muted)",
                fontSize:
                  "13px",
              }}
            >
              자녀별 진행상태 확인
            </div>
          </div>
        </section>

        {/* ==============================
            자녀 없음
        ============================== */}

        {!children ||
        children.length === 0 ? (
          <section
            className="talkly-card"
            style={{
              marginTop:
                "28px",
              padding:
                "36px",
              background:
                "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
            }}
          >
            <div
              style={{
                width:
                  "58px",
                height:
                  "58px",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius:
                  "18px",
                background:
                  "var(--talkly-blue-light)",
                color:
                  "var(--talkly-blue)",
                fontSize:
                  "26px",
                fontWeight:
                  900,
              }}
            >
              +
            </div>

            <h2
              style={{
                margin:
                  "18px 0 0",
                color:
                  "var(--talkly-navy)",
                fontSize:
                  "24px",
              }}
            >
              등록된 자녀가
              없습니다.
            </h2>

            <p
              style={{
                margin:
                  "10px 0 22px",
                color:
                  "var(--text-muted)",
                lineHeight:
                  1.7,
              }}
            >
              자녀를 등록하면 수업
              일정, 출결, 학습평가와
              수강 진행현황을 한 곳에서
              관리할 수 있습니다.
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
              marginTop:
                "28px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-end",
                gap: "16px",
                marginBottom:
                  "16px",
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <div className="talkly-section-label">
                  CHILD PROFILES
                </div>

                <h2
                  style={{
                    margin:
                      "5px 0 0",
                    color:
                      "var(--talkly-navy)",
                    fontSize:
                      "25px",
                  }}
                >
                  등록 자녀
                </h2>
              </div>

              <div
                style={{
                  color:
                    "var(--text-muted)",
                  fontSize:
                    "13px",
                  fontWeight:
                    700,
                }}
              >
                총{" "}
                {children.length}
                명
              </div>
            </div>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "18px",
              }}
            >
              {children.map(
                (child) => {
                  const progress =
                    progressByChildId.get(
                      child.id
                    ) ??
                    null;

                  return (
                    <article
                      key={
                        child.id
                      }
                      className="talkly-card talkly-card-hover"
                      style={{
                        padding:
                          "26px",
                        background:
                          "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
                      }}
                    >
                      {/* 학생 기본정보 */}

                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "14px",
                        }}
                      >
                        <div
                          style={{
                            width:
                              "54px",
                            height:
                              "54px",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            borderRadius:
                              "17px",
                            background:
                              "linear-gradient(145deg, #eaf2ff 0%, #dce9ff 100%)",
                            color:
                              "var(--talkly-blue)",
                            fontSize:
                              "22px",
                            fontWeight:
                              900,
                            flexShrink: 0,
                            border:
                              "1px solid #dfe9f6",
                          }}
                        >
                          {child.name.slice(
                            0,
                            1
                          )}
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <h3
                            style={{
                              margin: 0,
                              color:
                                "var(--talkly-navy)",
                              fontSize:
                                "22px",
                            }}
                          >
                            {
                              child.name
                            }
                          </h3>

                          <div
                            style={{
                              marginTop:
                                "4px",
                              color:
                                "var(--text-muted)",
                              fontSize:
                                "13px",
                            }}
                          >
                            자녀 학습정보
                          </div>
                        </div>

                        {progress ? (
                          <span
                            style={{
                              display:
                                "inline-flex",
                              alignItems:
                                "center",
                              padding:
                                "7px 11px",
                              borderRadius:
                                "999px",
                              background:
                                progress.paymentCompleted
                                  ? "#ecfdf3"
                                  : progress.stageStatus ===
                                      "waiting"
                                    ? "#fff7ed"
                                    : "#eff6ff",
                              color:
                                progress.paymentCompleted
                                  ? "#047857"
                                  : progress.stageStatus ===
                                      "waiting"
                                    ? "#b45309"
                                    : "#1d4ed8",
                              fontSize:
                                "12px",
                              fontWeight:
                                900,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              progress.badgeLabel
                            }
                          </span>
                        ) : null}
                      </div>

                      {/* 기본 정보 */}

                      <div
                        style={{
                          marginTop:
                            "22px",
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(2, minmax(0, 1fr))",
                          gap: "10px",
                        }}
                      >
                        {[
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
                          [
                            "학습 목표",
                            child.learning_goal ||
                              "-",
                          ],
                        ].map(
                          ([
                            label,
                            value,
                          ]) => (
                            <div
                              key={String(
                                label
                              )}
                              style={{
                                padding:
                                  "14px",
                                borderRadius:
                                  "11px",
                                background:
                                  "var(--talkly-blue-soft)",
                                border:
                                  "1px solid #e7edf5",
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  color:
                                    "var(--text-muted)",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    800,
                                }}
                              >
                                {
                                  label
                                }
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    "5px",
                                  color:
                                    "var(--talkly-navy)",
                                  fontSize:
                                    "14px",
                                  fontWeight:
                                    800,
                                  overflow:
                                    "hidden",
                                  textOverflow:
                                    "ellipsis",
                                  whiteSpace:
                                    "nowrap",
                                }}
                                title={String(
                                  value
                                )}
                              >
                                {
                                  value
                                }
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      {/* 수강 진행 상태 */}

                      {progress ? (
                        <div
                          style={{
                            marginTop:
                              "18px",
                          }}
                        >
                          <EnrollmentProgressCard
                            progress={
                              progress
                            }
                            compact
                          />
                        </div>
                      ) : null}

                      {/* 자녀 상세 */}

                      <div
                        style={{
                          marginTop:
                            "18px",
                          paddingTop:
                            "18px",
                          borderTop:
                            "1px solid var(--border-light)",
                          display:
                            "flex",
                          justifyContent:
                            "flex-end",
                        }}
                      >
                        <Link
                          href={`/parent/children/${child.id}`}
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            color:
                              "var(--talkly-blue)",
                            textDecoration:
                              "none",
                            fontSize:
                              "14px",
                            fontWeight:
                              900,
                          }}
                        >
                          자녀 상세보기
                          &nbsp;→
                        </Link>
                      </div>
                    </article>
                  );
                }
              )}
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