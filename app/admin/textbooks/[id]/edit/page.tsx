import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import EditTextbookForm from "./EditTextbookForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTextbookPage({
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
        maxWidth: "980px",
        margin: "0 auto",
        padding: "54px 42px 90px",
      }}
    >
      <Link
        href={`/admin/textbooks/${textbook.id}`}
        style={{
          color: "#667085",
          textDecoration: "none",
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
            TEXTBOOK MANAGEMENT
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
            교재 수정
          </h1>

          <p
            style={{
              margin: "13px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            <strong
              style={{
                color: "#344054",
              }}
            >
              {textbook.title}
            </strong>{" "}
            교재의 기본 정보와 상태를 관리합니다.
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

      <section
        style={{
          marginTop: "26px",
          padding: "18px 20px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#f9fafb",
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
              "repeat(4, minmax(0,1fr))",
            gap: "12px",
          }}
        >
          <InfoCard
            label="DB 페이지 수"
            value={`${textbook.page_count ?? 0}`}
          />

          <InfoCard
            label="페이지 데이터"
            value={`${pageCount ?? 0}`}
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
            label="상태"
            value={getStatusLabel(
              textbook.status
            )}
          />
        </div>
      </section>

      <EditTextbookForm
        textbook={textbook}
        pageDataCount={
          pageCount ?? 0
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
        border: "1px solid #e4e7ec",
        borderRadius: "10px",
        background: "#ffffff",
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
          fontSize: "21px",
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