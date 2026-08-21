import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function AdminSupportInquiriesPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  const {
    data: inquiries,
    error,
  } = await supabase
    .from("support_inquiries")
    .select(`
      id,
      user_id,
      category,
      title,
      status,
      created_at,
      answered_at
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(
      error.message
    );
  }

  const userIds =
    Array.from(
      new Set(
        (inquiries ?? [])
          .map(
            (item) =>
              item.user_id
          )
          .filter(Boolean)
      )
    );

  let userProfiles: {
    id: string;
    name: string | null;
    role: string | null;
  }[] = [];

  if (userIds.length > 0) {
    const {
      data,
      error:
        profileError,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        name,
        role
      `)
      .in("id", userIds);

    if (profileError) {
      throw new Error(
        profileError.message
      );
    }

    userProfiles =
      data ?? [];
  }

  function getUserName(
    userId: string
  ) {
    return (
      userProfiles.find(
        (item) =>
          item.id === userId
      )?.name ||
      "이름 미등록 회원"
    );
  }

  function getRoleLabel(
    userId: string
  ) {
    const role =
      userProfiles.find(
        (item) =>
          item.id === userId
      )?.role;

    switch (role) {
      case "parent":
        return "학부모";

      case "student":
        return "학생";

      case "teacher":
        return "강사";

      default:
        return role || "-";
    }
  }

  const total =
    inquiries?.length ?? 0;

  const pending =
    inquiries?.filter(
      (item) =>
        item.status === "pending"
    ).length ?? 0;

  const answered =
    inquiries?.filter(
      (item) =>
        item.status === "answered"
    ).length ?? 0;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          margin: 0,
          color: "#101828",
          fontSize: "34px",
          letterSpacing: "-0.03em",
        }}
      >
        1:1 문의 관리
      </h1>

      <p
        style={{
          margin: "10px 0 0",
          color: "#667085",
          lineHeight: 1.7,
        }}
      >
        회원이 등록한 비공개 1:1 문의를 확인하고
        답변합니다.
      </p>

      <div
        style={{
          marginTop: "26px",
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <SummaryCard
          label="전체 문의"
          value={total}
        />

        <SummaryCard
          label="답변대기"
          value={pending}
        />

        <SummaryCard
          label="답변완료"
          value={answered}
        />
      </div>

      <section
        style={{
          marginTop: "22px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        {!inquiries ||
        inquiries.length === 0 ? (
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              color: "#667085",
            }}
          >
            등록된 1:1 문의가 없습니다.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "110px 100px 110px minmax(0,1fr) 100px 120px 70px",
                gap: "10px",
                padding: "14px 18px",
                background: "#f8fafc",
                color: "#667085",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              <div>회원</div>
              <div>구분</div>
              <div>문의유형</div>
              <div>제목</div>
              <div>상태</div>
              <div>등록일</div>
              <div />
            </div>

            {inquiries.map(
              (item, index) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "110px 100px 110px minmax(0,1fr) 100px 120px 70px",
                    gap: "10px",
                    alignItems: "center",
                    padding: "17px 18px",
                    borderTop:
                      "1px solid #eef1f5",
                  }}
                >
                  <strong
                    style={{
                      color: "#101828",
                    }}
                  >
                    {getUserName(
                      item.user_id
                    )}
                  </strong>

                  <div
                    style={{
                      color: "#667085",
                      fontSize: "12px",
                    }}
                  >
                    {getRoleLabel(
                      item.user_id
                    )}
                  </div>

                  <div
                    style={{
                      color: "#667085",
                      fontSize: "12px",
                    }}
                  >
                    {item.category}
                  </div>

                  <div
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "#101828",
                    }}
                  >
                    {item.title}
                  </div>

                  <StatusBadge
                    status={
                      item.status
                    }
                  />

                  <div
                    style={{
                      color: "#98a2b3",
                      fontSize: "12px",
                    }}
                  >
                    {new Date(
                      item.created_at
                    ).toLocaleDateString(
                      "ko-KR"
                    )}
                  </div>

                  <Link
                    href={`/admin/support-inquiries/${item.id}`}
                    style={{
                      color: "#0A1F44",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: 900,
                    }}
                  >
                    확인 →
                  </Link>
                </div>
              )
            )}
          </>
        )}
      </section>
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
        padding: "19px",
        minHeight: "105px",
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
        minHeight: "27px",
        padding: "0 9px",
        alignItems: "center",
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
  );
}