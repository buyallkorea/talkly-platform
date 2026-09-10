import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

type Textbook = {
  id: number;
  title: string;
  publisher: string | null;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  original_file_url: string | null;
  original_file_type: string | null;
  page_count: number | null;
  status: string;
  is_for_sale: boolean;
  sale_price: number | null;
  external_purchase_url: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type CurriculumLevel = {
  id: number;
  code: string;
  name: string;
  display_name: string | null;
  sort_order: number | null;
  is_active: boolean;
};

type CurriculumMapping = {
  curriculum_level_id: number;
  textbook_id: number;
  category: string | null;
  is_primary: boolean;
  sort_order: number | null;
  is_active: boolean;
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
  "other",
];

const CATEGORY_LABELS: Record<
  string,
  string
> = {
  course_book: "Course Book",
  phonics: "Phonics",
  reading: "Reading",
  speaking: "Speaking",
  writing: "Writing",
  grammar: "Grammar",
  vocabulary: "Voca",
  adult: "Adult",
  other: "기타",
};

const CATEGORY_BADGE_COLORS: Record<
  string,
  {
    background: string;
    color: string;
  }
> = {
  course_book: {
    background: "#eef4ff",
    color: "#2f5fa7",
  },
  phonics: {
    background: "#f2f4f7",
    color: "#475467",
  },
  reading: {
    background: "#ecfdf3",
    color: "#027a48",
  },
  speaking: {
    background: "#fff4ed",
    color: "#b54708",
  },
  writing: {
    background: "#f4f3ff",
    color: "#6938ef",
  },
  grammar: {
    background: "#fff1f3",
    color: "#c01048",
  },
  vocabulary: {
    background: "#eff8ff",
    color: "#175cd3",
  },
  adult: {
    background: "#fdf2fa",
    color: "#c11574",
  },
  other: {
    background: "#f2f4f7",
    color: "#667085",
  },
};

export default async function AdminTextbooksPage() {
  /*
   * =========================================================
   * 관리자 인증
   * =========================================================
   */
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
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * =========================================================
   * 실제 관리자 데이터 조회
   * =========================================================
   *
   * curriculum 관련 테이블까지 함께 읽으므로
   * admin client를 사용합니다.
   */
  const adminClient =
    createAdminClient();

  const [
    textbooksResult,
    levelsResult,
    mappingsResult,
  ] =
    await Promise.all([
      adminClient
        .from("textbooks")
        .select(`
          id,
          title,
          publisher,
          description,
          cover_image_url,
          category,
          original_file_url,
          original_file_type,
          page_count,
          status,
          is_for_sale,
          sale_price,
          external_purchase_url,
          is_active,
          created_at,
          updated_at
        `)
        .order(
          "created_at",
          {
            ascending: false,
          }
        ),

      adminClient
        .from(
          "curriculum_levels"
        )
        .select(`
          id,
          code,
          name,
          display_name,
          sort_order,
          is_active
        `)
        .order(
          "sort_order",
          {
            ascending: true,
          }
        ),

      adminClient
        .from(
          "curriculum_level_textbooks"
        )
        .select(`
          curriculum_level_id,
          textbook_id,
          category,
          is_primary,
          sort_order,
          is_active
        `),
    ]);

  const firstError =
    textbooksResult.error ||
    levelsResult.error ||
    mappingsResult.error;

  if (firstError) {
    throw new Error(
      `교재 관리 정보를 불러오지 못했습니다: ${firstError.message}`
    );
  }

  const textbooks =
    (
      textbooksResult.data ??
      []
    ) as Textbook[];

  const levels =
    (
      levelsResult.data ??
      []
    ) as CurriculumLevel[];

  const mappings =
    (
      mappingsResult.data ??
      []
    ) as CurriculumMapping[];

  /*
   * =========================================================
   * 빠른 조회용 Map
   * =========================================================
   */
  const levelMap =
    new Map<
      number,
      CurriculumLevel
    >(
      levels.map(
        (level) => [
          level.id,
          level,
        ]
      )
    );

  /*
   * 현재 활성 Grade 연결만 사용
   */
  const activeMappings =
    mappings.filter(
      (mapping) =>
        mapping.is_active
    );

  const textbookGradeMap =
    new Map<
      number,
      CurriculumLevel[]
    >();

  for (
    const mapping of
    activeMappings
  ) {
    const level =
      levelMap.get(
        mapping.curriculum_level_id
      );

    if (!level) {
      continue;
    }

    const current =
      textbookGradeMap.get(
        mapping.textbook_id
      ) ?? [];

    current.push(
      level
    );

    textbookGradeMap.set(
      mapping.textbook_id,
      current
    );
  }

  /*
   * =========================================================
   * 통계
   * =========================================================
   */
  const totalCount =
    textbooks.length;

  const activeCount =
    textbooks.filter(
      (item) =>
        item.is_active
    ).length;

  const saleCount =
    textbooks.filter(
      (item) =>
        item.is_for_sale &&
        item.sale_price !== null
    ).length;

  const readyCount =
    textbooks.filter(
      (item) =>
        item.status === "ready"
    ).length;

  const draftCount =
    textbooks.filter(
      (item) =>
        item.status === "draft"
    ).length;

  const fileCount =
    textbooks.filter(
      (item) =>
        Boolean(
          item.original_file_url
        )
    ).length;

  /*
   * 카테고리별 개수
   */
  const categoryCounts =
    new Map<
      string,
      number
    >();

  for (
    const textbook of
    textbooks
  ) {
    const category =
      textbook.category ||
      "other";

    categoryCounts.set(
      category,
      (
        categoryCounts.get(
          category
        ) ?? 0
      ) + 1
    );
  }

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1220px",
        margin: "0 auto",
        padding:
          "48px 38px 90px",
      }}
    >
      {/* =====================================
          HEADER
      ====================================== */}
      <section
        style={{
          padding: "28px",
          borderRadius:
            "18px",
          background:
            "linear-gradient(135deg, #0A1F44 0%, #163B72 100%)",
          color: "#ffffff",
          boxShadow:
            "0 14px 32px rgba(10,31,68,0.14)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display:
                  "inline-flex",
                padding:
                  "6px 10px",
                borderRadius:
                  "999px",
                background:
                  "rgba(255,255,255,0.12)",
                fontSize:
                  "12px",
                fontWeight:
                  900,
                letterSpacing:
                  "0.06em",
              }}
            >
              LEARNING CONTENT
            </div>

            <h1
              style={{
                margin:
                  "14px 0 0",
                fontSize:
                  "31px",
                lineHeight: 1.2,
                fontWeight:
                  900,
                letterSpacing:
                  "-0.04em",
              }}
            >
              교재 관리
            </h1>

            <p
              style={{
                margin:
                  "12px 0 0",
                maxWidth:
                  "700px",
                fontSize:
                  "14px",
                lineHeight:
                  1.8,
                color:
                  "rgba(255,255,255,0.84)",
              }}
            >
              TALKLY 커리큘럼에서 사용하는
              교재의 Grade 연결, 판매정보,
              출판사, 원본 콘텐츠 상태를
              관리합니다.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "9px",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/admin/curriculum"
              style={{
                minHeight:
                  "44px",
                padding:
                  "0 16px",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                border:
                  "1px solid rgba(255,255,255,0.28)",
                borderRadius:
                  "10px",
                background:
                  "rgba(255,255,255,0.08)",
                color:
                  "#ffffff",
                textDecoration:
                  "none",
                fontSize:
                  "12px",
                fontWeight:
                  900,
              }}
            >
              커리큘럼 관리
            </Link>

            <Link
              href="/admin/textbooks/new"
              style={{
                minHeight:
                  "44px",
                padding:
                  "0 17px",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius:
                  "10px",
                background:
                  "#ffffff",
                color:
                  "#0A1F44",
                textDecoration:
                  "none",
                fontSize:
                  "12px",
                fontWeight:
                  900,
              }}
            >
              + 새 교재 등록
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================
          SUMMARY
      ====================================== */}
      <section
        style={{
          marginTop:
            "20px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px",
        }}
      >
        <SummaryCard
          label="전체 교재"
          value={totalCount}
          detail="등록된 전체 교재"
        />

        <SummaryCard
          label="활성 교재"
          value={activeCount}
          detail="현재 운영 중"
        />

        <SummaryCard
          label="사용 가능"
          value={readyCount}
          detail="수업 콘텐츠 준비 완료"
        />

        <SummaryCard
          label="판매 교재"
          value={saleCount}
          detail="판매가격 등록"
        />

        <SummaryCard
          label="원본 등록"
          value={fileCount}
          detail="PDF·이미지 등 보유"
        />
      </section>

      {/* =====================================
          STATUS INFO
      ====================================== */}
      <section
        style={{
          marginTop:
            "16px",
          padding:
            "15px 18px",
          border:
            "1px solid #dbe5f4",
          borderRadius:
            "13px",
          background:
            "#f5f8fd",
        }}
      >
        <strong
          style={{
            color:
              "#0A1F44",
            fontSize:
              "13px",
          }}
        >
          현재 교재 운영 현황
        </strong>

        <div
          style={{
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
            marginTop:
              "7px",
            color:
              "#667085",
            fontSize:
              "12px",
          }}
        >
          <span>
            작업 중{" "}
            <strong>
              {draftCount}종
            </strong>
          </span>

          <span>
            Grade 연결{" "}
            <strong>
              {
                new Set(
                  activeMappings.map(
                    (mapping) =>
                      mapping.textbook_id
                  )
                ).size
              }
              종
            </strong>
          </span>

          <span>
            판매가격 등록{" "}
            <strong>
              {saleCount}종
            </strong>
          </span>
        </div>
      </section>

      {/* =====================================
          CATEGORY SUMMARY
      ====================================== */}
      <section
        style={{
          marginTop:
            "18px",
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {CATEGORY_ORDER.map(
          (category) => {
            const count =
              categoryCounts.get(
                category
              ) ?? 0;

            if (
              count === 0
            ) {
              return null;
            }

            return (
              <div
                key={
                  category
                }
                style={{
                  padding:
                    "8px 11px",
                  border:
                    "1px solid #e4e7ec",
                  borderRadius:
                    "999px",
                  background:
                    "#ffffff",
                  color:
                    "#475467",
                  fontSize:
                    "11px",
                  fontWeight:
                    800,
                }}
              >
                {
                  CATEGORY_LABELS[
                    category
                  ]
                }{" "}
                <strong>
                  {count}
                </strong>
              </div>
            );
          }
        )}
      </section>

      {/* =====================================
          TEXTBOOK LIST
      ====================================== */}
      <section
        style={{
          marginTop:
            "20px",
          display:
            "flex",
          flexDirection:
            "column",
          gap: "14px",
        }}
      >
        {textbooks.length ===
        0 ? (
          <EmptyState />
        ) : (
          textbooks.map(
            (textbook) => {
              const grades =
                (
                  textbookGradeMap.get(
                    textbook.id
                  ) ?? []
                ).sort(
                  (a, b) =>
                    (
                      a.sort_order ??
                      999
                    ) -
                    (
                      b.sort_order ??
                      999
                    )
                );

              const category =
                textbook.category ||
                "other";

              const categoryStyle =
                CATEGORY_BADGE_COLORS[
                  category
                ] ||
                CATEGORY_BADGE_COLORS.other;

              return (
                <article
                  key={
                    textbook.id
                  }
                  style={{
                    padding:
                      "20px 22px",
                    border:
                      "1px solid #e2e7ef",
                    borderRadius:
                      "15px",
                    background:
                      "#ffffff",
                    boxShadow:
                      "0 6px 18px rgba(15,31,68,0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0, 1fr) auto",
                      gap: "24px",
                      alignItems:
                        "start",
                    }}
                  >
                    {/* LEFT */}
                    <div
                      style={{
                        minWidth:
                          0,
                      }}
                    >
                      {/* TITLE */}
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "7px",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <strong
                          style={{
                            color:
                              "#101828",
                            fontSize:
                              "17px",
                            lineHeight:
                              1.4,
                          }}
                        >
                          {
                            textbook.title
                          }
                        </strong>

                        <span
                          style={{
                            padding:
                              "4px 8px",
                            borderRadius:
                              "999px",
                            background:
                              categoryStyle.background,
                            color:
                              categoryStyle.color,
                            fontSize:
                              "10px",
                            fontWeight:
                              900,
                          }}
                        >
                          {CATEGORY_LABELS[
                            category
                          ] ||
                            category}
                        </span>

                        <StatusBadge
                          status={
                            textbook.status
                          }
                        />

                        <ActiveBadge
                          active={
                            textbook.is_active
                          }
                        />

                        {textbook.original_file_type && (
                          <FileTypeBadge
                            type={
                              textbook.original_file_type
                            }
                          />
                        )}
                      </div>

                      {/* PUBLISHER */}
                      <div
                        style={{
                          marginTop:
                            "7px",
                          color:
                            "#667085",
                          fontSize:
                            "12px",
                        }}
                      >
                        출판사{" "}
                        <strong
                          style={{
                            color:
                              textbook.publisher
                                ? "#344054"
                                : "#98a2b3",
                          }}
                        >
                          {textbook.publisher ||
                            "미등록"}
                        </strong>
                      </div>

                      {/* DESCRIPTION */}
                      <p
                        style={{
                          margin:
                            "9px 0 0",
                          maxWidth:
                            "780px",
                          color:
                            "#667085",
                          fontSize:
                            "12px",
                          lineHeight:
                            1.65,
                        }}
                      >
                        {textbook.description ||
                          "등록된 교재 설명이 없습니다."}
                      </p>

                      {/* GRADES */}
                      <div
                        style={{
                          marginTop:
                            "14px",
                        }}
                      >
                        <div
                          style={{
                            color:
                              "#697586",
                            fontSize:
                              "10px",
                            fontWeight:
                              900,
                            letterSpacing:
                              "0.04em",
                          }}
                        >
                          적용 TALKLY GRADE
                        </div>

                        {grades.length >
                        0 ? (
                          <div
                            style={{
                              display:
                                "flex",
                              gap:
                                "6px",
                              flexWrap:
                                "wrap",
                              marginTop:
                                "7px",
                            }}
                          >
                            {grades.map(
                              (
                                grade
                              ) => (
                                <span
                                  key={
                                    grade.id
                                  }
                                  title={
                                    grade.display_name ||
                                    grade.name
                                  }
                                  style={{
                                    padding:
                                      "4px 7px",
                                    borderRadius:
                                      "999px",
                                    background:
                                      "#eef3fb",
                                    color:
                                      "#36577f",
                                    fontSize:
                                      "10px",
                                    fontWeight:
                                      900,
                                  }}
                                >
                                  {
                                    grade.code
                                  }
                                </span>
                              )
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              marginTop:
                                "6px",
                              color:
                                "#b1b8c4",
                              fontSize:
                                "11px",
                            }}
                          >
                            연결된 Grade 없음
                          </div>
                        )}
                      </div>

                      {/* META */}
                      <div
                        style={{
                          marginTop:
                            "15px",
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",
                          gap:
                            "10px",
                          maxWidth:
                            "760px",
                        }}
                      >
                        <MetaBox
                          label="판매"
                          value={
                            textbook.is_for_sale
                              ? textbook.sale_price !==
                                null
                                ? `${textbook.sale_price.toLocaleString(
                                    "ko-KR"
                                  )}원`
                                : "판매가 미등록"
                              : "판매 안 함"
                          }
                        />

                        <MetaBox
                          label="원본 콘텐츠"
                          value={
                            textbook.original_file_url
                              ? textbook.original_file_type
                                ? textbook.original_file_type.toUpperCase()
                                : "등록됨"
                              : "미등록"
                          }
                        />

                        <MetaBox
                          label="페이지"
                          value={`${textbook.page_count ?? 0}`}
                        />

                        <MetaBox
                          label="최종 수정"
                          value={formatDate(
                            textbook.updated_at
                          )}
                        />
                      </div>
                    </div>

                    {/* RIGHT ACTIONS */}
                    <div
                      style={{
                        display:
                          "flex",
                        flexDirection:
                          "column",
                        gap: "8px",
                        minWidth:
                          "124px",
                      }}
                    >
                      {textbook.original_file_url ? (
                        <Link
                          href={`/admin/textbooks/${textbook.id}/viewer`}
                          style={
                            secondaryButtonStyle
                          }
                        >
                          교재 보기
                        </Link>
                      ) : (
                        <div
                          style={{
                            ...secondaryButtonStyle,
                            cursor:
                              "default",
                            color:
                              "#98a2b3",
                            background:
                              "#f9fafb",
                          }}
                        >
                          원본 미등록
                        </div>
                      )}

                      <Link
                        href={`/admin/textbooks/${textbook.id}`}
                        style={
                          primaryButtonStyle
                        }
                      >
                        상세 관리 →
                      </Link>

                      <Link
                        href={`/admin/textbooks/${textbook.id}/edit`}
                        style={
                          tertiaryButtonStyle
                        }
                      >
                        정보 수정
                      </Link>
                    </div>
                  </div>
                </article>
              );
            }
          )
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div
      style={{
        minHeight:
          "104px",
        padding:
          "17px 18px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "13px",
        background:
          "#ffffff",
        boxShadow:
          "0 5px 16px rgba(15,31,68,0.035)",
      }}
    >
      <div
        style={{
          color:
            "#667085",
          fontSize:
            "11px",
          fontWeight:
            800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "7px",
          color:
            "#101828",
          fontSize:
            "27px",
          lineHeight: 1,
          fontWeight:
            900,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop:
            "7px",
          color:
            "#98a2b3",
          fontSize:
            "10px",
        }}
      >
        {detail}
      </div>
    </div>
  );
}

function MetaBox({
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
          "10px 11px",
        borderRadius:
          "9px",
        background:
          "#f8fafc",
      }}
    >
      <div
        style={{
          color:
            "#98a2b3",
          fontSize:
            "9px",
          fontWeight:
            900,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "4px",
          color:
            "#344054",
          fontSize:
            "11px",
          fontWeight:
            800,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const ready =
    status === "ready";

  return (
    <span
      style={{
        minHeight:
          "24px",
        padding:
          "0 8px",
        display:
          "inline-flex",
        alignItems:
          "center",
        borderRadius:
          "999px",
        background:
          ready
            ? "#ecfdf3"
            : "#fff7ed",
        color:
          ready
            ? "#027a48"
            : "#b54708",
        fontSize:
          "10px",
        fontWeight:
          900,
      }}
    >
      {ready
        ? "사용 가능"
        : status ===
            "draft"
          ? "작업 중"
          : status}
    </span>
  );
}

function ActiveBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      style={{
        minHeight:
          "24px",
        padding:
          "0 8px",
        display:
          "inline-flex",
        alignItems:
          "center",
        borderRadius:
          "999px",
        background:
          active
            ? "#eef4ff"
            : "#f2f4f7",
        color:
          active
            ? "#315ea8"
            : "#667085",
        fontSize:
          "10px",
        fontWeight:
          900,
      }}
    >
      {active
        ? "활성"
        : "비활성"}
    </span>
  );
}

function FileTypeBadge({
  type,
}: {
  type: string | null;
}) {
  const label =
    type?.toUpperCase() ||
    "FILE";

  return (
    <span
      style={{
        minHeight:
          "24px",
        padding:
          "0 8px",
        display:
          "inline-flex",
        alignItems:
          "center",
        borderRadius:
          "999px",
        background:
          "#f4f3ff",
        color:
          "#6938ef",
        fontSize:
          "10px",
        fontWeight:
          900,
      }}
    >
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding:
          "70px 24px",
        textAlign:
          "center",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "16px",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          color:
            "#101828",
          fontSize:
            "17px",
          fontWeight:
            900,
        }}
      >
        등록된 교재가 없습니다.
      </div>

      <p
        style={{
          margin:
            "8px 0 0",
          color:
            "#98a2b3",
          fontSize:
            "13px",
        }}
      >
        새로운 교재를 등록해
        TALKLY 커리큘럼에 연결할
        수 있습니다.
      </p>

      <Link
        href="/admin/textbooks/new"
        style={{
          marginTop:
            "20px",
          minHeight:
            "42px",
          padding:
            "0 16px",
          display:
            "inline-flex",
          alignItems:
            "center",
          justifyContent:
            "center",
          borderRadius:
            "9px",
          background:
            "#0A1F44",
          color:
            "#ffffff",
          textDecoration:
            "none",
          fontSize:
            "12px",
          fontWeight:
            900,
        }}
      >
        첫 교재 등록하기
      </Link>
    </div>
  );
}

