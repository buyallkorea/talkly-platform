import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function AdminNoticesPage() {
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
    data: notices,
    error,
  } = await supabase
    .from("notices")
    .select(`
      id,
      title,
      is_pinned,
      is_published,
      view_count,
      created_at,
      updated_at
    `)
    .order("is_pinned", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const totalCount =
    notices?.length ?? 0;

  const publishedCount =
    notices?.filter(
      (notice) =>
        notice.is_published
    ).length ?? 0;

  const hiddenCount =
    totalCount -
    publishedCount;

  const pinnedCount =
    notices?.filter(
      (notice) =>
        notice.is_pinned
    ).length ?? 0;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
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
              fontSize: "34px",
              letterSpacing: "-0.03em",
              color: "#101828",
            }}
          >
            공지사항 관리
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "#667085",
              lineHeight: 1.7,
            }}
          >
            TALKLY 이용자에게 공개할 공지사항을
            작성하고 관리합니다.
          </p>
        </div>

        <Link
          href="/admin/notices/new"
          style={{
            minHeight: "44px",
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
          + 새 공지 작성
        </Link>
      </div>

      <div
        style={{
          marginTop: "26px",
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <SummaryCard
          label="전체 공지"
          value={totalCount}
        />

        <SummaryCard
          label="공개"
          value={publishedCount}
        />

        <SummaryCard
          label="비공개"
          value={hiddenCount}
        />

        <SummaryCard
          label="상단 고정"
          value={pinnedCount}
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
        {!notices ||
        notices.length === 0 ? (
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              color: "#667085",
            }}
          >
            아직 등록된 공지사항이 없습니다.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1fr) 100px 100px 100px 130px 70px",
                gap: "12px",
                padding: "14px 18px",
                borderBottom:
                  "1px solid #eef1f5",
                background: "#f8fafc",
                color: "#667085",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              <div>제목</div>
              <div>공개상태</div>
              <div>고정</div>
              <div>조회수</div>
              <div>작성일</div>
              <div />
            </div>

            {notices.map(
              (notice, index) => (
                <div
                  key={notice.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0, 1fr) 100px 100px 100px 130px 70px",
                    gap: "12px",
                    alignItems: "center",
                    padding: "17px 18px",
                    borderBottom:
                      index ===
                      notices.length - 1
                        ? "none"
                        : "1px solid #eef1f5",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {notice.is_pinned && (
                      <span
                        style={{
                          padding: "4px 7px",
                          borderRadius: "999px",
                          background: "#eef4ff",
                          color: "#2f6fed",
                          fontSize: "10px",
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        중요
                      </span>
                    )}

                    <strong
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "#101828",
                      }}
                    >
                      {notice.title}
                    </strong>
                  </div>

                  <div>
                    <StatusBadge
                      active={
                        notice.is_published
                      }
                      activeLabel="공개"
                      inactiveLabel="비공개"
                    />
                  </div>

                  <div
                    style={{
                      color: notice.is_pinned
                        ? "#2f6fed"
                        : "#98a2b3",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    {notice.is_pinned
                      ? "고정"
                      : "-"}
                  </div>

                  <div
                    style={{
                      color: "#667085",
                      fontSize: "13px",
                    }}
                  >
                    {notice.view_count ?? 0}
                  </div>

                  <div
                    style={{
                      color: "#667085",
                      fontSize: "12px",
                    }}
                  >
                    {new Date(
                      notice.created_at
                    ).toLocaleDateString(
                      "ko-KR"
                    )}
                  </div>

                  <Link
                    href={`/admin/notices/${notice.id}`}
                    style={{
                      color: "#0A1F44",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    관리 →
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
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        minHeight: "27px",
        padding: "0 9px",
        alignItems: "center",
        borderRadius: "999px",
        background: active
          ? "#ecfdf3"
          : "#f2f4f7",
        color: active
          ? "#027a48"
          : "#667085",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {active
        ? activeLabel
        : inactiveLabel}
    </span>
  );
}