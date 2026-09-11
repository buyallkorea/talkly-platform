import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import HomeAuthMenu from "@/components/HomeAuthMenu";
import { createAdminClient } from "@/lib/supabase-admin";

export const revalidate = 300;

const CATEGORY_LABELS: Record<string, string> = {
  course_book: "Course Book",
  phonics: "Phonics",
  reading: "Reading",
  speaking: "Speaking",
  writing: "Writing",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  adult: "Adult",
};

const CATEGORY_KOREAN: Record<string, string> = {
  course_book: "종합영어",
  phonics: "파닉스",
  reading: "리딩",
  speaking: "스피킹",
  writing: "라이팅",
  grammar: "그래머",
  vocabulary: "보카",
  adult: "성인영어",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PublicTextbookDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const textbookId = Number(id);

  if (!Number.isInteger(textbookId) || textbookId <= 0) {
    notFound();
  }

  const adminClient = createAdminClient();

  const { data: textbook, error: textbookError } =
    await adminClient
      .from("textbooks")
      .select(`
        id,
        title,
        publisher,
        category,
        description,
        cover_image_url,
        status,
        is_active
      `)
      .eq("id", textbookId)
      .eq("is_active", true)
      .eq("status", "ready")
      .maybeSingle();

  if (textbookError) {
    console.error(
      "PUBLIC TEXTBOOK DETAIL LOAD ERROR:",
      textbookError
    );
    throw new Error("교재 정보를 불러오지 못했습니다.");
  }

  if (!textbook) {
    notFound();
  }

  const { data: mappings, error: mappingError } =
    await adminClient
      .from("curriculum_level_textbooks")
      .select(`
        curriculum_level_id,
        curriculum_levels (
          id,
          code,
          name,
          display_name,
          sort_order,
          is_active
        )
      `)
      .eq("textbook_id", textbookId)
      .eq("is_active", true);

  if (mappingError) {
    console.error(
      "PUBLIC TEXTBOOK GRADE LOAD ERROR:",
      mappingError
    );
    throw new Error("교재 Grade 정보를 불러오지 못했습니다.");
  }

  const levels = (mappings ?? [])
    .map((row: any) => {
      const value = Array.isArray(row.curriculum_levels)
        ? row.curriculum_levels[0]
        : row.curriculum_levels;
      return value;
    })
    .filter((level: any) => level?.is_active)
    .sort(
      (a: any, b: any) =>
        (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );

  let coverSignedUrl: string | null = null;

  if (textbook.cover_image_url) {
    const { data, error } = await adminClient.storage
      .from("textbook-files")
      .createSignedUrl(textbook.cover_image_url, 60 * 60);

    if (error) {
      console.error(
        `PUBLIC TEXTBOOK COVER SIGNED URL ERROR (${textbook.id}):`,
        error.message
      );
    } else {
      coverSignedUrl = data?.signedUrl ?? null;
    }
  }

  const category = textbook.category ?? "";
  const categoryEnglish =
    CATEGORY_LABELS[category] || category || "Textbook";
  const categoryKorean =
    CATEGORY_KOREAN[category] || "교재";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fafaf7",
        color: "#1b2a4a",
      }}
    >
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
            width: "min(1200px, calc(100% - 36px))",
            minHeight: "36px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <Link href="/level-test" style={utilityLinkStyle}>
            레벨테스트신청
          </Link>
          <span style={{ opacity: 0.25 }}>|</span>
          <Link href="/enroll" style={utilityLinkStyle}>
            수강신청
          </Link>
          <span style={{ opacity: 0.25 }}>|</span>
          <Link href="/consultation" style={utilityLinkStyle}>
            1:1상담
          </Link>
        </div>
      </div>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e7e9f0",
        }}
      >
        <div
          className="talkly-main-header"
          style={{
            width: "min(1200px, calc(100% - 36px))",
            minHeight: "82px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "260px 1fr auto",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <Link
            href="/"
            aria-label="TALKLY 홈"
            style={{
              display: "inline-flex",
              alignItems: "center",
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
                objectFit: "contain",
              }}
            />
          </Link>

          <nav
            className="talkly-desktop-nav"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "5px",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            <Link href="/#greeting" className="talkly-nav-link">
              토클리소개
            </Link>
            <Link href="/curriculum" className="talkly-nav-link">
              커리큘럼/교재
            </Link>
            <Link href="/#ai" className="talkly-nav-link">
              TALKLY AI
            </Link>
            <Link href="/level-test" className="talkly-nav-link">
              레벨테스트
            </Link>
            <Link href="/enroll" className="talkly-nav-link">
              수강신청
            </Link>
            <Link href="/notice" className="talkly-nav-link">
              인포메이션
            </Link>
          </nav>

          <HomeAuthMenu />
        </div>
      </header>

      <section
        style={{
          padding: "38px 20px 0",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1100px",
            margin: "0 auto",
          }}
        >
          <Link
            href="/curriculum"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "#4d6380",
              fontSize: "13px",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            ← 커리큘럼/교재
          </Link>
        </div>
      </section>

      <section
        style={{
          padding: "22px 20px 78px",
        }}
      >
        <div
          className="talkly-book-detail"
          style={{
            width: "100%",
            maxWidth: "1100px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns:
              "minmax(240px, 340px) minmax(0, 1fr)",
            gap: "46px",
            alignItems: "start",
            padding: "38px",
            borderRadius: "28px",
            background: "#ffffff",
            border: "1px solid #dfe7f2",
            boxShadow: "0 18px 48px rgba(10,31,68,0.08)",
          }}
        >
          <div>
            <div
              style={{
                width: "100%",
                aspectRatio: "3 / 4",
                overflow: "hidden",
                borderRadius: "20px",
                border: "1px solid #dce4ef",
                background:
                  "linear-gradient(145deg, #e8f0fc 0%, #f7faff 100%)",
                boxShadow: "0 12px 30px rgba(10,31,68,0.08)",
              }}
            >
              {coverSignedUrl ? (
                <img
                  src={coverSignedUrl}
                  alt={`${textbook.title} 교재 표지`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                    background: "#ffffff",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#5678a6",
                    fontSize: "18px",
                    lineHeight: 1.35,
                    fontWeight: 900,
                    textAlign: "center",
                  }}
                >
                  TALKLY
                  <br />
                  BOOK
                </div>
              )}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span style={categoryBadgeStyle}>
                {categoryEnglish}
              </span>
              <span style={softBadgeStyle}>
                {categoryKorean}
              </span>
            </div>

            <h1
              style={{
                margin: "18px 0 0",
                color: "#0A1F44",
                fontSize: "clamp(30px, 5vw, 46px)",
                lineHeight: 1.2,
                letterSpacing: "-0.04em",
                fontWeight: 900,
                wordBreak: "keep-all",
              }}
            >
              {textbook.title}
            </h1>

            {textbook.publisher && (
              <div
                style={{
                  marginTop: "12px",
                  color: "#68788d",
                  fontSize: "15px",
                  fontWeight: 700,
                }}
              >
                출판사 · {textbook.publisher}
              </div>
            )}

            <div
              style={{
                marginTop: "30px",
                padding: "22px",
                borderRadius: "18px",
                background: "#f7faff",
                border: "1px solid #e0e9f5",
              }}
            >
              <div
                style={{
                  color: "#315f9c",
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing: "0.07em",
                }}
              >
                TALKLY GRADE
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "12px",
                }}
              >
                {levels.length > 0 ? (
                  levels.map((level: any) => (
                    <span
                      key={level.id}
                      title={level.display_name || level.name}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "999px",
                        background: "#ffffff",
                        border: "1px solid #cadcf4",
                        color: "#2e619f",
                        fontSize: "11px",
                        fontWeight: 900,
                      }}
                    >
                      {level.name}
                    </span>
                  ))
                ) : (
                  <span
                    style={{
                      color: "#8491a3",
                      fontSize: "13px",
                    }}
                  >
                    적용 Grade 정보 준비 중
                  </span>
                )}
              </div>

              <p
                style={{
                  margin: "14px 0 0",
                  color: "#748398",
                  fontSize: "12px",
                  lineHeight: 1.7,
                  wordBreak: "keep-all",
                }}
              >
                TALKLY Grade는 실제 학교 학년이 아니라 영어
                실력 수준을 나타내는 커리큘럼 기준입니다.
              </p>
            </div>

            <section
              style={{
                marginTop: "30px",
              }}
            >
              <div
                style={{
                  color: "#2f67b2",
                  fontSize: "11px",
                  fontWeight: 900,
                  letterSpacing: "0.07em",
                }}
              >
                ABOUT THIS BOOK
              </div>
              <h2
                style={{
                  margin: "7px 0 0",
                  color: "#172b4d",
                  fontSize: "21px",
                  fontWeight: 900,
                }}
              >
                교재 소개
              </h2>

              <p
                style={{
                  margin: "14px 0 0",
                  color: "#53647a",
                  fontSize: "14px",
                  lineHeight: 1.9,
                  whiteSpace: "pre-wrap",
                  wordBreak: "keep-all",
                }}
              >
                {textbook.description?.trim() ||
                  "교재 상세 설명을 준비 중입니다."}
              </p>
            </section>

            <div
              style={{
                marginTop: "34px",
                padding: "18px 20px",
                borderRadius: "16px",
                background: "#fffaf0",
                border: "1px solid #f0dfb8",
                color: "#725a27",
                fontSize: "12px",
                lineHeight: 1.75,
                wordBreak: "keep-all",
              }}
            >
              이 페이지는 TALKLY에서 활용하는 교재의 교육
              정보를 안내합니다. 학생별 실제 수업 교재는
              레벨테스트 결과, 학습 목표 및 수강 계획을
              종합하여 관리자가 별도로 배정합니다.
            </div>
          </div>
        </div>
      </section>

      <footer
        style={{
          background: "#1b2a4a",
          color: "#c6cde3",
          padding: "34px 20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            fontSize: "12px",
          }}
        >
          <span>© 2026 TALKLY. All rights reserved.</span>
          <span>언제 어디서나 톡.</span>
        </div>
      </footer>

      <style>{`
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

        @media (max-width: 1040px) {
          .talkly-main-header {
            grid-template-columns: 190px 1fr auto !important;
          }

          .talkly-desktop-nav {
            display: none !important;
          }
        }

        @media (max-width: 760px) {
          .talkly-utility {
            display: none !important;
          }

          .talkly-main-header {
            grid-template-columns: 1fr auto !important;
          }

          .talkly-main-header img {
            height: 46px !important;
          }

          .talkly-book-detail {
            grid-template-columns: 1fr !important;
            padding: 22px !important;
            gap: 26px !important;
          }

          .talkly-book-detail > div:first-child {
            max-width: 310px;
            width: 100%;
            margin: 0 auto;
          }
        }
      `}</style>
    </main>
  );
}

const utilityLinkStyle = {
  color: "inherit",
  textDecoration: "none",
  opacity: 0.88,
};

const categoryBadgeStyle = {
  display: "inline-flex",
  padding: "7px 10px",
  borderRadius: "999px",
  background: "#e8f1ff",
  color: "#2f67b2",
  fontSize: "11px",
  fontWeight: 900,
};

const softBadgeStyle = {
  display: "inline-flex",
  padding: "7px 10px",
  borderRadius: "999px",
  background: "#f1f4f8",
  color: "#65758a",
  fontSize: "11px",
  fontWeight: 800,
};