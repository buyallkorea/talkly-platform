import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase-server";

import {
  createAdminClient,
} from "@/lib/supabase-admin";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type CurriculumLevel = {
  id: number;
  code: string;
  name: string;
  display_name: string | null;
  sort_order: number | null;
};

type CurriculumMapping = {
  curriculum_level_id: number;
  textbook_id: number;
  is_active: boolean;
};

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

export default async function TextbookDetailPage({
  params,
}: PageProps) {
  const { id } =
    await params;

  const textbookId =
    Number(id);

  if (
    !Number.isInteger(
      textbookId
    ) ||
    textbookId <= 0
  ) {
    notFound();
  }

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
   * 관리자 데이터 조회
   * =========================================================
   */
  const adminClient =
    createAdminClient();

  const [
    textbookResult,
    pageCountResult,
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
        .eq(
          "id",
          textbookId
        )
        .maybeSingle(),

      adminClient
        .from(
          "textbook_pages"
        )
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "textbook_id",
          textbookId
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
          sort_order
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
          is_active
        `)
        .eq(
          "textbook_id",
          textbookId
        ),
    ]);

  if (
    textbookResult.error
  ) {
    throw new Error(
      textbookResult.error.message
    );
  }

  if (
    pageCountResult.error
  ) {
    throw new Error(
      pageCountResult.error.message
    );
  }

  if (
    levelsResult.error
  ) {
    throw new Error(
      levelsResult.error.message
    );
  }

  if (
    mappingsResult.error
  ) {
    throw new Error(
      mappingsResult.error.message
    );
  }

  const textbook =
    textbookResult.data;

  if (!textbook) {
    notFound();
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
    ) as CurriculumMapping[];

  /*
   * =========================================================
   * 적용 Grade 정리
   * =========================================================
   */
  const activeLevelIds =
    new Set(
      mappings
        .filter(
          (mapping) =>
            mapping.is_active
        )
        .map(
          (mapping) =>
            mapping.curriculum_level_id
        )
    );

  const assignedLevels =
    levels.filter(
      (level) =>
        activeLevelIds.has(
          level.id
        )
    );

  /*
   * =========================================================
   * 표지 Signed URL 생성
   * =========================================================
   */
  let coverImageUrl:
    | string
    | null = null;

  if (
    textbook.cover_image_url
  ) {
    const {
      data:
        signedCoverData,
      error:
        signedCoverError,
    } =
      await adminClient.storage
        .from(
          "textbook-files"
        )
        .createSignedUrl(
          textbook.cover_image_url,
          60 * 60
        );

    if (
      signedCoverError
    ) {
      console.error(
        "TEXTBOOK COVER SIGNED URL ERROR:",
        signedCoverError
      );
    }

    coverImageUrl =
      signedCoverData?.signedUrl ??
      null;
  }

  const categoryCode =
    textbook.category ||
    "other";

  const categoryLabel =
    CATEGORY_LABELS[
      categoryCode
    ] ||
    categoryCode;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1080px",
        margin: "0 auto",
        padding:
          "54px 42px 90px",
      }}
    >
      {/* =====================================
          뒤로가기
      ====================================== */}
      <Link
        href="/admin/textbooks"
        style={{
          color: "#667085",
          textDecoration:
            "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 교재 관리
      </Link>

      {/* =====================================
          페이지 제목
      ====================================== */}
      <div
        style={{
          marginTop: "22px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing:
                "0.08em",
            }}
          >
            TEXTBOOK DETAIL
          </div>

          <h1
            style={{
              margin:
                "10px 0 0",
              color: "#101828",
              fontSize: "36px",
              lineHeight: 1.2,
              letterSpacing:
                "-0.04em",
            }}
          >
            {textbook.title}
          </h1>

          <p
            style={{
              margin:
                "13px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            교재 기본정보,
            커리큘럼 연결,
            판매정보 및 수업용
            콘텐츠 상태를
            관리합니다.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems:
              "center",
            flexWrap: "wrap",
          }}
        >
          <CategoryBadge
            label={
              categoryLabel
            }
          />

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

          <FileTypeBadge
            type={
              textbook.original_file_type
            }
          />
        </div>
      </div>

      {/* =====================================
          핵심 교재 정보
      ====================================== */}
      <section
        style={{
          marginTop: "28px",
          padding: "24px",
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
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color:
                  "#101828",
                fontSize:
                  "19px",
              }}
            >
              교재 정보
            </h2>

            <p
              style={{
                margin:
                  "6px 0 0",
                color:
                  "#98a2b3",
                fontSize:
                  "12px",
              }}
            >
              현재 등록되어 있는
              교재 마스터 정보입니다.
            </p>
          </div>

          <Link
            href={`/admin/textbooks/${textbook.id}/edit`}
            style={{
              minHeight: "40px",
              padding:
                "0 14px",
              display:
                "inline-flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              border:
                "1px solid #d0d5dd",
              borderRadius:
                "9px",
              background:
                "#ffffff",
              color:
                "#344054",
              textDecoration:
                "none",
              fontSize:
                "12px",
              fontWeight:
                900,
            }}
          >
            교재 정보 수정
          </Link>
        </div>

        <div
          style={{
            marginTop: "22px",
            display: "grid",
            gridTemplateColumns:
              "190px minmax(0, 1fr)",
            gap: "26px",
            alignItems:
              "start",
          }}
        >
          {/* =================================
              표지
          ================================== */}
          <div>
            <div
              style={{
                width: "190px",
                aspectRatio:
                  "3 / 4",
                border:
                  "1px solid #e4e7ec",
                borderRadius:
                  "12px",
                overflow:
                  "hidden",
                background:
                  "#f8fafc",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
              }}
            >
              {coverImageUrl ? (
                <img
                  src={
                    coverImageUrl
                  }
                  alt={`${textbook.title} 표지`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit:
                      "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding:
                      "18px",
                    textAlign:
                      "center",
                    color:
                      "#98a2b3",
                    fontSize:
                      "12px",
                    lineHeight:
                      1.6,
                  }}
                >
                  표지 이미지
                  미등록
                </div>
              )}
            </div>

            <div
              style={{
                marginTop:
                  "8px",
                textAlign:
                  "center",
                color:
                  coverImageUrl
                    ? "#667085"
                    : "#b1b8c4",
                fontSize:
                  "10px",
              }}
            >
              {coverImageUrl
                ? "등록된 교재 표지"
                : "수정 화면에서 표지 등록 가능"}
            </div>
          </div>

          {/* =================================
              INFO
          ================================== */}
          <div
            style={{
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "16px",
              }}
            >
              <InfoItem
                label="출판사"
                value={
                  textbook.publisher ||
                  "미등록"
                }
              />

              <InfoItem
                label="교재 분야"
                value={
                  categoryLabel
                }
              />

              <InfoItem
                label="상태"
                value={getStatusLabel(
                  textbook.status
                )}
              />

              <InfoItem
                label="운영 상태"
                value={
                  textbook.is_active
                    ? "활성"
                    : "비활성"
                }
              />

              <InfoItem
                label="등록일"
                value={formatDateTime(
                  textbook.created_at
                )}
              />

              <InfoItem
                label="수정일"
                value={formatDateTime(
                  textbook.updated_at
                )}
              />
            </div>

            {/* 설명 */}
            <div
              style={{
                marginTop:
                  "22px",
                padding:
                  "18px",
                border:
                  "1px solid #e4e7ec",
                borderRadius:
                  "11px",
                background:
                  "#f9fafb",
              }}
            >
              <div
                style={{
                  color:
                    "#667085",
                  fontSize:
                    "11px",
                  fontWeight:
                    900,
                }}
              >
                교재 설명
              </div>

              <div
                style={{
                  marginTop:
                    "9px",
                  color:
                    "#344054",
                  fontSize:
                    "13px",
                  lineHeight:
                    1.8,
                  whiteSpace:
                    "pre-wrap",
                }}
              >
                {textbook.description ||
                  "등록된 설명이 없습니다."}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================
          TALKLY GRADE
      ====================================== */}
      <section
        style={{
          marginTop: "22px",
          padding: "24px",
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
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color:
                  "#101828",
                fontSize:
                  "19px",
              }}
            >
              적용 TALKLY Grade
            </h2>

            <p
              style={{
                margin:
                  "7px 0 0",
                color:
                  "#98a2b3",
                fontSize:
                  "12px",
                lineHeight:
                  1.6,
              }}
            >
              학생의 실제 학교
              학년이 아닌 영어
              실력 기준
              커리큘럼입니다.
            </p>
          </div>

          <div
            style={{
              color:
                "#667085",
              fontSize:
                "12px",
              fontWeight:
                800,
            }}
          >
            총{" "}
            <strong
              style={{
                color:
                  "#0A1F44",
              }}
            >
              {
                assignedLevels.length
              }
              개
            </strong>
          </div>
        </div>

        {assignedLevels.length >
        0 ? (
          <div
            style={{
              marginTop:
                "18px",
              display:
                "flex",
              gap: "8px",
              flexWrap:
                "wrap",
            }}
          >
            {assignedLevels.map(
              (level) => (
                <div
                  key={
                    level.id
                  }
                  style={{
                    padding:
                      "9px 12px",
                    borderRadius:
                      "10px",
                    border:
                      "1px solid #dbe5f4",
                    background:
                      "#f5f8fd",
                  }}
                >
                  <div
                    style={{
                      color:
                        "#0A1F44",
                      fontSize:
                        "12px",
                      fontWeight:
                        900,
                    }}
                  >
                    {
                      level.code
                    }
                  </div>

                  <div
                    style={{
                      marginTop:
                        "3px",
                      color:
                        "#7b8494",
                      fontSize:
                        "10px",
                    }}
                  >
                    {level.display_name ||
                      level.name}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div
            style={{
              marginTop:
                "18px",
              padding:
                "16px",
              border:
                "1px dashed #d0d5dd",
              borderRadius:
                "10px",
              color:
                "#98a2b3",
              fontSize:
                "12px",
            }}
          >
            연결된 TALKLY Grade가
            없습니다.
          </div>
        )}
      </section>

      {/* =====================================
          판매 정보
      ====================================== */}
      <section
        style={{
          marginTop: "22px",
          padding: "24px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "16px",
          background:
            "#ffffff",
        }}
      >
        <h2
          style={{
            margin: 0,
            color:
              "#101828",
            fontSize:
              "19px",
          }}
        >
          교재 판매 정보
        </h2>

        <p
          style={{
            margin:
              "7px 0 0",
            color:
              "#98a2b3",
            fontSize:
              "12px",
            lineHeight:
              1.6,
          }}
        >
          교재비는 수강료와
          별도로 결제됩니다.
        </p>

        <div
          style={{
            marginTop:
              "18px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          <InfoCard
            label="TALKLY 판매"
            value={
              textbook.is_for_sale
                ? "판매"
                : "판매 안 함"
            }
          />

          <InfoCard
            label="판매가격"
            value={
              textbook.is_for_sale
                ? textbook.sale_price !==
                  null
                  ? `${Number(
                      textbook.sale_price
                    ).toLocaleString(
                      "ko-KR"
                    )}원`
                  : "가격 미등록"
                : "-"
            }
          />

          <InfoCard
            label="외부 참고 URL"
            value={
              textbook.external_purchase_url
                ? "등록됨"
                : "미등록"
            }
          />
        </div>

        {textbook.external_purchase_url && (
          <div
            style={{
              marginTop:
                "14px",
              padding:
                "12px 14px",
              borderRadius:
                "10px",
              background:
                "#f9fafb",
              color:
                "#667085",
              fontSize:
                "11px",
              lineHeight:
                1.6,
              wordBreak:
                "break-all",
            }}
          >
            관리자 참고 URL:{" "}
            {
              textbook.external_purchase_url
            }
          </div>
        )}
      </section>

      {/* =====================================
          교재 원본 파일
      ====================================== */}
      <section
        style={{
          marginTop: "22px",
          padding: "24px",
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
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color:
                  "#101828",
                fontSize:
                  "19px",
              }}
            >
              수업용 원본 콘텐츠
            </h2>

            <p
              style={{
                margin:
                  "7px 0 0",
                color:
                  "#98a2b3",
                fontSize:
                  "12px",
                lineHeight:
                  1.6,
              }}
            >
              원본 PDF·eBook과
              TALKLY Viewer 상태를
              확인합니다.
            </p>
          </div>

          {textbook.original_file_url && (
            <Link
              href={`/admin/textbooks/${textbook.id}/viewer`}
              style={
                primaryButtonStyle
              }
            >
              교재 Viewer 열기
            </Link>
          )}
        </div>

        <div
          style={{
            marginTop:
              "20px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
          }}
        >
          <ContentStatusCard
            label="원본 파일"
            value={
              textbook.original_file_url
                ? "등록 완료"
                : "미등록"
            }
            complete={
              Boolean(
                textbook.original_file_url
              )
            }
          />

          <ContentStatusCard
            label="파일 유형"
            value={
              textbook.original_file_type
                ? textbook.original_file_type.toUpperCase()
                : "미등록"
            }
            complete={
              Boolean(
                textbook.original_file_type
              )
            }
          />

          <ContentStatusCard
            label="DB 페이지"
            value={`${textbook.page_count ?? 0}페이지`}
            complete={
              (
                textbook.page_count ??
                0
              ) > 0
            }
          />

          <ContentStatusCard
            label="페이지 데이터"
            value={`${pageCountResult.count ?? 0}건`}
            complete={
              (
                pageCountResult.count ??
                0
              ) > 0
            }
          />
        </div>

        {textbook.original_file_url ? (
          <div
            style={{
              marginTop:
                "18px",
              padding:
                "14px",
              border:
                "1px solid #e4e7ec",
              borderRadius:
                "10px",
              background:
                "#f9fafb",
            }}
          >
            <div
              style={{
                color:
                  "#98a2b3",
                fontSize:
                  "10px",
                fontWeight:
                  900,
                letterSpacing:
                  "0.05em",
              }}
            >
              STORAGE PATH
            </div>

            <div
              style={{
                marginTop:
                  "7px",
                color:
                  "#667085",
                fontSize:
                  "11px",
                lineHeight:
                  1.6,
                wordBreak:
                  "break-all",
              }}
            >
              {
                textbook.original_file_url
              }
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop:
                "18px",
              padding:
                "14px",
              border:
                "1px solid #fecdca",
              borderRadius:
                "10px",
              background:
                "#fffbfa",
              color:
                "#b42318",
              fontSize:
                "12px",
              fontWeight:
                700,
            }}
          >
            등록된 원본 교재
            파일이 없습니다.
          </div>
        )}
      </section>

      {/* =====================================
          관리 안내
      ====================================== */}
      <section
        style={{
          marginTop: "22px",
          padding: "20px",
          border:
            "1px solid #dbe7ff",
          borderRadius:
            "14px",
          background:
            "#f5f8ff",
        }}
      >
        <div
          style={{
            color:
              "#2f6fed",
            fontSize:
              "13px",
            fontWeight:
              900,
          }}
        >
          교재 관리 원칙
        </div>

        <p
          style={{
            margin:
              "7px 0 0",
            color:
              "#667085",
            fontSize:
              "12px",
            lineHeight:
              1.7,
          }}
        >
          표지 이미지는
          교재 원본과 별도로
          관리합니다. 원본 파일
          교체는 기존
          textbook_pages와
          수업 Viewer에 영향을 줄
          수 있으므로 별도의 안전한
          교체 기능으로 처리합니다.
        </p>
      </section>

      {/* =====================================
          하단 버튼
      ====================================== */}
      <div
        style={{
          marginTop: "24px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin/textbooks"
          style={
            secondaryButtonStyle
          }
        >
          ← 교재 목록으로
        </Link>

        <div
          style={{
            display: "flex",
            gap: "9px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/admin/textbooks/${textbook.id}/edit`}
            style={
              secondaryButtonStyle
            }
          >
            교재 수정
          </Link>

          {textbook.original_file_url && (
            <Link
              href={`/admin/textbooks/${textbook.id}/viewer`}
              style={
                primaryButtonStyle
              }
            >
              교재 보기 →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function InfoItem({
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
          color: "#98a2b3",
          fontSize: "11px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#101828",
          fontSize: "14px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "15px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "10px",
        background:
          "#f9fafb",
      }}
    >
      <div
        style={{
          color: "#98a2b3",
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#101828",
          fontSize: "14px",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ContentStatusCard({
  label,
  value,
  complete,
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div
      style={{
        padding: "16px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "11px",
        background:
          "#f9fafb",
      }}
    >
      <div
        style={{
          color: "#98a2b3",
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          display: "flex",
          alignItems:
            "center",
          gap: "7px",
          color: complete
            ? "#027a48"
            : "#b54708",
          fontSize: "13px",
          fontWeight: 900,
        }}
      >
        <span>
          {complete
            ? "●"
            : "○"}
        </span>

        {value}
      </div>
    </div>
  );
}

function CategoryBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span
      style={{
        minHeight: "28px",
        padding: "0 9px",
        display:
          "inline-flex",
        alignItems:
          "center",
        borderRadius:
          "999px",
        background:
          "#eef4ff",
        color:
          "#315ea8",
        fontSize:
          "11px",
        fontWeight: 900,
      }}
    >
      {label}
    </span>
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
        minHeight: "28px",
        padding: "0 9px",
        display:
          "inline-flex",
        alignItems:
          "center",
        borderRadius:
          "999px",
        background: ready
          ? "#ecfdf3"
          : "#fff7ed",
        color: ready
          ? "#027a48"
          : "#b54708",
        fontSize:
          "11px",
        fontWeight: 900,
      }}
    >
      {getStatusLabel(
        status
      )}
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
        minHeight: "28px",
        padding: "0 9px",
        display:
          "inline-flex",
        alignItems:
          "center",
        borderRadius:
          "999px",
        background: active
          ? "#eef4ff"
          : "#f2f4f7",
        color: active
          ? "#315ea8"
          : "#667085",
        fontSize:
          "11px",
        fontWeight: 900,
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
  return (
    <span
      style={{
        minHeight: "28px",
        padding: "0 9px",
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
          "11px",
        fontWeight: 900,
      }}
    >
      {type?.toUpperCase() ||
        "NO FILE"}
    </span>
  );
}

function getStatusLabel(
  status: string
) {
  switch (status) {
    case "draft":
      return "작업 중";

    case "ready":
      return "사용 가능";

    default:
      return status;
  }
}

function formatDateTime(
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
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(
    new Date(value)
  );
}

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent:
    "center",
  border:
    "1px solid #d0d5dd",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};

const primaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent:
    "center",
  border: "none",
  borderRadius: "10px",
  background: "#0A1F44",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 900,
};