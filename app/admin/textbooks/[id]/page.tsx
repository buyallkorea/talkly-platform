import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TextbookDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const textbookId = Number(id);

  if (
    !Number.isInteger(textbookId) ||
    textbookId <= 0
  ) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
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

  const {
    data: textbook,
    error: textbookError,
  } = await supabase
    .from("textbooks")
    .select(`
      id,
      title,
      description,
      original_file_url,
      original_file_type,
      page_count,
      status,
      created_at,
      updated_at
    `)
    .eq("id", textbookId)
    .maybeSingle();

  if (textbookError) {
    throw new Error(
      textbookError.message
    );
  }

  if (!textbook) {
    notFound();
  }

  const {
    count: pageCount,
    error: pageCountError,
  } = await supabase
    .from("textbook_pages")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("textbook_id", textbookId);

  if (pageCountError) {
    throw new Error(
      pageCountError.message
    );
  }

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "54px 42px 90px",
      }}
    >
      {/* 뒤로가기 */}
      <Link
        href="/admin/textbooks"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 교재 관리
      </Link>

      {/* 페이지 제목 */}
      <div
        style={{
          marginTop: "22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
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
              letterSpacing: "0.08em",
            }}
          >
            TEXTBOOK DETAIL
          </div>

          <h1
            style={{
              margin: "10px 0 0",
              color: "#101828",
              fontSize: "36px",
              lineHeight: 1.2,
              letterSpacing: "-0.04em",
            }}
          >
            {textbook.title}
          </h1>

          <p
            style={{
              margin: "13px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            등록된 교재의 기본 정보와
            콘텐츠 상태를 확인하고 관리합니다.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <StatusBadge
            status={textbook.status}
          />

          <FileTypeBadge
            type={
              textbook.original_file_type
            }
          />
        </div>
      </div>

      {/* 교재 기본 정보 */}
      <section
        style={{
          marginTop: "28px",
          padding: "24px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: "#101828",
                fontSize: "19px",
              }}
            >
              교재 정보
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                color: "#98a2b3",
                fontSize: "12px",
              }}
            >
              현재 등록되어 있는 교재의
              기본 정보입니다.
            </p>
          </div>

          <Link
            href={`/admin/textbooks/${textbook.id}/edit`}
            style={{
              minHeight: "40px",
              padding: "0 14px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#344054",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 900,
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
              "repeat(4, minmax(0, 1fr))",
            gap: "20px",
          }}
        >
          <InfoItem
            label="파일 유형"
            value={
              textbook.original_file_type
                ? textbook.original_file_type.toUpperCase()
                : "-"
            }
          />

          <InfoItem
            label="DB 페이지 수"
            value={`${
              textbook.page_count ?? 0
            }페이지`}
          />

          <InfoItem
            label="페이지 데이터"
            value={`${pageCount ?? 0}건`}
          />

          <InfoItem
            label="상태"
            value={getStatusLabel(
              textbook.status
            )}
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
            marginTop: "26px",
            padding: "20px",
            border: "1px solid #e4e7ec",
            borderRadius: "12px",
            background: "#f9fafb",
          }}
        >
          <div
            style={{
              color: "#667085",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            교재 설명
          </div>

          <div
            style={{
              marginTop: "10px",
              color: "#344054",
              fontSize: "14px",
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
            }}
          >
            {textbook.description ||
              "등록된 설명이 없습니다."}
          </div>
        </div>
      </section>

      {/* 교재 파일 */}
      <section
        style={{
          marginTop: "22px",
          padding: "24px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#101828",
            fontSize: "19px",
          }}
        >
          교재 파일
        </h2>

        <p
          style={{
            margin: "7px 0 0",
            color: "#98a2b3",
            fontSize: "12px",
            lineHeight: 1.6,
          }}
        >
          원본 파일 정보와 TALKLY 교재
          Viewer를 확인할 수 있습니다.
        </p>

        {/* 버튼 */}
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/admin/textbooks/${textbook.id}/viewer`}
            style={{
              minHeight: "44px",
              padding: "0 17px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9px",
              background: "#0A1F44",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            교재 Viewer 열기
          </Link>

          <Link
            href={`/admin/textbooks/${textbook.id}/edit`}
            style={{
              minHeight: "44px",
              padding: "0 17px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#344054",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            교재 수정
          </Link>
        </div>

        {/* Storage 경로 */}
        {textbook.original_file_url ? (
          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              border: "1px solid #e4e7ec",
              borderRadius: "10px",
              background: "#f9fafb",
            }}
          >
            <div
              style={{
                color: "#98a2b3",
                fontSize: "10px",
                fontWeight: 900,
                letterSpacing: "0.05em",
              }}
            >
              STORAGE PATH
            </div>

            <div
              style={{
                marginTop: "7px",
                color: "#667085",
                fontSize: "11px",
                lineHeight: 1.6,
                wordBreak: "break-all",
              }}
            >
              {textbook.original_file_url}
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              border: "1px solid #fecdca",
              borderRadius: "10px",
              background: "#fffbfa",
              color: "#b42318",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            등록된 원본 파일 경로가 없습니다.
          </div>
        )}
      </section>

      {/* 콘텐츠 상태 */}
      <section
        style={{
          marginTop: "22px",
          padding: "24px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#101828",
            fontSize: "19px",
          }}
        >
          콘텐츠 상태
        </h2>

        <div
          style={{
            marginTop: "18px",
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
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
              !!textbook.original_file_url
            }
          />

          <ContentStatusCard
            label="페이지 데이터"
            value={
              (pageCount ?? 0) > 0
                ? `${pageCount}건 생성`
                : "미생성"
            }
            complete={
              (pageCount ?? 0) > 0
            }
          />

          <ContentStatusCard
            label="교재 상태"
            value={getStatusLabel(
              textbook.status
            )}
            complete={
              textbook.status === "ready"
            }
          />
        </div>
      </section>

      {/* 관리 안내 */}
      <section
        style={{
          marginTop: "22px",
          padding: "20px",
          border: "1px solid #dbe7ff",
          borderRadius: "14px",
          background: "#f5f8ff",
        }}
      >
        <div
          style={{
            color: "#2f6fed",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          교재 관리
        </div>

        <p
          style={{
            margin: "7px 0 0",
            color: "#667085",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          교재명, 설명 및 사용 상태는
          교재 수정 화면에서 변경할 수 있습니다.
          원본 파일 교체와 영구 삭제는
          페이지 데이터 및 Storage 파일까지
          함께 관리하도록 별도의 안전한 기능으로
          처리합니다.
        </p>
      </section>

      {/* 하단 버튼 */}
      <div
        style={{
          marginTop: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin/textbooks"
          style={secondaryButtonStyle}
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
            style={secondaryButtonStyle}
          >
            교재 수정
          </Link>

          <Link
            href={`/admin/textbooks/${textbook.id}/viewer`}
            style={primaryButtonStyle}
          >
            교재 보기 →
          </Link>
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
        border: "1px solid #e4e7ec",
        borderRadius: "11px",
        background: "#f9fafb",
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
          alignItems: "center",
          gap: "7px",
          color: complete
            ? "#027a48"
            : "#b54708",
          fontSize: "13px",
          fontWeight: 900,
        }}
      >
        <span>
          {complete ? "●" : "○"}
        </span>

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
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
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
      {getStatusLabel(status)}
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
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: "#eef4ff",
        color: "#2f6fed",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {type?.toUpperCase() || "FILE"}
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
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(new Date(value));
}

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d0d5dd",
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
  justifyContent: "center",
  border: "none",
  borderRadius: "10px",
  background: "#0A1F44",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 900,
};