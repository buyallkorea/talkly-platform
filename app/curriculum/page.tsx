import Image from "next/image";
import Link from "next/link";

import HomeAuthMenu from "@/components/HomeAuthMenu";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

type CurriculumLevel = {
  id: number;
  code: string;
  name: string;
  display_name: string | null;
  description: string | null;
  cefr_level: string | null;
  lexile_range: string | null;
  ar_level: string | null;
  us_grade: string | null;
  sort_order: number | null;
};

type CurriculumLevelTextbook = {
  id: number;
  curriculum_level_id: number;
  textbook_id: number;
  category: string | null;
  is_primary: boolean;
  sort_order: number | null;
};

type Textbook = {
  id: number;
  title: string;
  description: string | null;
  publisher: string | null;
  category: string | null;
  cover_image_url: string | null;
  cover_signed_url: string | null;
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
  course_book: "Course Book",
  phonics: "Phonics",
  reading: "Reading",
  speaking: "Speaking",
  writing: "Writing",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  adult: "Adult",
};

const CATEGORY_KOREAN: Record<
  string,
  string
> = {
  course_book: "종합영어",
  phonics: "파닉스",
  reading: "리딩",
  speaking: "스피킹",
  writing: "라이팅",
  grammar: "그래머",
  vocabulary: "보카",
  adult: "성인영어",
};

export const revalidate = 300;

