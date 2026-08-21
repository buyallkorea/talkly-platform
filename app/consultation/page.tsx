import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function ConsultationPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return (
      <ErrorScreen
        title="로그인 정보 확인 오류"
        message={userError.message}
      />
    );
  }

  if (!user) {
    redirect("/login");
  }

  const {
    data: inquiries,
    error,
  } = await supabase
    .from("support_inquiries")
    .select(`
      id,
      category,
      title,
      status,
      answered_at,
      created_at
    `)
    .eq("user_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    return (
      <ErrorScreen
        title="1:1 상담 조회 오류"
        message={error.message}
      />
    );
  }

  const totalCount =
    inquiries?.length ?? 0;

  const pendingCount =
    inquiries?.filter(
      (item) => item.status === "pending"
    ).length ?? 0;

  const answeredCount =
    inquiries?.filter(
      (item) => item.status === "answered"
    ).length ?? 0;

  return (
    <main
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "56px 24px 90px",
      }}
    >
      <Link
        href="/"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        ← TALKLY 홈
      </Link>

      <div
        style={{
          marginTop: "18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: "#0A1F44",
              fontSize: "38px",
              letterSpacing: "-0.04em",
            }}
          >
            1:1 상담
          </h1>

          <p
            style={{
              margin: "12px 0 0",
              color: "#667085",
              lineHeight: 1.7,
            }}
          >
            수강, 수업, 결제 및 TALKLY 이용과 관련한
            문의를 남겨주세요.
          </p>
        </div>

        <Link
          href="/consultation/new"
          style={{
            minHeight: "46px",
            padding: "0 18px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            background: "#0A1F44",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 900,
          }}
        >
          + 새 문의 작성
        </Link>
      </div>

      <div
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <SummaryCard
          label="전체 문의"
          value={totalCount}
        />

        <SummaryCard
          label="답변대기"
          value={pendingCount}
        />

        <SummaryCard
          label="답변완료"
          value={answeredCount}
        />
      </div>

      <section
        style={{
          marginTop: "22px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        {!inquiries || inquiries.length === 0 ? (
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              color: "#667085",
            }}
          >
            아직 등록한 1:1 문의가 없습니다.
          </div>
        ) : (
          inquiries.map((item, index) => (
            <Link
              key={item.id}
              href={`/consultation/${item.id}`}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "110px minmax(0, 1fr) 100px 120px",
                gap: "14px",
                alignItems: "center",
                padding: "19px 20px",
                borderBottom:
                  index === inquiries.length - 1
                    ? "none"
                    : "1px solid #eef1f5",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  color: "#667085",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                {item.category}
              </div>

              <strong
                style={{
                  color: "#101828",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.title}
              </strong>

              <StatusBadge
                status={item.status}
              />

              <div
                style={{
                  color: "#98a2b3",
                  fontSize: "12px",
                  textAlign: "right",
                }}
              >
                {new Date(
                  item.created_at
                ).toLocaleDateString("ko-KR")}
              </div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}

function ErrorScreen({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "60px 24px",
      }}
    >
      <Link
        href="/"
        style={{
          color: "#667085",
          textDecoration: "none",
        }}
      >
        ← TALKLY 홈
      </Link>

      <h1
        style={{
          marginTop: "24px",
          color: "#b42318",
        }}
      >
        {title}
      </h1>

      <pre
        style={{
          marginTop: "20px",
          padding: "20px",
          borderRadius: "12px",
          background: "#fff1f0",
          color: "#b42318",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message}
      </pre>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        minHeight: "105px",
        padding: "19px",
        border: "1px solid #e4e7ec",
        borderRadius: "13px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "12px",
          color: "#101828",
          fontSize: "30px",
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
  const answered =
    status === "answered";

  return (
    <span
      style={{
        display: "inline-flex",
        minHeight: "28px",
        padding: "0 9px",
        alignItems: "center",
        justifyContent: "center",
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