const primaryButtonStyle = {
  minHeight:
    "38px",
  padding:
    "0 13px",
  display:
    "inline-flex",
  alignItems:
    "center",
  justifyContent:
    "center",
  border:
    "none",
  borderRadius:
    "8px",
  background:
    "#0A1F44",
  color:
    "#ffffff",
  textDecoration:
    "none",
  fontSize:
    "11px",
  fontWeight:
    900,
};

const secondaryButtonStyle = {
  minHeight:
    "38px",
  padding:
    "0 13px",
  display:
    "inline-flex",
  alignItems:
    "center",
  justifyContent:
    "center",
  border:
    "1px solid #d0d5dd",
  borderRadius:
    "8px",
  background:
    "#ffffff",
  color:
    "#344054",
  textDecoration:
    "none",
  fontSize:
    "11px",
  fontWeight:
    900,
};

const tertiaryButtonStyle = {
  minHeight:
    "38px",
  padding:
    "0 13px",
  display:
    "inline-flex",
  alignItems:
    "center",
  justifyContent:
    "center",
  border:
    "1px solid #dbe5f4",
  borderRadius:
    "8px",
  background:
    "#f5f8fd",
  color:
    "#36577f",
  textDecoration:
    "none",
  fontSize:
    "11px",
  fontWeight:
    900,
};

function formatDate(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date(value)
  );
}