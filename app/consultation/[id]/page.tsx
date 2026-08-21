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

export default async function ConsultationDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const inquiryId = Number(id);

  if (
    !Number.isInteger(inquiryId) ||
    inquiryId <= 0
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
    data: inquiry,
    error,
  } = await supabase
    .from("support_inquiries")
    .select(`
      id,
      user_id,
      category,
      title,
      content,
      status,
      admin_answer,
      answered_at,
      created_at,
      updated_at
    `)
    .eq("id", inquiryId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !inquiry) {
    notFound();
  }

  const answered =
    inquiry.status === "answered";

  return (
    <main
      style={{
        minHeight:
          "calc(100vh - 80px)",
        background:
          "linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)",
        padding: "64px 24px 96px",
      }}
    >
      <div
        style={{
          maxWidth: "880px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/consultation"
          style={{
            color: "#667085",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          ← 1:1 상담 목록
        </Link>

        <div
          style={{
            marginTop: "22px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: "30px",
                padding: "0 11px",
                borderRadius: "999px",
                background: "#edf4ff",
                color: "#2f6fed",
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing: "0.02em",
              }}
            >
              MY CONSULTATION
            </div>

            <h1
              style={{
                margin: "16px 0 0",
                color: "#0A1F44",
                fontSize: "36px",
                lineHeight: 1.25,
                letterSpacing: "-0.04em",
              }}
            >
              1:1 상담 상세
            </h1>
          </div>

          <StatusBadge
            status={inquiry.status}
          />
        </div>

        <article
          style={{
            marginTop: "28px",
            border: "1px solid #e4e7ec",
            borderRadius: "18px",
            background: "#ffffff",
            overflow: "hidden",
            boxShadow:
              "0 10px 30px rgba(10,31,68,.05)",
          }}
        >
          <div
            style={{
              padding: "28px 30px",
              borderBottom:
                "1px solid #eef1f5",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                flexWrap: "wrap",
              }}
            >
              <CategoryBadge
                category={inquiry.category}
              />

              <span
                style={{
                  color: "#98a2b3",
                  fontSize: "12px",
                }}
              >
                {new Date(
                  inquiry.created_at
                ).toLocaleString("ko-KR")}
              </span>
            </div>

            <h2
              style={{
                margin: "16px 0 0",
                color: "#101828",
                fontSize: "26px",
                lineHeight: 1.45,
                letterSpacing: "-0.025em",
                wordBreak: "keep-all",
              }}
            >
              {inquiry.title}
            </h2>
          </div>

          <div
            style={{
              padding: "30px",
            }}
          >
            <div
              style={{
                color: "#667085",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              문의 내용
            </div>

            <div
              style={{
                marginTop: "14px",
                color: "#344054",
                fontSize: "15px",
                lineHeight: 1.9,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {inquiry.content}
            </div>
          </div>
        </article>

        <section
          style={{
            marginTop: "22px",
            padding: "28px 30px",
            border: answered
              ? "1px solid #abefc6"
              : "1px solid #e4e7ec",
            borderRadius: "18px",
            background: answered
              ? "#f6fffa"
              : "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#101828",
                  fontSize: "20px",
                  fontWeight: 900,
                }}
              >
                TALKLY 답변
              </div>

              {answered &&
                inquiry.answered_at && (
                  <div
                    style={{
                      marginTop: "6px",
                      color: "#98a2b3",
                      fontSize: "12px",
                    }}
                  >
                    답변 등록{" "}
                    {new Date(
                      inquiry.answered_at
                    ).toLocaleString("ko-KR")}
                  </div>
                )}
            </div>

            <StatusBadge
              status={inquiry.status}
            />
          </div>

          {answered ? (
            <div
              style={{
                marginTop: "20px",
                paddingTop: "20px",
                borderTop:
                  "1px solid #d9f3e4",
                color: "#344054",
                fontSize: "15px",
                lineHeight: 1.9,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {inquiry.admin_answer ||
                "답변 내용이 없습니다."}
            </div>
          ) : (
            <div
              style={{
                marginTop: "18px",
                padding: "18px",
                borderRadius: "12px",
                background: "#f8fafc",
                color: "#667085",
                fontSize: "13px",
                lineHeight: 1.75,
              }}
            >
              문의를 확인 중입니다. 관리자가 답변을 등록하면
              이 화면에서 확인할 수 있습니다.
            </div>
          )}
        </section>

        <div
          style={{
            marginTop: "24px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={secondaryButtonStyle}
          >
            ← TALKLY 홈
          </Link>

          <Link
            href="/consultation"
            style={primaryButtonStyle}
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}

function CategoryBadge({
  category,
}: {
  category: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "28px",
        padding: "0 9px",
        borderRadius: "999px",
        background: "#eef4ff",
        color: "#2f6fed",
        fontSize: "11px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {category}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const answered =
    status === "answered";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "30px",
        padding: "0 10px",
        borderRadius: "999px",
        background: answered
          ? "#ecfdf3"
          : "#fff7ed",
        color: answered
          ? "#027a48"
          : "#b54708",
        fontSize: "11px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {answered
        ? "답변완료"
        : "답변대기"}
    </span>
  );
}

const primaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
  background: "#0A1F44",
  color: "#ffffff",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 900,
};

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d6deea",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};