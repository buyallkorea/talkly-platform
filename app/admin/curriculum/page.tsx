import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

type CurriculumLevel = {
  id: number;
  code: string;
  name: string;
  display_name: string | null;
  target_group: string | null;
  description: string | null;
  cefr_level: string | null;
  lexile_range: string | null;
  ar_level: string | null;
  us_grade: string | null;
  sort_order: number | null;
  is_active: boolean;
};

type CurriculumLevelTextbook = {
  id: number;
  curriculum_level_id: number;
  textbook_id: number;
  category: string | null;
  is_primary: boolean;
  sort_order: number | null;
  is_active: boolean;
};

type Textbook = {
  id: number;
  title: string;
  publisher: string | null;
  category: string | null;
  status: string | null;
  is_active: boolean;
  sale_price: number | null;
  is_for_sale: boolean;
};

const CATEGORY_ORDER = [
  "course_book",
  "phonics",
  "reading",
  "speaking",
  "writing",
  "grammar",
  "vocabulary",
  "adult",
];

const CATEGORY_LABELS: Record<
  string,
  string
> = {
  course_book: "COURSE BOOK",
  phonics: "PHONICS",
  reading: "READING",
  speaking: "SPEAKING",
  writing: "WRITING",
  grammar: "GRAMMAR",
  vocabulary: "VOCA",
  adult: "ADULT",
};

function formatPrice(
  value: number | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return `${value.toLocaleString(
    "ko-KR"
  )}원`;
}

