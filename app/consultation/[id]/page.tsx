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

  const inquiryId =
    Number(id);

  if (
    !Number.isInteger(
      inquiryId
    ) ||
    inquiryId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

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

  if (
    error ||
    !inquiry
  ) {
    notFound();
  }

  const answered =
    inquiry.status ===
    "answered";

  return (
    <main
      style={{
        maxWidth: "850px",
        margin: "0 auto",
        padding: "56px 24px 90px",
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
        ← 내 1:1 상담
      </Link>

      <article
        style={{
          marginTop: "24px",
          padding: "30px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              padding: "6px 9px",
              borderRadius: "999px",
              background: "#eef4ff",
              color: "#2f6fed",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            {inquiry.category}
          </span>

          <span
            style={{
              padding: "6px 9px",
              borderRadius: "999px",
              background: answered
                ? "#ecfdf3"
                : "#fff7ed",
              color: answered
                ? "#027a48"
                : "#b54708",
              fontSize: "11px",
              fontWeight: 900,
            }}
          >
            {answered
              ? "답변완료"
              : "답변대기"}
          </span>
        </div>

        <h1
          style={{
            margin: "18px 0 0",
            color: "#0A1F44",
            fontSize: "30px",
            lineHeight: 1.4,
          }}
        >
          {inquiry.title}
        </h1>

        <div
          style={{
            marginTop: "14px",
            color: "#98a2b3",
            fontSize: "12px",
          }}
        >
          {new Date(
            inquiry.created_at
          ).toLocaleString(
            "ko-KR"
          )}
        </div>

        <div
          style={{
            marginTop: "24px",
            paddingTop: "24px",
            borderTop: "1px solid #eef1f5",
            color: "#344054",
            lineHeight: 1.9,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {inquiry.content}
        </div>
      </article>

      <section
        style={{
          marginTop: "20px",
          padding: "28px",
          border: answered
            ? "1px solid #abefc6"
            : "1px solid #e4e7ec",
          borderRadius: "16px",
          background: answered
            ? "#f6fffa"
            : "#ffffff",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#101828",
            fontSize: "20px",
          }}
        >
          TALKLY 답변
        </h2>

        {answered ? (
          <>
            {inquiry.answered_at && (
              <div
                style={{
                  marginTop: "8px",
                  color: "#98a2b3",
                  fontSize: "12px",
                }}
              >
                {new Date(
                  inquiry.answered_at
                ).toLocaleString(
                  "ko-KR"
                )}
              </div>
            )}

            <div
              style={{
                marginTop: "18px",
                color: "#344054",
                lineHeight: 1.9,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {inquiry.admin_answer ||
                "답변 내용이 없습니다."}
            </div>
          </>
        ) : (
          <p
            style={{
              margin: "12px 0 0",
              color: "#667085",
              lineHeight: 1.7,
            }}
          >
            문의를 확인 중입니다. 관리자 답변이
            등록되면 이 화면에서 확인할 수 있습니다.
          </p>
        )}
      </section>
    </main>
  );
}