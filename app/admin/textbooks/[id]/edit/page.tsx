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

import EditTextbookForm from "./EditTextbookForm";

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
  is_active: boolean;
};

type CurriculumMapping = {
  curriculum_level_id: number;
  textbook_id: number;
  is_active: boolean;
};

export default async function EditTextbookPage({
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
   * 실제 관리자 데이터 조회
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

  const curriculumLevels =
    (
      levelsResult.data ??
      []
    ) as CurriculumLevel[];

  const curriculumMappings =
    (
      mappingsResult.data ??
      []
    ) as CurriculumMapping[];

  /*
   * 현재 활성화된 Grade 연결
   */
  const selectedCurriculumLevelIds =
    curriculumMappings
      .filter(
        (mapping) =>
          mapping.is_active
      )
      .map(
        (mapping) =>
          mapping.curriculum_level_id
      );

  /*
   * 표지 이미지는 Storage path를 DB에 저장합니다.
   * 관리자 수정화면 표시를 위해
   * 임시 Signed URL을 생성합니다.
   */
  let coverImagePreviewUrl:
    | string
    | null = null;

  if (
    textbook.cover_image_url
  ) {
    const {
      data:
        signedCoverData,
    } =
      await adminClient.storage
        .from(
          "textbook-files"
        )
        .createSignedUrl(
          textbook.cover_image_url,
          60 * 60
        );

    coverImagePreviewUrl =
      signedCoverData?.signedUrl ??
      null;
  }

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1040px",
        margin: "0 auto",
        padding:
          "54px 42px 90px",
      }}
    >
      <Link
        href={`/admin/textbooks/${textbook.id}`}
        style={{
          color: "#667085",
          textDecoration:
            "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 교재 상세
      </Link>

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
            TEXTBOOK MANAGEMENT
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
            교재 수정
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
            <strong
              style={{
                color:
                  "#344054",
              }}
            >
              {textbook.title}
            </strong>{" "}
            교재의 기본정보,
            표지, 판매정보 및
            커리큘럼 연결을
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

      <section
        style={{
          marginTop: "26px",
          padding:
            "18px 20px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "14px",
          background:
            "#f9fafb",
        }}
      >
        <div
          style={{
            color: "#101828",
            fontSize: "14px",
            fontWeight: 900,
          }}
        >
          현재 교재 현황
        </div>

        <div
          style={{
            marginTop: "14px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
          }}
        >
          <InfoCard
            label="DB 페이지 수"
            value={`${textbook.page_count ?? 0}`}
          />

          <InfoCard
            label="페이지 데이터"
            value={`${pageCountResult.count ?? 0}`}
          />

          <InfoCard
            label="파일 유형"
            value={
              textbook.original_file_type
                ? textbook.original_file_type.toUpperCase()
                : "-"
            }
          />

          <InfoCard
            label="적용 Grade"
            value={`${selectedCurriculumLevelIds.length}개`}
          />

          <InfoCard
            label="판매"
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
                : "판매 안 함"
            }
          />
        </div>
      </section>

      <EditTextbookForm
        textbook={{
          ...textbook,
          page_count:
            textbook.page_count ??
            0,
        }}
        pageDataCount={
          pageCountResult.count ??
          0
        }
        curriculumLevels={
          curriculumLevels
        }
        selectedCurriculumLevelIds={
          selectedCurriculumLevelIds
        }
        coverImagePreviewUrl={
          coverImagePreviewUrl
        }
      />
    </main>
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
        padding: "14px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "10px",
        background:
          "#ffffff",
      }}
    >
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
          fontSize: "20px",
          fontWeight: 900,
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
        minHeight: "28px",
        padding: "0 9px",
        display:
          "inline-flex",
        alignItems: "center",
        borderRadius:
          "999px",
        background: ready
          ? "#ecfdf3"
          : "#fff7ed",
        color: ready
          ? "#027a48"
          : "#b54708",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {ready
        ? "사용 가능"
        : status === "draft"
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
        minHeight: "28px",
        padding: "0 9px",
        display:
          "inline-flex",
        alignItems: "center",
        borderRadius:
          "999px",
        background: active
          ? "#eef4ff"
          : "#f2f4f7",
        color: active
          ? "#315ea8"
          : "#667085",
        fontSize: "11px",
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
        alignItems: "center",
        borderRadius:
          "999px",
        background:
          "#f4f3ff",
        color: "#6938ef",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {type?.toUpperCase() ||
        "NO FILE"}
    </span>
  );
}