export default async function AdminCurriculumPage() {
  /*
   * 1. 로그인 / 관리자 권한 확인
   */
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
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * 2. 관리자 DB 클라이언트
   *
   * 현재 curriculum 관련 테이블에
   * 별도 RLS 정책을 만들지 않았으므로
   * service role 기반 admin client로
   * 데이터를 읽습니다.
   */
  const adminClient =
    createAdminClient();

  const [
    levelsResult,
    mappingsResult,
    textbooksResult,
  ] = await Promise.all([
    adminClient
      .from("curriculum_levels")
      .select(`
        id,
        code,
        name,
        display_name,
        target_group,
        description,
        cefr_level,
        lexile_range,
        ar_level,
        us_grade,
        sort_order,
        is_active
      `)
      .order("sort_order", {
        ascending: true,
      }),

    adminClient
      .from(
        "curriculum_level_textbooks"
      )
      .select(`
        id,
        curriculum_level_id,
        textbook_id,
        category,
        is_primary,
        sort_order,
        is_active
      `)
      .eq("is_active", true)
      .order("sort_order", {
        ascending: true,
      }),

    adminClient
      .from("textbooks")
      .select(`
        id,
        title,
        publisher,
        category,
        status,
        is_active,
        sale_price,
        is_for_sale
      `)
      .eq("is_active", true)
      .order("title", {
        ascending: true,
      }),
  ]);

  const firstError =
    levelsResult.error ||
    mappingsResult.error ||
    textbooksResult.error;

  if (firstError) {
    throw new Error(
      `커리큘럼 정보를 불러오지 못했습니다: ${firstError.message}`
    );
  }

  const levels =
    (levelsResult.data ??
      []) as CurriculumLevel[];

  const mappings =
    (mappingsResult.data ??
      []) as CurriculumLevelTextbook[];

  const textbooks =
    (textbooksResult.data ??
      []) as Textbook[];

  /*
   * 3. 교재 빠른 조회용 Map
   */
  const textbookMap = new Map<
    number,
    Textbook
  >(
    textbooks.map((textbook) => [
      textbook.id,
      textbook,
    ])
  );

  /*
   * 실제 Grade 연결된 교재만 통계에 포함
   * 테스트용 미연결 textbook은 제외
   */
  const mappedTextbookIds =
    new Set(
      mappings.map(
        (mapping) =>
          mapping.textbook_id
      )
    );

  const activeLevelCount =
    levels.filter(
      (level) => level.is_active
    ).length;

  const totalMappingCount =
    mappings.length;

  const mappedTextbookCount =
    mappedTextbookIds.size;

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        width: "100%",
      }}
    >
      {/* =========================
          PAGE HEADER
      ========================== */}
      <section
        style={{
          padding: "28px",
          borderRadius: "18px",
          background:
            "linear-gradient(135deg, #0A1F44 0%, #163B72 100%)",
          color: "#ffffff",
          boxShadow:
            "0 14px 32px rgba(10, 31, 68, 0.16)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems:
              "flex-start",
            justifyContent:
              "space-between",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
                padding:
                  "6px 10px",
                marginBottom:
                  "14px",
                borderRadius:
                  "999px",
                background:
                  "rgba(255,255,255,0.12)",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing:
                  "0.04em",
              }}
            >
              EDUCATION CONTENT
            </div>

            <h1
              style={{
                margin: 0,
                fontSize:
                  "30px",
                fontWeight:
                  900,
                letterSpacing:
                  "-0.03em",
              }}
            >
              커리큘럼 관리
            </h1>

            <p
              style={{
                margin:
                  "12px 0 0",
                maxWidth:
                  "760px",
                fontSize:
                  "14px",
                lineHeight:
                  1.8,
                color:
                  "rgba(255,255,255,0.84)",
              }}
            >
              TALKLY Grade는
              학생의 실제 학교
              학년이 아니라 영어
              실력에 따른
              커리큘럼
              단계입니다. 레벨테스트
              결과에 따라 연령과
              관계없이 Grade K부터
              Grade 9 또는 Adult를
              배정할 수 있습니다.
            </p>
          </div>

          <div
            style={{
              minWidth:
                "220px",
              padding:
                "16px 18px",
              borderRadius:
                "14px",
              background:
                "rgba(255,255,255,0.1)",
              border:
                "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <div
              style={{
                fontSize:
                  "12px",
                color:
                  "rgba(255,255,255,0.7)",
              }}
            >
              운영 원칙
            </div>

            <div
              style={{
                marginTop:
                  "6px",
                fontSize:
                  "14px",
                lineHeight:
                  1.6,
                fontWeight:
                  700,
              }}
            >
              실제 학년과
              Curriculum Grade는
              서로 독립적으로
              관리합니다.
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          STATS
      ========================== */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
        }}
      >
        <StatCard
          label="전체 커리큘럼"
          value={`${levels.length}개`}
          detail="Grade K ~ Grade 9 + Adult"
        />

        <StatCard
          label="활성 커리큘럼"
          value={`${activeLevelCount}개`}
          detail="현재 운영 가능한 수준"
        />

        <StatCard
          label="연결 교재"
          value={`${mappedTextbookCount}종`}
          detail="Grade에 연결된 고유 교재"
        />

        <StatCard
          label="교재 매핑"
          value={`${totalMappingCount}건`}
          detail="Grade × 교재 연결 수"
        />
      </section>

      {/* =========================
          NOTICE
      ========================== */}
      <section
        style={{
          padding:
            "17px 20px",
          border:
            "1px solid #dbe5f4",
          borderRadius:
            "14px",
          background:
            "#f5f8fd",
        }}
      >
        <div
          style={{
            fontSize:
              "14px",
            fontWeight:
              900,
            color:
              "#0A1F44",
          }}
        >
          현재 화면의 교재는
          &quot;학생에게 자동
          지급되는 교재&quot;가
          아닙니다.
        </div>

        <p
          style={{
            margin:
              "6px 0 0",
            fontSize:
              "13px",
            lineHeight:
              1.7,
            color:
              "#526079",
          }}
        >
          각 Grade에서 사용할 수
          있는 교재 후보군입니다.
          실제 학생에게 어떤
          Course Book, Reading,
          Voca, Writing 등을
          사용할지는 수강료 결제
          후 관리자가 학생별
          수업량·레벨테스트 결과·학습
          목표를 보고 별도로
          결정합니다.
        </p>
      </section>

      {/* =========================
          LEVEL CARDS
      ========================== */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {levels.map(
          (level) => {
            const levelMappings =
              mappings.filter(
                (mapping) =>
                  mapping.curriculum_level_id ===
                  level.id
              );

            const grouped =
              new Map<
                string,
                Textbook[]
              >();

            for (
              const categoryCode of
              CATEGORY_ORDER
            ) {
              grouped.set(
                categoryCode,
                []
              );
            }

            for (
              const mapping of
              levelMappings
            ) {
              const textbook =
                textbookMap.get(
                  mapping.textbook_id
                );

              if (!textbook) {
                continue;
              }

              const categoryCode =
                mapping.category ||
                textbook.category ||
                "other";

              const current =
                grouped.get(
                  categoryCode
                ) ?? [];

              current.push(
                textbook
              );

              grouped.set(
                categoryCode,
                current
              );
            }

            const visibleGroups =
              Array.from(
                grouped.entries()
              ).filter(
                ([, books]) =>
                  books.length >
                  0
              );

            return (
              <article
                key={level.id}
                style={{
                  overflow:
                    "hidden",
                  border:
                    "1px solid #e0e6ef",
                  borderRadius:
                    "18px",
                  background:
                    "#ffffff",
                  boxShadow:
                    "0 8px 24px rgba(15, 31, 68, 0.05)",
                }}
              >
                {/* LEVEL HEADER */}
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "flex-start",
                    gap: "16px",
                    flexWrap:
                      "wrap",
                    padding:
                      "22px 24px",
                    borderBottom:
                      "1px solid #e8edf4",
                    background:
                      "#fbfcfe",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "9px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          color:
                            "#0A1F44",
                          fontSize:
                            "22px",
                          fontWeight:
                            900,
                        }}
                      >
                        {
                          level.name
                        }
                      </h2>

                      <span
                        style={{
                          padding:
                            "4px 8px",
                          borderRadius:
                            "999px",
                          background:
                            level.is_active
                              ? "#e9f8ef"
                              : "#f2f4f7",
                          color:
                            level.is_active
                              ? "#18794e"
                              : "#667085",
                          fontSize:
                            "11px",
                          fontWeight:
                            800,
                        }}
                      >
                        {level.is_active
                          ? "활성"
                          : "비활성"}
                      </span>

                      <span
                        style={{
                          padding:
                            "4px 8px",
                          borderRadius:
                            "999px",
                          background:
                            "#eef3fb",
                          color:
                            "#36577f",
                          fontSize:
                            "11px",
                          fontWeight:
                            800,
                        }}
                      >
                        {
                          level.code
                        }
                      </span>
                    </div>

                    <p
                      style={{
                        margin:
                          "7px 0 0",
                        fontSize:
                          "13px",
                        color:
                          "#667085",
                      }}
                    >
                      {level.display_name ||
                        "수준 참고 정보 없음"}
                    </p>
                  </div>

                  <div
                    style={{
                      textAlign:
                        "right",
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          "12px",
                        color:
                          "#8993a4",
                      }}
                    >
                      연결 교재
                    </div>

                    <strong
                      style={{
                        display:
                          "block",
                        marginTop:
                          "3px",
                        fontSize:
                          "20px",
                        color:
                          "#0A1F44",
                      }}
                    >
                      {
                        levelMappings.length
                      }
                      종
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    padding:
                      "24px",
                  }}
                >
                  {/* LEVEL INDICATORS */}
                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    <ReferenceCard
                      label="CEFR"
                      value={
                        level.cefr_level
                      }
                    />

                    <ReferenceCard
                      label="Lexile"
                      value={
                        level.lexile_range
                      }
                    />

                    <ReferenceCard
                      label="AR"
                      value={
                        level.ar_level
                      }
                    />

                    <ReferenceCard
                      label="US Grade"
                      value={
                        level.us_grade
                      }
                    />
                  </div>

                  <p
                    style={{
                      margin:
                        "10px 0 0",
                      fontSize:
                        "11px",
                      color:
                        "#98a2b3",
                      lineHeight:
                        1.6,
                    }}
                  >
                    ※ 위 지표는
                    커리큘럼 수준을
                    이해하기 위한 참고
                    정보이며 서로 완전히
                    동일한 수준을
                    의미하지 않습니다.
                  </p>

                  {/* DESCRIPTION */}
                  <div
                    style={{
                      marginTop:
                        "20px",
                      padding:
                        "16px",
                      borderRadius:
                        "12px",
                      background:
                        "#fafbfc",
                      border:
                        "1px solid #edf0f4",
                    }}
                  >
                    <div
                      style={{
                        marginBottom:
                          "5px",
                        fontSize:
                          "12px",
                        fontWeight:
                          800,
                        color:
                          "#697586",
                      }}
                    >
                      커리큘럼 설명
                    </div>

                    <div
                      style={{
                        fontSize:
                          "13px",
                        lineHeight:
                          1.7,
                        color:
                          "#344054",
                      }}
                    >
                      {level.description ||
                        "등록된 설명이 없습니다."}
                    </div>
                  </div>

                  {/* TEXTBOOKS */}
                  <div
                    style={{
                      marginTop:
                        "24px",
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
                        marginBottom:
                          "14px",
                        gap: "12px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize:
                            "15px",
                          fontWeight:
                            900,
                          color:
                            "#0A1F44",
                        }}
                      >
                        사용 가능 교재
                      </h3>

                      <span
                        style={{
                          fontSize:
                            "12px",
                          color:
                            "#7b8494",
                        }}
                      >
                        실제 교재 배정은
                        학생별로 관리자
                        결정
                      </span>
                    </div>

                    {visibleGroups.length ===
                    0 ? (
                      <div
                        style={{
                          padding:
                            "20px",
                          textAlign:
                            "center",
                          border:
                            "1px dashed #d6dce7",
                          borderRadius:
                            "12px",
                          color:
                            "#8b95a7",
                          fontSize:
                            "13px",
                        }}
                      >
                        이 Grade에
                        연결된 교재가
                        없습니다.
                      </div>
                    ) : (
                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(260px, 1fr))",
                          gap: "14px",
                        }}
                      >
                        {visibleGroups.map(
                          ([
                            categoryCode,
                            books,
                          ]) => (
                            <div
                              key={
                                categoryCode
                              }
                              style={{
                                padding:
                                  "16px",
                                border:
                                  "1px solid #e3e8f0",
                                borderRadius:
                                  "13px",
                                background:
                                  "#ffffff",
                              }}
                            >
                              <div
                                style={{
                                  marginBottom:
                                    "11px",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    900,
                                  color:
                                    "#55739b",
                                  letterSpacing:
                                    "0.04em",
                                }}
                              >
                                {CATEGORY_LABELS[
                                  categoryCode
                                ] ||
                                  categoryCode.toUpperCase()}
                              </div>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexDirection:
                                    "column",
                                  gap: "9px",
                                }}
                              >
                                {books.map(
                                  (
                                    textbook
                                  ) => (
                                    <div
                                      key={
                                        textbook.id
                                      }
                                      style={{
                                        padding:
                                          "10px 11px",
                                        borderRadius:
                                          "9px",
                                        background:
                                          "#f8fafc",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize:
                                            "13px",
                                          lineHeight:
                                            1.45,
                                          fontWeight:
                                            800,
                                          color:
                                            "#25324a",
                                        }}
                                      >
                                        {
                                          textbook.title
                                        }
                                      </div>

                                      <div
                                        style={{
                                          display:
                                            "flex",
                                          gap: "6px",
                                          alignItems:
                                            "center",
                                          flexWrap:
                                            "wrap",
                                          marginTop:
                                            "5px",
                                        }}
                                      >
                                        {textbook.publisher && (
                                          <span
                                            style={{
                                              fontSize:
                                                "11px",
                                              color:
                                                "#7b8494",
                                            }}
                                          >
                                            {
                                              textbook.publisher
                                            }
                                          </span>
                                        )}

                                        {textbook.is_for_sale &&
                                          textbook.sale_price !==
                                            null && (
                                            <span
                                              style={{
                                                padding:
                                                  "2px 6px",
                                                borderRadius:
                                                  "999px",
                                                background:
                                                  "#edf7f2",
                                                color:
                                                  "#18794e",
                                                fontSize:
                                                  "10px",
                                                fontWeight:
                                                  800,
                                              }}
                                            >
                                              TALKLY{" "}
                                              {formatPrice(
                                                textbook.sale_price
                                              )}
                                            </span>
                                          )}

                                        <span
                                          style={{
                                            padding:
                                              "2px 6px",
                                            borderRadius:
                                              "999px",
                                            background:
                                              textbook.status ===
                                              "ready"
                                                ? "#eef4ff"
                                                : "#f2f4f7",
                                            color:
                                              textbook.status ===
                                              "ready"
                                                ? "#315ea8"
                                                : "#667085",
                                            fontSize:
                                              "10px",
                                            fontWeight:
                                              800,
                                          }}
                                        >
                                          {textbook.status ===
                                          "ready"
                                            ? "사용 가능"
                                            : "작업 중"}
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
                  </div>
                </div>
              </article>
            );
          }
        )}
      </section>

      {levels.length === 0 && (
        <section
          style={{
            padding: "40px",
            textAlign: "center",
            border:
              "1px dashed #d8dee8",
            borderRadius:
              "16px",
            background:
              "#ffffff",
            color:
              "#7b8494",
          }}
        >
          등록된 커리큘럼이
          없습니다.
        </section>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      style={{
        padding: "18px",
        border:
          "1px solid #e1e6ee",
        borderRadius:
          "14px",
        background:
          "#ffffff",
        boxShadow:
          "0 6px 18px rgba(15, 31, 68, 0.04)",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#7b8494",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontSize: "24px",
          fontWeight: 900,
          color: "#0A1F44",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontSize: "11px",
          lineHeight: 1.5,
          color: "#98a2b3",
        }}
      >
        {detail}
      </div>
    </div>
  );
}

function ReferenceCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div
      style={{
        padding:
          "13px 14px",
        border:
          "1px solid #e4e8ef",
        borderRadius:
          "11px",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          fontSize:
            "10px",
          fontWeight:
            900,
          letterSpacing:
            "0.04em",
          color:
            "#8993a4",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          fontSize:
            "14px",
          fontWeight:
            800,
          color:
            value
              ? "#25324a"
              : "#b1b8c4",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}