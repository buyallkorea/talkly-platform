import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export default async function NoticePage() {
  const supabase = await createClient();

  const {
    data: notices,
    error,
  } = await supabase
    .from("notices")
    .select(`
      id,
      title,
      is_pinned,
      view_count,
      created_at
    `)
    .eq("is_published", true)
    .order("is_pinned", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "56px 24px 90px",
      }}
    >
      <div>
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

        <h1
          style={{
            margin: "18px 0 0",
            fontSize: "38px",
            letterSpacing: "-0.04em",
            color: "#0A1F44",
          }}
        >
          공지사항
        </h1>

        <p
          style={{
            margin: "12px 0 0",
            color: "#667085",
            lineHeight: 1.7,
          }}
        >
          TALKLY의 새로운 소식과 중요한 안내를
          확인하세요.
        </p>
      </div>

      <section
        style={{
          marginTop: "34px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "16px",
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
            등록된 공지사항이 없습니다.
          </div>
        ) : (
          notices.map(
            (notice, index) => (
              <Link
                key={notice.id}
                href={`/notice/${notice.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1fr) 110px 80px",
                  gap: "16px",
                  alignItems: "center",
                  padding: "20px 22px",
                  textDecoration: "none",
                  color: "inherit",
                  borderBottom:
                    index ===
                    notices.length - 1
                      ? "none"
                      : "1px solid #eef1f5",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    minWidth: 0,
                  }}
                >
                  {notice.is_pinned && (
                    <span
                      style={{
                        flexShrink: 0,
                        padding:
                          "5px 8px",
                        borderRadius:
                          "999px",
                        background:
                          "#eef4ff",
                        color:
                          "#2f6fed",
                        fontSize:
                          "11px",
                        fontWeight:
                          900,
                      }}
                    >
                      중요
                    </span>
                  )}

                  <strong
                    style={{
                      overflow:
                        "hidden",
                      textOverflow:
                        "ellipsis",
                      whiteSpace:
                        "nowrap",
                      color:
                        "#101828",
                    }}
                  >
                    {notice.title}
                  </strong>
                </div>

                <div
                  style={{
                    color: "#667085",
                    fontSize: "13px",
                  }}
                >
                  {new Date(
                    notice.created_at
                  ).toLocaleDateString(
                    "ko-KR"
                  )}
                </div>

                <div
                  style={{
                    color: "#98a2b3",
                    fontSize: "12px",
                    textAlign: "right",
                  }}
                >
                  조회{" "}
                  {notice.view_count ??
                    0}
                </div>
              </Link>
            )
          )
        )}
      </section>
    </main>
  );
}