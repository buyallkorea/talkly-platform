import {
  redirect,
} from "next/navigation";
import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

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

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
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

function nullableText(
  value: FormDataEntryValue | null
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

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

/*
 * =========================================================
 * 커리큘럼 수정 Server Action
 * =========================================================
 *
 * code / name은 시스템 기준값이므로 수정하지 않습니다.
 *
 * 관리자가 수정할 수 있는 값:
 * - display_name
 * - description
 * - CEFR
 * - Lexile
 * - AR
 * - US Grade
 * - 활성 여부
 */
async function updateCurriculumLevel(
  formData: FormData
) {
  "use server";

  const rawId =
    formData.get("id");

  const levelId =
    Number(rawId);

  if (
    !Number.isInteger(levelId) ||
    levelId <= 0
  ) {
    redirect(
      "/admin/curriculum?error=invalid_id"
    );
  }

  /*
   * 관리자 로그인 확인
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
  } =
    await supabase
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

  const adminClient =
    createAdminClient();

  /*
   * 수정 대상이 실제 존재하는지 확인합니다.
   */
  const {
    data: currentLevel,
    error: levelError,
  } =
    await adminClient
      .from(
        "curriculum_levels"
      )
      .select("id, code")
      .eq("id", levelId)
      .maybeSingle();

  if (
    levelError ||
    !currentLevel
  ) {
    redirect(
      "/admin/curriculum?error=not_found"
    );
  }

  const displayName =
    nullableText(
      formData.get(
        "display_name"
      )
    );

  const description =
    nullableText(
      formData.get(
        "description"
      )
    );

  const cefrLevel =
    nullableText(
      formData.get(
        "cefr_level"
      )
    );

  const lexileRange =
    nullableText(
      formData.get(
        "lexile_range"
      )
    );

  const arLevel =
    nullableText(
      formData.get(
        "ar_level"
      )
    );

  const usGrade =
    nullableText(
      formData.get(
        "us_grade"
      )
    );

  const isActive =
    formData.get(
      "is_active"
    ) === "on";

  const {
    error: updateError,
  } =
    await adminClient
      .from(
        "curriculum_levels"
      )
      .update({
        display_name:
          displayName,
        description,
        cefr_level:
          cefrLevel,
        lexile_range:
          lexileRange,
        ar_level:
          arLevel,
        us_grade:
          usGrade,
        is_active:
          isActive,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", levelId);

  if (updateError) {
    console.error(
      "CURRICULUM UPDATE ERROR:",
      updateError
    );

    redirect(
      `/admin/curriculum?error=${encodeURIComponent(
        updateError.message
      )}`
    );
  }

  revalidatePath(
    "/admin/curriculum"
  );

  redirect(
    `/admin/curriculum?saved=${currentLevel.code}`
  );
}

export default async function AdminCurriculumPage({
  searchParams,
}: PageProps) {
  const query =
    await searchParams;

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
  } =
    await supabase
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
   * =========================================================
   * 데이터 조회
   * =========================================================
   */
  const adminClient =
    createAdminClient();

  const [
    levelsResult,
    mappingsResult,
    textbooksResult,
  ] =
    await Promise.all([
      adminClient
        .from(
          "curriculum_levels"
        )
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
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        ),

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
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        ),

      adminClient
        .from(
          "textbooks"
        )
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
        .eq(
          "is_active",
          true
        )
        .order(
          "title",
          {
            ascending:
              true,
          }
        ),
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
    (
      levelsResult.data ??
      []
    ) as CurriculumLevel[];

  const mappings =
    (
      mappingsResult.data ??
      []
    ) as CurriculumLevelTextbook[];

  const textbooks =
    (
      textbooksResult.data ??
      []
    ) as Textbook[];

  const textbookMap =
    new Map<
      number,
      Textbook
    >(
      textbooks.map(
        (textbook) => [
          textbook.id,
          textbook,
        ]
      )
    );

  const mappedTextbookIds =
    new Set(
      mappings.map(
        (mapping) =>
          mapping.textbook_id
      )
    );

  const activeLevelCount =
    levels.filter(
      (level) =>
        level.is_active
    ).length;

  return (
    <main
      style={{
        display: "flex",
        flexDirection:
          "column",
        gap: "24px",
        width: "100%",
      }}
    >
      {/* =====================================
          상단 안내
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
            "0 14px 32px rgba(10,31,68,0.16)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: "24px",
            flexWrap:
              "wrap",
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
                  800,
                letterSpacing:
                  "0.04em",
              }}
            >
              EDUCATION CONTENT
            </div>

            <h1
              style={{
                margin:
                  "14px 0 0",
                fontSize:
                  "30px",
                fontWeight:
                  900,
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
              단계입니다. 연령과
              관계없이 레벨테스트
              결과에 따라 Grade
              K~9 또는 Adult를
              배정할 수 있습니다.
            </p>
          </div>

          <div
            style={{
              alignSelf:
                "flex-start",
              padding:
                "15px 17px",
              maxWidth:
                "280px",
              borderRadius:
                "13px",
              background:
                "rgba(255,255,255,0.10)",
              border:
                "1px solid rgba(255,255,255,0.14)",
              fontSize:
                "13px",
              lineHeight:
                1.65,
            }}
          >
            <strong>
              수정 원칙
            </strong>

            <div
              style={{
                marginTop:
                  "5px",
                color:
                  "rgba(255,255,255,0.78)",
              }}
            >
              Grade 코드와 이름은
              시스템 기준값으로
              유지하고, 수준지표와
              설명을 관리합니다.
            </div>
          </div>
        </div>
      </section>

      {/* =====================================
          저장 메시지
      ====================================== */}
      {query.saved && (
        <section
          style={{
            padding:
              "15px 18px",
            border:
              "1px solid #b7dfc3",
            borderRadius:
              "12px",
            background:
              "#f2fbf5",
            color:
              "#176b36",
            fontSize:
              "14px",
            fontWeight:
              800,
          }}
        >
          {query.saved} 커리큘럼
          정보가 저장되었습니다.
        </section>
      )}

      {query.error && (
        <section
          style={{
            padding:
              "15px 18px",
            border:
              "1px solid #f0b7b2",
            borderRadius:
              "12px",
            background:
              "#fff6f5",
            color:
              "#b42318",
            fontSize:
              "14px",
            fontWeight:
              800,
          }}
        >
          커리큘럼 저장 중
          오류가 발생했습니다.
          {" "}
          {query.error}
        </section>
      )}

      {/* =====================================
          통계
      ====================================== */}
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
          detail="현재 사용 가능한 수준"
        />

        <StatCard
          label="등록 교재"
          value={`${mappedTextbookIds.size}종`}
          detail="Grade에 연결된 고유 교재"
        />

        <StatCard
          label="Grade-교재 연결"
          value={`${mappings.length}건`}
          detail="현재 커리큘럼 교재 풀"
        />
      </section>

      {/* =====================================
          중요 안내
      ====================================== */}
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
        <strong
          style={{
            color:
              "#0A1F44",
            fontSize:
              "14px",
          }}
        >
          실제 학교 학년과 TALKLY
          Grade는 별개입니다.
        </strong>

        <p
          style={{
            margin:
              "6px 0 0",
            color:
              "#526079",
            fontSize:
              "13px",
            lineHeight:
              1.7,
          }}
        >
          예를 들어 중학생이라도
          영어 수준이 Grade 2일 수
          있고, 영유아 학생도 매우
          높은 영어 실력이라면 Grade
          7 이상의 커리큘럼을 배정할
          수 있습니다.
        </p>
      </section>

      {/* =====================================
          Grade별 카드
      ====================================== */}
      <section
        style={{
          display: "flex",
          flexDirection:
            "column",
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
              const code of
              CATEGORY_ORDER
            ) {
              grouped.set(
                code,
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

              const category =
                mapping.category ||
                textbook.category ||
                "other";

              const current =
                grouped.get(
                  category
                ) ?? [];

              current.push(
                textbook
              );

              grouped.set(
                category,
                current
              );
            }

            const visibleGroups =
              Array.from(
                grouped.entries()
              ).filter(
                ([, books]) =>
                  books.length > 0
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
                    "0 8px 24px rgba(15,31,68,0.05)",
                }}
              >
                {/* Grade 제목 */}
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
                        gap: "8px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize:
                            "23px",
                          color:
                            "#0A1F44",
                          fontWeight:
                            900,
                        }}
                      >
                        {level.name}
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
                        {level.code}
                      </span>
                    </div>

                    <p
                      style={{
                        margin:
                          "7px 0 0",
                        color:
                          "#667085",
                        fontSize:
                          "13px",
                      }}
                    >
                      {level.display_name ||
                        "수준 설명 없음"}
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
                          "11px",
                        color:
                          "#8993a4",
                      }}
                    >
                      사용 가능 교재
                    </div>

                    <strong
                      style={{
                        display:
                          "block",
                        marginTop:
                          "3px",
                        color:
                          "#0A1F44",
                        fontSize:
                          "21px",
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
                  {/* 현재 수준정보 */}
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
                        "9px 0 0",
                      color:
                        "#98a2b3",
                      fontSize:
                        "11px",
                      lineHeight:
                        1.6,
                    }}
                  >
                    ※ CEFR, Lexile,
                    AR, US Grade는
                    수준 이해를 위한 참고
                    지표이며 완전히 동일한
                    등급 체계를 의미하지
                    않습니다.
                  </p>

                  {/* =================================
                      수정 영역
                  ================================== */}
                  <details
                    style={{
                      marginTop:
                        "20px",
                      border:
                        "1px solid #dce3ed",
                      borderRadius:
                        "13px",
                      background:
                        "#ffffff",
                    }}
                  >
                    <summary
                      style={{
                        padding:
                          "15px 17px",
                        cursor:
                          "pointer",
                        color:
                          "#0A1F44",
                        fontSize:
                          "13px",
                        fontWeight:
                          900,
                        userSelect:
                          "none",
                      }}
                    >
                      커리큘럼 정보 수정
                    </summary>

                    <form
                      action={
                        updateCurriculumLevel
                      }
                      style={{
                        padding:
                          "4px 17px 18px",
                      }}
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={
                          level.id
                        }
                      />

                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: "14px",
                        }}
                      >
                        <ReadOnlyField
                          label="Grade 코드"
                          value={
                            level.code
                          }
                        />

                        <ReadOnlyField
                          label="Grade 이름"
                          value={
                            level.name
                          }
                        />

                        <FormField
                          label="수준 참고명"
                          name="display_name"
                          defaultValue={
                            level.display_name ??
                            ""
                          }
                          placeholder="예: 초등 4학년 수준 참고"
                        />

                        <FormField
                          label="CEFR"
                          name="cefr_level"
                          defaultValue={
                            level.cefr_level ??
                            ""
                          }
                          placeholder="예: A1"
                        />

                        <FormField
                          label="Lexile"
                          name="lexile_range"
                          defaultValue={
                            level.lexile_range ??
                            ""
                          }
                          placeholder="예: 165L-520L"
                        />

                        <FormField
                          label="AR Reading Level"
                          name="ar_level"
                          defaultValue={
                            level.ar_level ??
                            ""
                          }
                          placeholder="예: 2.0"
                        />

                        <FormField
                          label="US Grade"
                          name="us_grade"
                          defaultValue={
                            level.us_grade ??
                            ""
                          }
                          placeholder="예: 2"
                        />
                      </div>

                      <div
                        style={{
                          marginTop:
                            "16px",
                        }}
                      >
                        <label
                          htmlFor={`description-${level.id}`}
                          style={
                            labelStyle
                          }
                        >
                          커리큘럼 설명
                        </label>

                        <textarea
                          id={`description-${level.id}`}
                          name="description"
                          defaultValue={
                            level.description ??
                            ""
                          }
                          rows={4}
                          placeholder="이 Grade의 영어 수준과 학습 방향을 입력하세요."
                          style={{
                            ...fieldStyle,
                            resize:
                              "vertical",
                            lineHeight:
                              1.7,
                          }}
                        />
                      </div>

                      <label
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "9px",
                          marginTop:
                            "16px",
                          padding:
                            "13px",
                          borderRadius:
                            "10px",
                          background:
                            "#f8fafc",
                          color:
                            "#344054",
                          fontSize:
                            "13px",
                          fontWeight:
                            800,
                        }}
                      >
                        <input
                          type="checkbox"
                          name="is_active"
                          defaultChecked={
                            level.is_active
                          }
                        />

                        이 커리큘럼
                        Grade를
                        활성화합니다.
                      </label>

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "flex-end",
                          marginTop:
                            "16px",
                        }}
                      >
                        <button
                          type="submit"
                          style={{
                            border:
                              "none",
                            borderRadius:
                              "10px",
                            padding:
                              "12px 18px",
                            background:
                              "#0A1F44",
                            color:
                              "#ffffff",
                            fontSize:
                              "13px",
                            fontWeight:
                              900,
                            cursor:
                              "pointer",
                          }}
                        >
                          커리큘럼 저장
                        </button>
                      </div>
                    </form>
                  </details>

                  {/* 현재 설명 */}
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
                        color:
                          "#697586",
                        fontSize:
                          "11px",
                        fontWeight:
                          900,
                      }}
                    >
                      현재 커리큘럼 설명
                    </div>

                    <div
                      style={{
                        color:
                          "#344054",
                        fontSize:
                          "13px",
                        lineHeight:
                          1.7,
                      }}
                    >
                      {level.description ||
                        "등록된 설명이 없습니다."}
                    </div>
                  </div>

                  {/* =================================
                      교재 후보
                  ================================== */}
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
                        gap: "12px",
                        alignItems:
                          "center",
                        flexWrap:
                          "wrap",
                        marginBottom:
                          "13px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          color:
                            "#0A1F44",
                          fontSize:
                            "15px",
                          fontWeight:
                            900,
                        }}
                      >
                        사용 가능 교재
                      </h3>

                      <span
                        style={{
                          color:
                            "#7b8494",
                          fontSize:
                            "11px",
                        }}
                      >
                        다음 단계에서
                        연결·해제 기능 추가
                      </span>
                    </div>

                    {visibleGroups.length ===
                    0 ? (
                      <div
                        style={{
                          padding:
                            "22px",
                          border:
                            "1px dashed #d6dce7",
                          borderRadius:
                            "12px",
                          textAlign:
                            "center",
                          color:
                            "#8b95a7",
                          fontSize:
                            "13px",
                        }}
                      >
                        연결된 교재가
                        없습니다.
                      </div>
                    ) : (
                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(250px, 1fr))",
                          gap: "13px",
                        }}
                      >
                        {visibleGroups.map(
                          ([
                            category,
                            books,
                          ]) => (
                            <div
                              key={
                                category
                              }
                              style={{
                                padding:
                                  "15px",
                                border:
                                  "1px solid #e3e8f0",
                                borderRadius:
                                  "12px",
                              }}
                            >
                              <div
                                style={{
                                  marginBottom:
                                    "10px",
                                  color:
                                    "#55739b",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    900,
                                  letterSpacing:
                                    "0.04em",
                                }}
                              >
                                {CATEGORY_LABELS[
                                  category
                                ] ||
                                  category.toUpperCase()}
                              </div>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexDirection:
                                    "column",
                                  gap: "8px",
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
                                          "10px",
                                        borderRadius:
                                          "9px",
                                        background:
                                          "#f8fafc",
                                      }}
                                    >
                                      <strong
                                        style={{
                                          display:
                                            "block",
                                          color:
                                            "#25324a",
                                          fontSize:
                                            "13px",
                                          lineHeight:
                                            1.45,
                                        }}
                                      >
                                        {
                                          textbook.title
                                        }
                                      </strong>

                                      <div
                                        style={{
                                          display:
                                            "flex",
                                          gap:
                                            "6px",
                                          flexWrap:
                                            "wrap",
                                          marginTop:
                                            "5px",
                                          color:
                                            "#7b8494",
                                          fontSize:
                                            "10px",
                                        }}
                                      >
                                        {textbook.publisher && (
                                          <span>
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
                                                color:
                                                  "#18794e",
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

                                        <span>
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
    </main>
  );
}

const fieldStyle = {
  width: "100%",
  boxSizing:
    "border-box" as const,
  padding:
    "11px 12px",
  border:
    "1px solid #d7ddea",
  borderRadius:
    "9px",
  background:
    "#ffffff",
  color:
    "#25324a",
  fontSize:
    "13px",
};

const labelStyle = {
  display: "block",
  marginBottom:
    "6px",
  color: "#475467",
  fontSize: "11px",
  fontWeight: 900,
};

function FormField({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        style={labelStyle}
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type="text"
        defaultValue={
          defaultValue
        }
        placeholder={
          placeholder
        }
        style={
          fieldStyle
        }
      />
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={
          labelStyle
        }
      >
        {label}
      </div>

      <div
        style={{
          ...fieldStyle,
          background:
            "#f2f4f7",
          color:
            "#667085",
        }}
      >
        {value}
      </div>
    </div>
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
        padding:
          "18px",
        border:
          "1px solid #e1e6ee",
        borderRadius:
          "14px",
        background:
          "#ffffff",
        boxShadow:
          "0 6px 18px rgba(15,31,68,0.04)",
      }}
    >
      <div
        style={{
          color:
            "#7b8494",
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
            "5px",
          color:
            "#0A1F44",
          fontSize:
            "24px",
          fontWeight:
            900,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          color:
            "#98a2b3",
          fontSize:
            "11px",
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
          color:
            "#8993a4",
          fontSize:
            "10px",
          fontWeight:
            900,
          letterSpacing:
            "0.04em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          color:
            value
              ? "#25324a"
              : "#b1b8c4",
          fontSize:
            "14px",
          fontWeight:
            800,
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}