export default async function CurriculumPage() {
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
        description,
        cefr_level,
        lexile_range,
        ar_level,
        us_grade,
        sort_order
      `)
      .eq("is_active", true)
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
        sort_order
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
        description,
        publisher,
        category,
        cover_image_url
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
    console.error(
      "PUBLIC CURRICULUM LOAD ERROR:",
      firstError
    );

    throw new Error(
      "커리큘럼 정보를 불러오지 못했습니다."
    );
  }

  const levels =
    (levelsResult.data ??
      []) as CurriculumLevel[];

  const mappings =
    (mappingsResult.data ??
      []) as CurriculumLevelTextbook[];

  const rawTextbooks =
    (textbooksResult.data ??
      []) as Omit<
      Textbook,
      "cover_signed_url"
    >[];

  /*
   * =========================================================
   * Private Storage 교재 표지 signed URL 생성
   * =========================================================
   *
   * cover_image_url에는 공개 URL이 아니라
   * textbook-files bucket 내부 경로가 저장됩니다.
   *
   * 따라서 공개 페이지에서 직접 img src로 사용할 수 없고,
   * 서버에서 signed URL을 만들어 전달합니다.
   */
  const textbooks =
    await Promise.all(
      rawTextbooks.map(
        async (textbook) => {
          if (
            !textbook.cover_image_url
          ) {
            return {
              ...textbook,
              cover_signed_url:
                null,
            };
          }

          const {
            data,
            error,
          } =
            await adminClient.storage
              .from(
                "textbook-files"
              )
              .createSignedUrl(
                textbook.cover_image_url,
                60 * 60
              );

          if (error) {
            console.error(
              `TEXTBOOK COVER SIGNED URL ERROR (${textbook.id}):`,
              error.message
            );

            return {
              ...textbook,
              cover_signed_url:
                null,
            };
          }

          return {
            ...textbook,
            cover_signed_url:
              data?.signedUrl ??
              null,
          };
        }
      )
    );

  const textbookMap =
    new Map<number, Textbook>(
      textbooks.map(
        (textbook) => [
          textbook.id,
          textbook,
        ]
      )
    );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fafaf7",
        color: "#1b2a4a",
      }}
    >
      {/* =========================================
          상단 유틸리티
      ========================================== */}
      <div
        className="talkly-utility"
        style={{
          background: "#16213e",
          color: "#cfd8ee",
          fontSize: "12px",
        }}
      >
        <div
          style={{
            width:
              "min(1200px, calc(100% - 36px))",
            minHeight: "36px",
            margin: "0 auto",
            display: "flex",
            justifyContent:
              "flex-end",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <Link
            href="/level-test"
            style={utilityLinkStyle}
          >
            레벨테스트신청
          </Link>

          <span
            style={{
              opacity: 0.25,
            }}
          >
            |
          </span>

          <Link
            href="/enroll"
            style={utilityLinkStyle}
          >
            수강신청
          </Link>

          <span
            style={{
              opacity: 0.25,
            }}
          >
            |
          </span>

          <Link
            href="/consultation"
            style={utilityLinkStyle}
          >
            1:1상담
          </Link>
        </div>
      </div>

      {/* =========================================
          HEADER
      ========================================== */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background:
            "rgba(255,255,255,0.94)",
          backdropFilter:
            "blur(12px)",
          borderBottom:
            "1px solid #e7e9f0",
        }}
      >
        <div
          className="talkly-main-header"
          style={{
            width:
              "min(1200px, calc(100% - 36px))",
            minHeight: "82px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns:
              "260px 1fr auto",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <Link
            href="/"
            aria-label="TALKLY 홈"
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              width: "fit-content",
            }}
          >
            <Image
              src="/talkly-logo.png"
              alt="TALKLY"
              width={320}
              height={110}
              priority
              style={{
                width: "auto",
                height: "82px",
                objectFit:
                  "contain",
              }}
            />
          </Link>

          <nav
            className="talkly-desktop-nav"
            style={{
              display: "flex",
              justifyContent:
                "center",
              alignItems:
                "center",
              gap: "5px",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            <div className="talkly-nav-item">
              <Link
                href="/#greeting"
                className="talkly-nav-link"
              >
                토클리소개 ▾
              </Link>

              <div className="talkly-dropdown">
                <Link href="/#greeting">
                  인사말
                </Link>

                <Link href="/#why">
                  Why TALKLY?
                </Link>

                <Link href="/#programs">
                  프로그램
                </Link>

                <Link href="/#business-areas">
                  사업영역
                </Link>
              </div>
            </div>

            <div className="talkly-nav-item">
              <Link
                href="/#programs"
                className="talkly-nav-link"
              >
                교육센터 ▾
              </Link>

              <div className="talkly-dropdown">
                <Link href="/#programs">
                  프로그램소개
                </Link>

                <Link href="/curriculum">
                  커리큘럼/교재
                </Link>

                <Link href="/#teachers">
                  교사소개
                </Link>
              </div>
            </div>

            <div className="talkly-nav-item">
              <Link
                href="/#ai"
                className="talkly-nav-link"
              >
                TALKLY AI ▾
              </Link>

              <div className="talkly-dropdown">
                <Link href="/#ai">
                  AI 수업리포트
                </Link>

                <Link href="/#ai">
                  AI 성장리포트
                </Link>

                <Link href="/#ai">
                  AI Writing
                </Link>

                <Link href="/#ai">
                  강사 AI Brief
                </Link>
              </div>
            </div>

            <Link
              href="/level-test"
              className="talkly-nav-link"
            >
              레벨테스트
            </Link>

            <div className="talkly-nav-item">
              <Link
                href="/enroll"
                className="talkly-nav-link"
              >
                수강신청 ▾
              </Link>

              <div className="talkly-dropdown">
                <Link href="/enroll">
                  수강신청
                </Link>

                <Link href="/login">
                  내 수업관리
                </Link>
              </div>
            </div>

            <div className="talkly-nav-item">
              <Link
                href="/#information"
                className="talkly-nav-link"
              >
                인포메이션 ▾
              </Link>

              <div className="talkly-dropdown">
                <Link href="/notice">
                  공지사항
                </Link>

                <Link href="/#reviews">
                  수업후기
                </Link>

                <Link href="/consultation">
                  1:1상담
                </Link>
              </div>
            </div>
          </nav>

          <HomeAuthMenu />
        </div>
      </header>

      {/* =========================================
          HERO
      ========================================== */}
      <section
        style={{
          padding:
            "88px 20px 74px",
          background:
            "linear-gradient(135deg, #071a3a 0%, #0A1F44 48%, #174b91 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1180px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              gap: "8px",
              padding:
                "7px 12px",
              borderRadius:
                "999px",
              background:
                "rgba(255,255,255,0.11)",
              border:
                "1px solid rgba(255,255,255,0.14)",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing:
                "0.05em",
            }}
          >
            TALKLY CURRICULUM
          </div>

          <h1
            style={{
              margin:
                "20px 0 0",
              maxWidth: "820px",
              fontSize:
                "clamp(34px, 5vw, 58px)",
              lineHeight: 1.15,
              letterSpacing:
                "-0.04em",
              fontWeight: 900,
            }}
          >
            영어 실력에 맞춰
            <br />
            정확한 단계에서
            시작합니다.
          </h1>

          <p
            style={{
              margin:
                "24px 0 0",
              maxWidth: "720px",
              fontSize:
                "clamp(15px, 2vw, 18px)",
              lineHeight: 1.85,
              color:
                "rgba(255,255,255,0.80)",
              wordBreak:
                "keep-all",
            }}
          >
            TALKLY는 단순히
            학생의 나이나 학교 학년으로
            수업 단계를 결정하지
            않습니다. 레벨테스트
            결과와 학습 목표를
            바탕으로 현재 영어 실력에
            가장 적합한 커리큘럼을
            배정합니다.
          </p>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "30px",
            }}
          >
            <HeroChip>
              Grade K ~ Grade 9
            </HeroChip>

            <HeroChip>
              Adult
            </HeroChip>

            <HeroChip>
              Level Test Based
            </HeroChip>

            <HeroChip>
              Personalized Textbooks
            </HeroChip>
          </div>
        </div>
      </section>

      {/* =========================================
          핵심 설명
      ========================================== */}
      <section
        style={{
          padding:
            "56px 20px 18px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1180px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              padding:
                "28px 30px",
              borderRadius:
                "22px",
              background:
                "#ffffff",
              border:
                "1px solid #dce6f4",
              boxShadow:
                "0 16px 40px rgba(10,31,68,0.07)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "18px",
                alignItems:
                  "flex-start",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  width: "46px",
                  height: "46px",
                  borderRadius:
                    "14px",
                  background:
                    "#eaf2ff",
                  fontSize: "22px",
                }}
              >
                🎯
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      "21px",
                    fontWeight: 900,
                    letterSpacing:
                      "-0.02em",
                  }}
                >
                  TALKLY Grade는
                  학교 학년이
                  아닙니다.
                </h2>

                <p
                  style={{
                    margin:
                      "9px 0 0",
                    color:
                      "#5f6f86",
                    fontSize:
                      "14px",
                    lineHeight: 1.8,
                    wordBreak:
                      "keep-all",
                  }}
                >
                  Grade K부터
                  Grade 9까지의 명칭은
                  영어 수준을 이해하기
                  쉽게 구분하기 위한
                  TALKLY의 커리큘럼
                  단계입니다. 실제 학교
                  학년과는 별개이며,
                  영어 실력에 따라 어린
                  학생이 높은 Grade에서
                  시작하거나 중학생이
                  기초 Grade에서 시작할
                  수도 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================
          CURRICULUM
      ========================================== */}
      <section
        style={{
          padding:
            "48px 20px 80px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1180px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              marginBottom:
                "28px",
            }}
          >
            <div
              style={{
                color:
                  "#2f67b2",
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing:
                  "0.08em",
              }}
            >
              LEVEL SYSTEM
            </div>

            <h2
              style={{
                margin:
                  "8px 0 0",
                fontSize:
                  "clamp(27px, 4vw, 38px)",
                lineHeight: 1.25,
                letterSpacing:
                  "-0.035em",
                fontWeight: 900,
              }}
            >
              TALKLY 커리큘럼 단계
            </h2>

            <p
              style={{
                margin:
                  "12px 0 0",
                maxWidth: "720px",
                color:
                  "#69788d",
                fontSize: "14px",
                lineHeight: 1.8,
                wordBreak:
                  "keep-all",
              }}
            >
              CEFR, Lexile, AR,
              US Grade는 수준을
              이해하기 위한 참고
              지표입니다. 각 지표가
              완전히 동일한 등급을
              의미하는 것은 아닙니다.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: "22px",
            }}
          >
            {levels.map(
              (level, index) => {
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
                  const category of
                  CATEGORY_ORDER
                ) {
                  grouped.set(
                    category,
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

                  const books =
                    grouped.get(
                      category
                    ) ?? [];

                  books.push(
                    textbook
                  );

                  grouped.set(
                    category,
                    books
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
                      borderRadius:
                        "24px",
                      background:
                        "#ffffff",
                      border:
                        "1px solid #dfe7f2",
                      boxShadow:
                        "0 12px 34px rgba(10,31,68,0.055)",
                    }}
                  >
                    <div
                      className="talkly-level-head"
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "minmax(160px, 0.8fr) minmax(260px, 2.2fr)",
                        gap: "24px",
                        padding:
                          "26px 28px",
                        background:
                          index % 2 ===
                          0
                            ? "#f8fbff"
                            : "#fbfcff",
                        borderBottom:
                          "1px solid #e7edf5",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display:
                              "inline-flex",
                            padding:
                              "5px 9px",
                            borderRadius:
                              "999px",
                            background:
                              "#e8f1ff",
                            color:
                              "#3167ad",
                            fontSize:
                              "10px",
                            fontWeight:
                              900,
                            letterSpacing:
                              "0.06em",
                          }}
                        >
                          {level.code}
                        </div>

                        <h3
                          style={{
                            margin:
                              "9px 0 0",
                            fontSize:
                              "25px",
                            fontWeight:
                              900,
                            letterSpacing:
                              "-0.03em",
                          }}
                        >
                          {level.name}
                        </h3>

                        <div
                          style={{
                            marginTop:
                              "6px",
                            color:
                              "#64748b",
                            fontSize:
                              "13px",
                            fontWeight:
                              700,
                          }}
                        >
                          {level.display_name ||
                            "영어 수준 참고"}
                        </div>
                      </div>

                      <div>
                        <p
                          style={{
                            margin: 0,
                            color:
                              "#53647a",
                            fontSize:
                              "14px",
                            lineHeight:
                              1.8,
                            wordBreak:
                              "keep-all",
                          }}
                        >
                          {level.description ||
                            "TALKLY 레벨테스트 결과와 학습 목표를 바탕으로 학생에게 적합한 커리큘럼을 배정합니다."}
                        </p>

                        <div
                          className="talkly-reference-grid"
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(4, minmax(0, 1fr))",
                            gap: "9px",
                            marginTop:
                              "18px",
                          }}
                        >
                          <ReferenceItem
                            label="CEFR"
                            value={
                              level.cefr_level
                            }
                          />

                          <ReferenceItem
                            label="Lexile"
                            value={
                              level.lexile_range
                            }
                          />

                          <ReferenceItem
                            label="AR"
                            value={
                              level.ar_level
                            }
                          />

                          <ReferenceItem
                            label="US Grade"
                            value={
                              level.us_grade
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding:
                          "26px 28px 30px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: "12px",
                          flexWrap:
                            "wrap",
                          alignItems:
                            "flex-end",
                          marginBottom:
                            "18px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color:
                                "#2f67b2",
                              fontSize:
                                "10px",
                              fontWeight:
                                900,
                              letterSpacing:
                                "0.07em",
                            }}
                          >
                            TEXTBOOK POOL
                          </div>

                          <h4
                            style={{
                              margin:
                                "5px 0 0",
                              fontSize:
                                "17px",
                              fontWeight:
                                900,
                            }}
                          >
                            활용 가능 교재
                          </h4>
                        </div>

                        <div
                          style={{
                            color:
                              "#8a96a8",
                            fontSize:
                              "11px",
                          }}
                        >
                          학생별 실제 교재는
                          레벨테스트 후 별도
                          배정됩니다.
                        </div>
                      </div>

                      {visibleGroups.length ===
                      0 ? (
                        <div
                          style={{
                            padding:
                              "24px",
                            border:
                              "1px dashed #d8e0eb",
                            borderRadius:
                              "14px",
                            background:
                              "#fafcff",
                            color:
                              "#8b97a8",
                            textAlign:
                              "center",
                            fontSize:
                              "13px",
                          }}
                        >
                          현재 등록된 활용
                          교재가 없습니다.
                        </div>
                      ) : (
                        <div
                          className="talkly-textbook-grid"
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(245px, 1fr))",
                            gap:
                              "14px",
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
                                    "16px",
                                  border:
                                    "1px solid #e4e9f1",
                                  borderRadius:
                                    "16px",
                                  background:
                                    "#ffffff",
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    justifyContent:
                                      "space-between",
                                    gap:
                                      "8px",
                                    alignItems:
                                      "center",
                                    marginBottom:
                                      "12px",
                                  }}
                                >
                                  <strong
                                    style={{
                                      color:
                                        "#315f9c",
                                      fontSize:
                                        "11px",
                                      fontWeight:
                                        900,
                                      letterSpacing:
                                        "0.05em",
                                    }}
                                  >
                                    {CATEGORY_LABELS[
                                      category
                                    ] ||
                                      category.toUpperCase()}
                                  </strong>

                                  <span
                                    style={{
                                      color:
                                        "#98a2b3",
                                      fontSize:
                                        "10px",
                                    }}
                                  >
                                    {CATEGORY_KOREAN[
                                      category
                                    ] ||
                                      ""}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    display:
                                      "flex",
                                    flexDirection:
                                      "column",
                                    gap:
                                      "10px",
                                  }}
                                >
                                  {books.map(
                                    (
                                      textbook
                                    ) => (
                                      <TextbookItem
                                        key={
                                          textbook.id
                                        }
                                        textbook={
                                          textbook
                                        }
                                      />
                                    )
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              }
            )}
          </div>

          {levels.length === 0 && (
            <div
              style={{
                padding:
                  "50px 24px",
                border:
                  "1px dashed #d6dfeb",
                borderRadius:
                  "20px",
                background:
                  "#ffffff",
                textAlign:
                  "center",
                color:
                  "#7b8798",
              }}
            >
              현재 공개된 커리큘럼이
              없습니다.
            </div>
          )}
        </div>
      </section>

      {/* =========================================
          PROCESS
      ========================================== */}
      <section
        style={{
          padding:
            "70px 20px",
          background:
            "#eef4fc",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1180px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              textAlign:
                "center",
              marginBottom:
                "34px",
            }}
          >
            <div
              style={{
                color:
                  "#356cad",
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing:
                  "0.08em",
              }}
            >
              PERSONALIZED LEARNING
            </div>

            <h2
              style={{
                margin:
                  "8px 0 0",
                fontSize:
                  "clamp(26px, 4vw, 36px)",
                fontWeight: 900,
                letterSpacing:
                  "-0.035em",
              }}
            >
              내게 맞는 수업은
              이렇게 결정됩니다
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "14px",
            }}
          >
            <ProcessCard
              number="01"
              title="레벨테스트"
              description="AI 레벨테스트와 필요 시 원어민 인터뷰를 통해 현재 영어 실력을 확인합니다."
            />

            <ProcessCard
              number="02"
              title="최종 Grade 결정"
              description="관리자가 테스트 결과를 검토하여 학생에게 적합한 TALKLY Grade를 확정합니다."
            />

            <ProcessCard
              number="03"
              title="커리큘럼·교재 배정"
              description="수강 일정과 학습 목표까지 종합하여 실제 수업 커리큘럼과 교재를 학생별로 결정합니다."
            />

            <ProcessCard
              number="04"
              title="맞춤 수업 시작"
              description="배정된 교재와 학습 방향을 기반으로 1:1 화상영어 수업을 진행합니다."
            />
          </div>
        </div>
      </section>

      {/* =========================================
          CTA
      ========================================== */}
      <section
        style={{
          padding:
            "78px 20px 88px",
          background:
            "#ffffff",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1000px",
            margin: "0 auto",
            padding:
              "44px 28px",
            borderRadius:
              "26px",
            background:
              "linear-gradient(135deg, #0A1F44 0%, #174b91 100%)",
            textAlign:
              "center",
            color: "#ffffff",
            boxShadow:
              "0 20px 50px rgba(10,31,68,0.16)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize:
                "clamp(27px, 4vw, 38px)",
              fontWeight: 900,
              letterSpacing:
                "-0.035em",
            }}
          >
            나에게 맞는 TALKLY
            Grade를 확인해 보세요.
          </h2>

          <p
            style={{
              margin:
                "14px auto 0",
              maxWidth: "650px",
              color:
                "rgba(255,255,255,0.78)",
              fontSize: "14px",
              lineHeight: 1.8,
              wordBreak:
                "keep-all",
            }}
          >
            영어 실력과 학습 목표를
            정확히 파악하는 것부터
            TALKLY의 맞춤 수업이
            시작됩니다.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent:
                "center",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "26px",
            }}
          >
            <Link
              href="/level-test"
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                minHeight: "48px",
                padding:
                  "0 22px",
                borderRadius:
                  "12px",
                background:
                  "#ffffff",
                color:
                  "#0A1F44",
                fontSize: "14px",
                fontWeight: 900,
                textDecoration:
                  "none",
              }}
            >
              무료 레벨테스트
            </Link>

            <Link
              href="/consultation"
              style={{
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                minHeight: "48px",
                padding:
                  "0 22px",
                borderRadius:
                  "12px",
                border:
                  "1px solid rgba(255,255,255,0.35)",
                background:
                  "rgba(255,255,255,0.08)",
                color:
                  "#ffffff",
                fontSize: "14px",
                fontWeight: 900,
                textDecoration:
                  "none",
              }}
            >
              수강 상담
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================
          FOOTER
      ========================================== */}
      <footer
        style={{
          background: "#1b2a4a",
          color: "#c6cde3",
          padding:
            "56px 0 24px",
        }}
      >
        <div
          style={{
            width:
              "min(1200px, calc(100% - 36px))",
            margin: "0 auto",
          }}
        >
          <div
            className="talkly-footer-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.4fr repeat(4, 1fr)",
              gap: "26px",
              marginBottom:
                "40px",
            }}
          >
            <div>
              <Image
                src="/talkly-logo-white.png"
                alt="TALKLY"
                width={280}
                height={95}
                style={{
                  width: "auto",
                  height: "48px",
                  objectFit:
                    "contain",
                }}
              />

              <p
                style={{
                  margin:
                    "12px 0 0",
                  color:
                    "#8b96b8",
                  fontSize:
                    "13px",
                  lineHeight: 1.7,
                }}
              >
                언제 어디서나 톡.
                <br />
                전 연령을 위한
                화상영어 학습 플랫폼
                TALKLY.
              </p>
            </div>

            <FooterColumn
              title="토클리소개"
              items={[
                [
                  "인사말",
                  "/#greeting",
                ],
                [
                  "Why TALKLY?",
                  "/#why",
                ],
                [
                  "프로그램",
                  "/#programs",
                ],
                [
                  "사업영역",
                  "/#business-areas",
                ],
              ]}
            />

            <FooterColumn
              title="교육센터"
              items={[
                [
                  "프로그램소개",
                  "/#programs",
                ],
                [
                  "커리큘럼/교재",
                  "/curriculum",
                ],
                [
                  "교사소개",
                  "/#teachers",
                ],
              ]}
            />

            <FooterColumn
              title="TALKLY AI"
              items={[
                [
                  "AI Lesson Report",
                  "/#ai",
                ],
                [
                  "AI Growth Report",
                  "/#ai",
                ],
                [
                  "AI Writing",
                  "/#ai",
                ],
              ]}
            />

            <FooterColumn
              title="인포메이션"
              items={[
                [
                  "공지사항",
                  "/notice",
                ],
                [
                  "수업후기",
                  "/#reviews",
                ],
                [
                  "1:1상담",
                  "/consultation",
                ],
              ]}
            />
          </div>

          <div
            style={{
              borderTop:
                "1px solid rgba(255,255,255,.1)",
              paddingTop:
                "20px",
              display: "flex",
              justifyContent:
                "space-between",
              gap: "12px",
              flexWrap: "wrap",
              color:
                "#7a84a6",
              fontSize: "12px",
            }}
          >
            <span>
              © 2026 TALKLY. All
              rights reserved.
            </span>

            <span>
              이용약관 ·
              개인정보처리방침 ·
              고객센터
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        html {
          scroll-behavior: smooth;
        }

        .talkly-nav-item {
          position: relative;
        }

        .talkly-nav-link {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 0 13px;
          border-radius: 8px;
          color: #1b2a4a;
          text-decoration: none;
          white-space: nowrap;
        }

        .talkly-nav-link:hover {
          background: #f0f3fc;
          color: #2f6fed;
        }

        .talkly-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          min-width: 185px;
          padding: 9px;
          border: 1px solid #e7e9f0;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(20,30,60,.12);
          opacity: 0;
          visibility: hidden;
          transform: translateY(6px);
          transition: .18s ease;
        }

        .talkly-nav-item:hover .talkly-dropdown {
          opacity: 1;
          visibility: visible;
          transform: translateY(3px);
        }

        .talkly-dropdown a {
          display: block;
          padding: 9px 11px;
          border-radius: 7px;
          color: #3d4560;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }

        .talkly-dropdown a:hover {
          background: #f0f3fc;
          color: #2f6fed;
        }

        @media (max-width: 1040px) {
          .talkly-main-header {
            grid-template-columns: 190px 1fr auto !important;
          }

          .talkly-desktop-nav {
            display: none !important;
          }

          .talkly-footer-grid {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          }

          .talkly-level-head {
            grid-template-columns: 1fr !important;
          }

          .talkly-reference-grid {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .talkly-utility {
            display: none !important;
          }

          .talkly-main-header {
            grid-template-columns: 1fr auto !important;
          }

          .talkly-main-header img {
            height: 46px !important;
          }

          .talkly-footer-grid {
            grid-template-columns: 1fr !important;
          }

          .talkly-reference-grid {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          }

          .talkly-textbook-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function HeroChip({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        padding:
          "8px 11px",
        borderRadius:
          "999px",
        background:
          "rgba(255,255,255,0.09)",
        border:
          "1px solid rgba(255,255,255,0.13)",
        color:
          "rgba(255,255,255,0.84)",
        fontSize: "11px",
        fontWeight: 800,
      }}
    >
      {children}
    </span>
  );
}

function ReferenceItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding:
          "11px 12px",
        borderRadius:
          "11px",
        border:
          "1px solid #e1e7ef",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          color:
            "#929daf",
          fontSize: "9px",
          fontWeight: 900,
          letterSpacing:
            "0.05em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "4px",
          color: value
            ? "#26364e"
            : "#b1b9c5",
          fontSize: "12px",
          fontWeight: 800,
          overflowWrap:
            "anywhere",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function TextbookItem({
  textbook,
}: {
  textbook: Textbook;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "11px",
        alignItems:
          "center",
        padding:
          "10px",
        borderRadius:
          "12px",
        background:
          "#f8fafc",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: "42px",
          height: "54px",
          overflow:
            "hidden",
          borderRadius:
            "7px",
          border:
            "1px solid #dde4ee",
          background:
            "linear-gradient(145deg, #e8f0fc 0%, #f7faff 100%)",
        }}
      >
        {textbook.cover_signed_url ? (
          <img
            src={
              textbook.cover_signed_url
            }
            alt={`${textbook.title} 교재 표지`}
            style={{
              width: "100%",
              height: "100%",
              objectFit:
                "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              width: "100%",
              height: "100%",
              color:
                "#5678a6",
              fontSize: "8px",
              fontWeight: 900,
              textAlign:
                "center",
              lineHeight: 1.25,
            }}
          >
            TALKLY
            <br />
            BOOK
          </div>
        )}
      </div>

      <div
        style={{
          minWidth: 0,
        }}
      >
        <strong
          style={{
            display:
              "block",
            color:
              "#26364e",
            fontSize:
              "12px",
            lineHeight: 1.45,
            wordBreak:
              "keep-all",
          }}
        >
          {textbook.title}
        </strong>

        {textbook.publisher && (
          <div
            style={{
              marginTop:
                "3px",
              color:
                "#8b96a6",
              fontSize:
                "9px",
            }}
          >
            {textbook.publisher}
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        padding:
          "23px",
        borderRadius:
          "18px",
        border:
          "1px solid #dbe4f0",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          color:
            "#4678b7",
          fontSize: "11px",
          fontWeight: 900,
          letterSpacing:
            "0.06em",
        }}
      >
        STEP {number}
      </div>

      <h3
        style={{
          margin:
            "9px 0 0",
          color:
            "#0A1F44",
          fontSize: "17px",
          fontWeight: 900,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin:
            "9px 0 0",
          color:
            "#69788d",
          fontSize: "12px",
          lineHeight: 1.75,
          wordBreak:
            "keep-all",
        }}
      >
        {description}
      </p>
    </div>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
}) {
  return (
    <div>
      <h5
        style={{
          margin: 0,
          color: "#ffffff",
          fontSize: "13px",
        }}
      >
        {title}
      </h5>

      <div
        style={{
          marginTop:
            "13px",
          display: "flex",
          flexDirection:
            "column",
          gap: "8px",
          color:
            "#9aa4c4",
          fontSize:
            "12.5px",
        }}
      >
        {items.map(
          ([label, href]) => (
            <Link
              key={`${title}-${label}`}
              href={href}
              style={{
                color:
                  "inherit",
                textDecoration:
                  "none",
              }}
            >
              {label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

const utilityLinkStyle = {
  color: "inherit",
  textDecoration: "none",
  opacity: 0.88,
};