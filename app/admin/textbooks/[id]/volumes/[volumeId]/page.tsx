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
    volumeId: string;
  }>;
};

export default async function TextbookVolumePage({
  params,
}: PageProps) {
  const {
    id,
    volumeId,
  } =
    await params;

  const textbookId =
    Number(id);

  const parsedVolumeId =
    Number(volumeId);

  if (
    !Number.isInteger(
      textbookId
    ) ||
    textbookId <= 0 ||
    !Number.isInteger(
      parsedVolumeId
    ) ||
    parsedVolumeId <= 0
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
   * 대표교재 + Volume 조회
   * =========================================================
   */
  const adminClient =
    createAdminClient();

  const [
    textbookResult,
    volumeResult,
    pageCountResult,
  ] =
    await Promise.all([
      adminClient
        .from("textbooks")
        .select(`
          id,
          title,
          publisher
        `)
        .eq(
          "id",
          textbookId
        )
        .maybeSingle(),

      adminClient
        .from(
          "textbook_volumes"
        )
        .select(`
          id,
          textbook_id,
          volume_code,
          display_title,
          sort_order,
          original_file_url,
          original_file_type,
          page_count,
          status,
          is_active,
          created_at,
          updated_at
        `)
        .eq(
          "id",
          parsedVolumeId
        )
        .eq(
          "textbook_id",
          textbookId
        )
        .maybeSingle(),

      adminClient
        .from(
          "textbook_pages"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "volume_id",
          parsedVolumeId
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
    volumeResult.error
  ) {
    throw new Error(
      volumeResult.error.message
    );
  }

  if (
    pageCountResult.error
  ) {
    throw new Error(
      pageCountResult.error.message
    );
  }

  const textbook =
    textbookResult.data;

  const volume =
    volumeResult.data;

  if (
    !textbook ||
    !volume
  ) {
    notFound();
  }

  return (
    <main
      style={{
        width: "100%",
        maxWidth:
          "1040px",
        margin:
          "0 auto",
        padding:
          "54px 42px 90px",
      }}
    >
      <Link
        href={`/admin/textbooks/${textbook.id}/edit`}
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
        ← 교재 수정
      </Link>

      <div
        style={{
          marginTop:
            "22px",
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
          TEXTBOOK VOLUME
        </div>

        <h1
          style={{
            margin:
              "10px 0 0",
            color:
              "#101828",
            fontSize:
              "36px",
            lineHeight:
              1.2,
            letterSpacing:
              "-0.04em",
          }}
        >
          {
            volume.display_title
          }
        </h1>

        <p
          style={{
            margin:
              "13px 0 0",
            color:
              "#667085",
            fontSize:
              "14px",
            lineHeight:
              1.7,
          }}
        >
          대표 교재{" "}
          <strong
            style={{
              color:
                "#344054",
            }}
          >
            {textbook.title}
          </strong>
          의 권별 수업자료를
          관리합니다.
        </p>
      </div>

      <section
        style={{
          marginTop:
            "26px",
          padding:
            "20px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "14px",
          background:
            "#ffffff",
        }}
      >
        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
          }}
        >
          <InfoCard
            label="Volume"
            value={
              volume.volume_code
            }
          />

          <InfoCard
            label="PDF"
            value={
              volume.original_file_url
                ? "등록"
                : "미등록"
            }
          />

          <InfoCard
            label="페이지"
            value={`${volume.page_count}페이지`}
          />

          <InfoCard
            label="페이지 데이터"
            value={`${pageCountResult.count ?? 0}건`}
          />

          <InfoCard
            label="상태"
            value={
              volume.status ===
              "ready"
                ? "사용 가능"
                : "작업 중"
            }
          />
        </div>
      </section>

      <section
        style={{
          marginTop:
            "20px",
          padding:
            "24px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "14px",
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
              "18px",
          }}
        >
          수업자료 관리
        </h2>

        <p
          style={{
            margin:
              "9px 0 0",
            color:
              "#667085",
            fontSize:
              "12px",
            lineHeight:
              1.7,
          }}
        >
          다음 단계에서 이
          화면에 권별 PDF 등록,
          페이지 생성, MP3 ZIP
          등록 및 Hotspot 자동
          매칭 기능을 연결합니다.
        </p>

        <div
          style={{
            marginTop:
              "20px",
            padding:
              "18px",
            border:
              "1px dashed #d0d5dd",
            borderRadius:
              "11px",
            background:
              "#f9fafb",
            color:
              "#667085",
            fontSize:
              "12px",
            lineHeight:
              1.8,
          }}
        >
          <strong
            style={{
              color:
                "#344054",
            }}
          >
            현재 단계
          </strong>
          <br />
          PDF 업로드: 다음 단계
          <br />
          MP3 ZIP 업로드: 다음 단계
          <br />
          E-Book 페이지 생성: 다음 단계
          <br />
          Audio Hotspot 자동 매칭: 다음 단계
        </div>

        {volume.original_file_url && (
          <div
            style={{
              marginTop:
                "16px",
              padding:
                "12px",
              borderRadius:
                "9px",
              background:
                "#f8fafc",
              color:
                "#667085",
              fontSize:
                "10px",
              lineHeight:
                1.6,
              wordBreak:
                "break-all",
            }}
          >
            Storage path:{" "}
            {
              volume.original_file_url
            }
          </div>
        )}
      </section>
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
            "16px",
          fontWeight:
            900,
        }}
      >
        {value}
      </div>
    </div>
  );
}