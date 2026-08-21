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

  const safeNotices = error ? [] : notices ?? [];

  return (
    <main
      style={{
        minHeight: "calc(100vh - 80px)",
        background:
          "linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)",
        padding: "64px 24px 96px",
      }}
    >
      <div
        style={{
          maxWidth: "980px",
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
                marginTop: "22px",
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
              INFORMATION
            </div>

            <h1
              style={{
                margin: "16px 0 0",
                fontSize: "42px",
                lineHeight: 1.2,
                letterSpacing: "-0.04em",
                color: "#0A1F44",
              }}
            >
              공지사항
            </h1>

            <p
              style={{
                margin: "13px 0 0",
                maxWidth: "620px",
                color: "#667085",
                fontSize: "16px",
                lineHeight: 1.8,
              }}
            >
              TALKLY의 새로운 소식과 수업 운영에 필요한
              중요한 안내를 확인하세요.
            </p>
          </div>
        </div>

        <section
          style={{
            marginTop: "40px",
            border: "1px solid #e4e7ec",
            borderRadius: "20px",
            background: "#ffffff",
            overflow: "hidden",
            boxShadow:
              "0 10px 30px rgba(10,31,68,0.05)",
          }}
        >
          {safeNotices.length === 0 ? (
            <div
              style={{
                padding: "80px 24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "54px",
                  height: "54px",
                  margin: "0 auto",
                  borderRadius: "50%",
                  background: "#f2f6fc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#7890b7",
                  fontSize: "24px",
                  fontWeight: 800,
                }}
              >
                i
              </div>

              <h2
                style={{
                  margin: "18px 0 0",
                  color: "#101828",
                  fontSize: "18px",
                }}
              >
                등록된 공지사항이 없습니다.
              </h2>

              <p
                style={{
                  margin: "8px 0 0",
                  color: "#98a2b3",
                  fontSize: "13px",
                }}
              >
                새로운 안내가 등록되면 이곳에서 확인할 수
                있습니다.
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "90px minmax(0,1fr) 130px 90px",
                  gap: "16px",
                  padding: "15px 22px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #eef1f5",
                  color: "#667085",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                <div>구분</div>
                <div>제목</div>
                <div>등록일</div>
                <div style={{ textAlign: "right" }}>
                  조회수
                </div>
              </div>

              {safeNotices.map((notice, index) => (
                <Link
                  key={notice.id}
                  href={`/notice/${notice.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "90px minmax(0,1fr) 130px 90px",
                    gap: "16px",
                    alignItems: "center",
                    padding: "20px 22px",
                    textDecoration: "none",
                    color: "inherit",
                    borderBottom:
                      index === safeNotices.length - 1
                        ? "none"
                        : "1px solid #eef1f5",
                    transition:
                      "background-color .15s ease",
                  }}
                >
                  <div>
                    {notice.is_pinned ? (
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
                        }}
                      >
                        중요
                      </span>
                    ) : (
                      <span
                        style={{
                          color: "#98a2b3",
                          fontSize: "12px",
                        }}
                      >
                        일반
                      </span>
                    )}
                  </div>

                  <strong
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "#101828",
                      fontSize: "15px",
                    }}
                  >
                    {notice.title}
                  </strong>

                  <div
                    style={{
                      color: "#667085",
                      fontSize: "13px",
                    }}
                  >
                    {new Date(
                      notice.created_at
                    ).toLocaleDateString("ko-KR")}
                  </div>

                  <div
                    style={{
                      color: "#98a2b3",
                      fontSize: "12px",
                      textAlign: "right",
                    }}
                  >
                    {notice.view_count ?? 0}
                  </div>
                </Link>
              ))}
            </>
          )}
        </section>
      </div>
    </main>
  );
}