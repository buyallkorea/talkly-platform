import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function AdminSupportInquiriesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: adminProfile,
    error: adminProfileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    adminProfileError ||
    !adminProfile ||
    adminProfile.role !== "admin"
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
      answered_at,
      created_at
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const safeInquiries = inquiries ?? [];

  /*
   * 문의 작성자 이름 조회
   */
  const userIds = Array.from(
    new Set(
      safeInquiries
        .map((item) => item.user_id)
        .filter(
          (id): id is string => Boolean(id)
        )
    )
  );

  let userProfiles: {
    id: string;
    name: string | null;
    role: string | null;
  }[] = [];

  if (userIds.length > 0) {
    const {
      data: profiles,
      error: profilesError,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        name,
        role
      `)
      .in("id", userIds);

    if (profilesError) {
      throw new Error(
        profilesError.message
      );
    }

    userProfiles = profiles ?? [];
  }

  function getUserName(
    userId: string | null
  ) {
    if (!userId) {
      return "사용자 정보 없음";
    }

    const profile =
      userProfiles.find(
        (item) => item.id === userId
      );

    return (
      profile?.name ||
      "이름 미등록 사용자"
    );
  }

  function getUserRole(
    userId: string | null
  ) {
    if (!userId) {
      return "-";
    }

    const profile =
      userProfiles.find(
        (item) => item.id === userId
      );

    switch (profile?.role) {
      case "parent":
        return "학부모";

      case "student":
        return "학생";

      case "teacher":
        return "강사";

      case "admin":
        return "관리자";

      default:
        return "회원";
    }
  }

  const totalCount =
    safeInquiries.length;

  const pendingCount =
    safeInquiries.filter(
      (item) =>
        item.status === "pending"
    ).length;

  const answeredCount =
    safeInquiries.filter(
      (item) =>
        item.status === "answered"
    ).length;

  const today = new Date();

  const todayKey = [
    today.getFullYear(),
    String(
      today.getMonth() + 1
    ).padStart(2, "0"),
    String(
      today.getDate()
    ).padStart(2, "0"),
  ].join("-");

  const todayCount =
    safeInquiries.filter(
      (item) => {
        const created =
          new Date(item.created_at);

        const createdKey = [
          created.getFullYear(),
          String(
            created.getMonth() + 1
          ).padStart(2, "0"),
          String(
            created.getDate()
          ).padStart(2, "0"),
        ].join("-");

        return createdKey === todayKey;
      }
    ).length;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
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
              display: "inline-flex",
              alignItems: "center",
              minHeight: "28px",
              padding: "0 10px",
              borderRadius: "999px",
              background: "#eef4ff",
              color: "#2f6fed",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.04em",
            }}
          >
            CUSTOMER SUPPORT
          </div>

          <h1
            style={{
              margin: "14px 0 0",
              color: "#101828",
              fontSize: "36px",
              lineHeight: 1.2,
              letterSpacing: "-0.035em",
            }}
          >
            1:1 문의 관리
          </h1>

          <p
            style={{
              margin: "11px 0 0",
              color: "#667085",
              fontSize: "15px",
              lineHeight: 1.75,
            }}
          >
            회원이 등록한 문의를 확인하고
            답변 상태를 관리합니다.
          </p>
        </div>

        <Link
          href="/consultation"
          style={{
            minHeight: "44px",
            padding: "0 16px",
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
          }}
        >
          사용자 상담 화면 보기 ↗
        </Link>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
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
          accent="waiting"
        />

        <SummaryCard
          label="답변완료"
          value={answeredCount}
          accent="answered"
        />

        <SummaryCard
          label="오늘 접수"
          value={todayCount}
          accent="today"
        />
      </section>

      {pendingCount > 0 && (
        <div
          style={{
            marginTop: "20px",
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            border: "1px solid #fedf89",
            borderRadius: "12px",
            background: "#fffaeb",
            color: "#93370d",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
        >
          <strong>
            답변을 기다리는 문의가{" "}
            {pendingCount}건 있습니다.
          </strong>

          <span>
            오래된 문의부터 확인해주세요.
          </span>
        </div>
      )}

      <section
        style={{
          marginTop: "22px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
          overflow: "hidden",
          boxShadow:
            "0 8px 24px rgba(10,31,68,.035)",
        }}
      >
        {safeInquiries.length === 0 ? (
          <div
            style={{
              padding: "75px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "#f2f6fc",
                color: "#7890b7",
                fontSize: "24px",
                fontWeight: 900,
              }}
            >
              ?
            </div>

            <h2
              style={{
                margin: "18px 0 0",
                color: "#101828",
                fontSize: "18px",
              }}
            >
              등록된 1:1 문의가 없습니다.
            </h2>

            <p
              style={{
                margin: "8px 0 0",
                color: "#98a2b3",
                fontSize: "13px",
              }}
            >
              회원이 문의를 등록하면 이곳에
              표시됩니다.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "100px 130px minmax(0,1fr) 105px 130px 85px",
                gap: "12px",
                alignItems: "center",
                padding: "14px 20px",
                background: "#f8fafc",
                borderBottom:
                  "1px solid #eef1f5",
                color: "#667085",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              <div>문의유형</div>
              <div>문의자</div>
              <div>제목</div>
              <div>상태</div>
              <div>접수일</div>
              <div />
            </div>

            {safeInquiries.map(
              (item, index) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "100px 130px minmax(0,1fr) 105px 130px 85px",
                    gap: "12px",
                    alignItems: "center",
                    padding: "18px 20px",
                    borderBottom:
                      index ===
                      safeInquiries.length - 1
                        ? "none"
                        : "1px solid #eef1f5",
                    background:
                      item.status === "pending"
                        ? "#fffdf8"
                        : "#ffffff",
                  }}
                >
                  <div>
                    <CategoryBadge
                      category={item.category}
                    />
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        color: "#101828",
                        fontSize: "13px",
                        fontWeight: 900,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getUserName(
                        item.user_id
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "#98a2b3",
                        fontSize: "11px",
                      }}
                    >
                      {getUserRole(
                        item.user_id
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        color: "#101828",
                        fontSize: "14px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.title}
                    </strong>

                    {item.status ===
                      "answered" &&
                      item.answered_at && (
                        <div
                          style={{
                            marginTop: "5px",
                            color: "#98a2b3",
                            fontSize: "11px",
                          }}
                        >
                          답변{" "}
                          {new Date(
                            item.answered_at
                          ).toLocaleDateString(
                            "ko-KR"
                          )}
                        </div>
                      )}
                  </div>

                  <StatusBadge
                    status={item.status}
                  />

                  <div
                    style={{
                      color: "#667085",
                      fontSize: "12px",
                      lineHeight: 1.5,
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
                      minHeight: "38px",
                      padding: "0 12px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border:
                        item.status ===
                        "pending"
                          ? "none"
                          : "1px solid #d6deea",
                      borderRadius: "8px",
                      background:
                        item.status ===
                        "pending"
                          ? "#0A1F44"
                          : "#ffffff",
                      color:
                        item.status ===
                        "pending"
                          ? "#ffffff"
                          : "#0A1F44",
                      textDecoration: "none",
                      fontSize: "12px",
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.status ===
                    "pending"
                      ? "답변"
                      : "보기"}
                  </Link>
                </div>
              )
            )}
          </>
        )}
      </section>

      <div
        style={{
          marginTop: "18px",
          padding: "16px 18px",
          borderRadius: "12px",
          background: "#f8fafc",
          color: "#667085",
          fontSize: "12px",
          lineHeight: 1.7,
        }}
      >
        답변대기 문의는 목록에서 구분하여
        표시됩니다. 답변을 등록하면 회원의
        1:1 상담 상세 화면에 즉시 반영됩니다.
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?:
    | "waiting"
    | "answered"
    | "today";
}) {
  let valueColor = "#101828";

  if (accent === "waiting") {
    valueColor = "#b54708";
  }

  if (accent === "answered") {
    valueColor = "#027a48";
  }

  if (accent === "today") {
    valueColor = "#2f6fed";
  }

  return (
    <div
      style={{
        minHeight: "112px",
        padding: "20px",
        border: "1px solid #e4e7ec",
        borderRadius: "14px",
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
          marginTop: "13px",
          color: valueColor,
          fontSize: "31px",
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
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
        minHeight: "27px",
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
        minHeight: "29px",
        padding: "0 10px",
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