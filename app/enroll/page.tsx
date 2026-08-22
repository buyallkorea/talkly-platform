import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function EnrollPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  /*
   * 비로그인
   *
   * 로그인 후 다시 /enroll로 돌아오게 합니다.
   */
  if (!user) {
    redirect(
      "/login?next=%2Fenroll"
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      name,
      role
    `)
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    redirect("/");
  }

  /*
   * 현재 TALKLY의 일반 수강신청 화면은
   * 학부모가 자녀를 선택한 뒤
   * 표준 수강상품을 고르는 구조입니다.
   */
  if (
    profile.role !== "parent"
  ) {
    return (
      <main
        style={{
          minHeight:
            "100vh",
          background:
            "#f7f9fc",
          padding:
            "54px 20px 90px",
        }}
      >
        <div
          style={{
            width:
              "min(760px, 100%)",
            margin:
              "0 auto",
          }}
        >
          <Link
            href="/"
            style={{
              color:
                "#667085",
              textDecoration:
                "none",
              fontSize:
                "13px",
              fontWeight:
                800,
            }}
          >
            ← TALKLY 홈
          </Link>

          <section
            style={{
              marginTop:
                "24px",
              padding:
                "34px",
              border:
                "1px solid #e4e7ec",
              borderRadius:
                "18px",
              background:
                "#ffffff",
              boxShadow:
                "0 16px 42px rgba(16,24,40,.06)",
            }}
          >
            <div
              style={{
                color:
                  "#2f6fed",
                fontSize:
                  "11px",
                fontWeight:
                  900,
                letterSpacing:
                  "0.08em",
              }}
            >
              ENROLLMENT
            </div>

            <h1
              style={{
                margin:
                  "8px 0 0",
                color:
                  "#101828",
                fontSize:
                  "30px",
                letterSpacing:
                  "-0.04em",
              }}
            >
              수강신청
            </h1>

            <p
              style={{
                margin:
                  "14px 0 0",
                color:
                  "#667085",
                fontSize:
                  "14px",
                lineHeight:
                  1.75,
              }}
            >
              현재 일반 수강신청은
              학부모 계정에서 자녀를
              선택한 뒤 진행하도록
              구성되어 있습니다.
            </p>

            <div
              style={{
                marginTop:
                  "24px",
                padding:
                  "18px",
                borderRadius:
                  "12px",
                background:
                  "#f8faff",
                border:
                  "1px solid #e5ebf5",
                color:
                  "#475467",
                fontSize:
                  "13px",
                lineHeight:
                  1.7,
              }}
            >
              대학생·성인 수강신청은
              별도의 맞춤 신청 방식으로
              연결할 예정입니다.
            </div>

            <Link
              href="/"
              style={{
                marginTop:
                  "24px",
                minHeight:
                  "44px",
                padding:
                  "0 18px",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius:
                  "999px",
                background:
                  "#2f6fed",
                color:
                  "#ffffff",
                textDecoration:
                  "none",
                fontSize:
                  "13px",
                fontWeight:
                  900,
              }}
            >
              TALKLY 홈으로 →
            </Link>
          </section>
        </div>
      </main>
    );
  }

  /*
   * 학부모의 활성 자녀 조회
   */
  const {
    data: children,
    error: childrenError,
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
    .eq(
      "is_active",
      true
    )
    .order(
      "created_at",
      {
        ascending:
          true,
      }
    );

  if (childrenError) {
    throw new Error(
      childrenError.message
    );
  }

  /*
   * 자녀가 1명뿐이면
   * 바로 해당 자녀 수강신청 페이지로 이동
   */
  if (
    children &&
    children.length === 1
  ) {
    redirect(
      `/parent/children/${children[0].id}/enrollment`
    );
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",
        background:
          "linear-gradient(180deg, #f4f8ff 0%, #ffffff 46%)",
        padding:
          "52px 20px 90px",
      }}
    >
      <div
        style={{
          width:
            "min(980px, 100%)",
          margin:
            "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            color:
              "#667085",
            textDecoration:
              "none",
            fontSize:
              "13px",
            fontWeight:
              800,
          }}
        >
          ← TALKLY 홈
        </Link>

        <div
          style={{
            marginTop:
              "26px",
          }}
        >
          <div
            style={{
              color:
                "#2f6fed",
              fontSize:
                "12px",
              fontWeight:
                900,
              letterSpacing:
                "0.08em",
            }}
          >
            TALKLY ENROLLMENT
          </div>

          <h1
            style={{
              margin:
                "9px 0 0",
              color:
                "#0a1f44",
              fontSize:
                "36px",
              lineHeight:
                1.25,
              letterSpacing:
                "-0.045em",
            }}
          >
            수강할 학생을
            선택해주세요.
          </h1>

          <p
            style={{
              margin:
                "14px 0 0",
              color:
                "#667085",
              fontSize:
                "14px",
              lineHeight:
                1.75,
            }}
          >
            학생을 선택하면
            학년·대상, 주당 수업
            횟수, 요일, 시간 조건에
            맞는 TALKLY 수강상품을
            확인할 수 있습니다.
          </p>
        </div>

        {(!children ||
          children.length ===
            0) ? (
          <section
            style={{
              marginTop:
                "32px",
              padding:
                "36px",
              border:
                "1px solid #e4e7ec",
              borderRadius:
                "18px",
              background:
                "#ffffff",
              boxShadow:
                "0 14px 36px rgba(16,24,40,.05)",
              textAlign:
                "center",
            }}
          >
            <div
              style={{
                width:
                  "54px",
                height:
                  "54px",
                margin:
                  "0 auto",
                borderRadius:
                  "50%",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                background:
                  "#eef4ff",
                color:
                  "#2f6fed",
                fontSize:
                  "25px",
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
                  "#101828",
                fontSize:
                  "22px",
              }}
            >
              등록된 자녀가
              없습니다.
            </h2>

            <p
              style={{
                margin:
                  "10px auto 0",
                maxWidth:
                  "500px",
                color:
                  "#667085",
                fontSize:
                  "14px",
                lineHeight:
                  1.75,
              }}
            >
              먼저 수강할 자녀의
              기본 정보를 등록해주세요.
              자녀 등록 후 바로
              수강신청을 진행할 수
              있습니다.
            </p>

            <Link
              href="/parent/children/new"
              style={{
                marginTop:
                  "24px",
                minHeight:
                  "46px",
                padding:
                  "0 22px",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius:
                  "999px",
                background:
                  "#2f6fed",
                color:
                  "#ffffff",
                textDecoration:
                  "none",
                fontSize:
                  "13px",
                fontWeight:
                  900,
                boxShadow:
                  "0 9px 22px rgba(47,111,237,.20)",
              }}
            >
              자녀 등록하기 →
            </Link>
          </section>
        ) : (
          <section
            style={{
              marginTop:
                "32px",
            }}
          >
            <div
              className="talkly-enroll-child-grid"
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0,1fr))",
                gap:
                  "18px",
              }}
            >
              {children.map(
                (child) => (
                  <Link
                    key={
                      child.id
                    }
                    href={`/parent/children/${child.id}/enrollment`}
                    style={{
                      display:
                        "block",
                      padding:
                        "26px",
                      border:
                        "1px solid #e4e7ec",
                      borderRadius:
                        "18px",
                      background:
                        "#ffffff",
                      color:
                        "inherit",
                      textDecoration:
                        "none",
                      boxShadow:
                        "0 12px 30px rgba(16,24,40,.05)",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap:
                          "16px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color:
                              "#98a2b3",
                            fontSize:
                              "11px",
                            fontWeight:
                              900,
                            letterSpacing:
                              "0.08em",
                          }}
                        >
                          STUDENT
                        </div>

                        <h2
                          style={{
                            margin:
                              "7px 0 0",
                            color:
                              "#101828",
                            fontSize:
                              "23px",
                          }}
                        >
                          {
                            child.name
                          }
                        </h2>
                      </div>

                      <span
                        style={{
                          minHeight:
                            "29px",
                          padding:
                            "0 11px",
                          display:
                            "inline-flex",
                          alignItems:
                            "center",
                          borderRadius:
                            "999px",
                          background:
                            "#eef4ff",
                          color:
                            "#2f6fed",
                          fontSize:
                            "11px",
                          fontWeight:
                            900,
                        }}
                      >
                        수강신청
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop:
                          "20px",
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(2, minmax(0,1fr))",
                        gap:
                          "10px",
                      }}
                    >
                      <Info
                        label="학년"
                        value={
                          child.grade ||
                          "-"
                        }
                      />

                      <Info
                        label="학교"
                        value={
                          child.school_name ||
                          "-"
                        }
                      />
                    </div>

                    {child.learning_goal && (
                      <div
                        style={{
                          marginTop:
                            "14px",
                          padding:
                            "13px 14px",
                          borderRadius:
                            "10px",
                          background:
                            "#f9fafb",
                          color:
                            "#667085",
                          fontSize:
                            "12px",
                          lineHeight:
                            1.65,
                        }}
                      >
                        {
                          child.learning_goal
                        }
                      </div>
                    )}

                    <div
                      style={{
                        marginTop:
                          "20px",
                        color:
                          "#2f6fed",
                        fontSize:
                          "13px",
                        fontWeight:
                          900,
                      }}
                    >
                      이 학생으로
                      신청하기 →
                    </div>
                  </Link>
                )
              )}
            </div>
          </section>
        )}
      </div>

      <style>{`
        @media (max-width: 680px) {
          .talkly-enroll-child-grid {
            grid-template-columns:
              1fr !important;
          }
        }
      `}</style>
    </main>
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
    <div
      style={{
        padding:
          "12px 13px",
        border:
          "1px solid #edf0f5",
        borderRadius:
          "10px",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          color:
            "#98a2b3",
          fontSize:
            "10px",
          fontWeight:
            800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          color:
            "#344054",
          fontSize:
            "13px",
          fontWeight:
            800,
        }}
      >
        {value}
      </div>
    </div>
  );
}