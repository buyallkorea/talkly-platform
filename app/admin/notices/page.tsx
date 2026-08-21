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

  const safeNotices = notices ?? [];

  const totalCount = safeNotices.length;

  const publishedCount =
    safeNotices.filter(
      (notice) => notice.is_published
    ).length;

  const hiddenCount =
    safeNotices.filter(
      (notice) => !notice.is_published
    ).length;

  const pinnedCount =
    safeNotices.filter(
      (notice) => notice.is_pinned
    ).length;

  const recentCount =
    safeNotices.filter((notice) => {
      const createdAt =
        new Date(notice.created_at);

      const sevenDaysAgo =
        new Date();

      sevenDaysAgo.setDate(
        sevenDaysAgo.getDate() - 7
      );

      return createdAt >= sevenDaysAgo;
    }).length;

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
              display:
                "inline-flex",
              alignItems:
                "center",
              minHeight: "28px",
              padding: "0 10px",
              borderRadius:
                "999px",
              background:
                "#eef4ff",
              color: "#2f6fed",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing:
                "0.04em",
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
              letterSpacing:
                "-0.035em",
            }}
          >
            공지사항 관리
          </h1>

          <p
            style={{
              margin: "11px 0 0",
              color: "#667085",
              fontSize: "15px",
              lineHeight: 1.75,
            }}
          >
            TALKLY 이용자에게
            공개할 공지사항을
            작성하고 관리합니다.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/notice"
            style={{
              minHeight: "46px",
              padding: "0 17px",
              display:
                "inline-flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              border:
                "1px solid #d6deea",
              borderRadius:
                "10px",
              background:
                "#ffffff",
              color: "#344054",
              textDecoration:
                "none",
              fontSize: "13px",
              fontWeight: 800,
            }}
          >
            사용자 공지 보기 ↗
          </Link>

          <Link
            href="/admin/notices/new"
            style={{
              minHeight: "46px",
              padding: "0 18px",
              display:
                "inline-flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              borderRadius:
                "10px",
              background:
                "#0A1F44",
              color: "#ffffff",
              textDecoration:
                "none",
              fontSize: "14px",
              fontWeight: 900,
              boxShadow:
                "0 8px 20px rgba(10,31,68,.12)",
            }}
          >
            + 새 공지 작성
          </Link>
        </div>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(5, minmax(0, 1fr))",
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

        <SummaryCard
          label="최근 7일"
          value={recentCount}
        />
      </section>

      <section
        style={{
          marginTop: "22px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
          overflow: "hidden",
          boxShadow:
            "0 8px 24px rgba(10,31,68,.035)",
        }}
      >
        {safeNotices.length === 0 ? (
          <div
            style={{
              padding: "70px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "54px",
                height: "54px",
                margin: "0 auto",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius: "50%",
                background:
                  "#f2f6fc",
                color: "#7890b7",
                fontSize: "24px",
                fontWeight: 900,
              }}
            >
              i
            </div>

            <h2
              style={{
                margin:
                  "18px 0 0",
                color: "#101828",
                fontSize: "18px",
              }}
            >
              아직 등록된
              공지사항이 없습니다.
            </h2>

            <p
              style={{
                margin:
                  "8px 0 0",
                color: "#98a2b3",
                fontSize: "13px",
              }}
            >
              새 공지를 작성하면
              이곳에서 관리할 수
              있습니다.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1fr) 100px 90px 90px 130px 90px",
                gap: "12px",
                alignItems: "center",
                padding: "14px 20px",
                background:
                  "#f8fafc",
                borderBottom:
                  "1px solid #eef1f5",
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

            {safeNotices.map(
              (notice, index) => (
                <div
                  key={notice.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0, 1fr) 100px 90px 90px 130px 90px",
                    gap: "12px",
                    alignItems:
                      "center",
                    padding:
                      "18px 20px",
                    borderBottom:
                      index ===
                      safeNotices.length -
                        1
                        ? "none"
                        : "1px solid #eef1f5",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: "9px",
                    }}
                  >
                    {notice.is_pinned && (
                      <span
                        style={{
                          flexShrink: 0,
                          minHeight:
                            "26px",
                          padding:
                            "0 8px",
                          display:
                            "inline-flex",
                          alignItems:
                            "center",
                          borderRadius:
                            "999px",
                          background:
                            "#eef4ff",
                          color:
                            "#2f6fed",
                          fontSize:
                            "10px",
                          fontWeight:
                            900,
                        }}
                      >
                        중요
                      </span>
                    )}

                    <strong
                      style={{
                        minWidth: 0,
                        overflow:
                          "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace:
                          "nowrap",
                        color:
                          "#101828",
                        fontSize:
                          "14px",
                      }}
                    >
                      {notice.title}
                    </strong>
                  </div>

                  <div>
                    <PublishedBadge
                      published={
                        notice.is_published
                      }
                    />
                  </div>

                  <div
                    style={{
                      color:
                        notice.is_pinned
                          ? "#2f6fed"
                          : "#98a2b3",
                      fontSize:
                        "12px",
                      fontWeight:
                        800,
                    }}
                  >
                    {notice.is_pinned
                      ? "고정"
                      : "-"}
                  </div>

                  <div
                    style={{
                      color:
                        "#667085",
                      fontSize:
                        "13px",
                    }}
                  >
                    {notice.view_count ??
                      0}
                  </div>

                  <div
                    style={{
                      color:
                        "#667085",
                      fontSize:
                        "12px",
                      lineHeight:
                        1.5,
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
                      minHeight:
                        "38px",
                      padding:
                        "0 12px",
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      border:
                        "1px solid #d6deea",
                      borderRadius:
                        "8px",
                      background:
                        "#ffffff",
                      color:
                        "#0A1F44",
                      textDecoration:
                        "none",
                      fontSize:
                        "12px",
                      fontWeight:
                        900,
                      whiteSpace:
                        "nowrap",
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
        공개 상태의 공지만 사용자 공지사항
        화면에 표시됩니다. 중요 공지는 일반 공지보다
        상단에 우선 표시됩니다.
      </div>
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
        minHeight: "112px",
        padding: "19px",
        border:
          "1px solid #e4e7ec",
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
          marginTop: "13px",
          color: "#101828",
          fontSize: "30px",
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PublishedBadge({
  published,
}: {
  published: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "27px",
        padding: "0 9px",
        borderRadius: "999px",
        background: published
          ? "#ecfdf3"
          : "#f2f4f7",
        color: published
          ? "#027a48"
          : "#667085",
        fontSize: "11px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {published
        ? "공개"
        : "비공개"}
    </span>
  );
}