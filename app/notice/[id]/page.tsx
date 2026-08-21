import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NoticeDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const noticeId = Number(id);

  if (
    !Number.isInteger(noticeId) ||
    noticeId <= 0
  ) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: notice,
    error,
  } = await supabase
    .from("notices")
    .select(`
      id,
      title,
      content,
      is_pinned,
      view_count,
      created_at,
      updated_at
    `)
    .eq("id", noticeId)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !notice) {
    notFound();
  }

  const formattedCreatedAt =
    new Date(
      notice.created_at
    ).toLocaleString("ko-KR");

  const formattedUpdatedAt =
    notice.updated_at
      ? new Date(
          notice.updated_at
        ).toLocaleString("ko-KR")
      : null;

  const isUpdated =
    notice.updated_at &&
    notice.updated_at !==
      notice.created_at;

  return (
    <main
      style={{
        minHeight:
          "calc(100vh - 80px)",
        background:
          "linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)",
        padding:
          "64px 24px 96px",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/notice"
          style={{
            color: "#667085",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          ← 공지사항
        </Link>

        <article
          style={{
            marginTop: "24px",
            border:
              "1px solid #e4e7ec",
            borderRadius: "20px",
            background: "#ffffff",
            overflow: "hidden",
            boxShadow:
              "0 12px 34px rgba(10,31,68,0.06)",
          }}
        >
          <div
            style={{
              padding:
                "34px 34px 28px",
              borderBottom:
                "1px solid #eef1f5",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: "8px",
                    flexWrap:
                      "wrap",
                  }}
                >
                  <span
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      minHeight:
                        "28px",
                      padding:
                        "0 9px",
                      borderRadius:
                        "999px",
                      background:
                        notice.is_pinned
                          ? "#eef4ff"
                          : "#f2f4f7",
                      color:
                        notice.is_pinned
                          ? "#2f6fed"
                          : "#667085",
                      fontSize:
                        "11px",
                      fontWeight:
                        900,
                    }}
                  >
                    {notice.is_pinned
                      ? "중요 공지"
                      : "공지"}
                  </span>

                  <span
                    style={{
                      color:
                        "#98a2b3",
                      fontSize:
                        "12px",
                      fontWeight:
                        700,
                    }}
                  >
                    INFORMATION
                  </span>
                </div>

                <h1
                  style={{
                    margin:
                      "18px 0 0",
                    color:
                      "#0A1F44",
                    fontSize:
                      "34px",
                    lineHeight:
                      1.35,
                    letterSpacing:
                      "-0.035em",
                    wordBreak:
                      "keep-all",
                  }}
                >
                  {notice.title}
                </h1>
              </div>
            </div>

            <div
              style={{
                marginTop: "22px",
                display: "flex",
                alignItems:
                  "center",
                gap: "16px",
                flexWrap: "wrap",
                color: "#98a2b3",
                fontSize: "12px",
              }}
            >
              <span>
                등록 {formattedCreatedAt}
              </span>

              {isUpdated &&
                formattedUpdatedAt && (
                  <span>
                    수정{" "}
                    {formattedUpdatedAt}
                  </span>
                )}

              <span>
                조회{" "}
                {notice.view_count ??
                  0}
              </span>
            </div>
          </div>

          <div
            style={{
              padding:
                "36px 34px 42px",
            }}
          >
            <div
              style={{
                color: "#344054",
                fontSize: "16px",
                lineHeight: 1.95,
                whiteSpace:
                  "pre-wrap",
                wordBreak:
                  "break-word",
              }}
            >
              {notice.content}
            </div>
          </div>
        </article>

        <div
          style={{
            marginTop: "22px",
            display: "flex",
            justifyContent:
              "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              minHeight:
                "44px",
              padding:
                "0 16px",
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
              color:
                "#344054",
              textDecoration:
                "none",
              fontSize:
                "13px",
              fontWeight:
                800,
            }}
          >
            ← TALKLY 홈
          </Link>

          <Link
            href="/notice"
            style={{
              minHeight:
                "44px",
              padding:
                "0 18px",
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
              color:
                "#ffffff",
              textDecoration:
                "none",
              fontSize:
                "13px",
              fontWeight:
                900,
            }}
          >
            공지사항 목록
          </Link>
        </div>
      </div>
    </main>
  );
}