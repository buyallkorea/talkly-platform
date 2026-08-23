import Link from "next/link";

import SiteHeader from "@/components/SiteHeader";

const notices = [
  {
    id: 1,
    category: "공지",
    title: "TALKLY 이용 안내",
    description:
      "수강 및 서비스 이용에 필요한 주요 안내를 확인해주세요.",
    date: "2026.08.23",
    pinned: true,
  },
];

export default function NoticePage() {
  return (
    <>
      <SiteHeader />

      <main
        style={{
          minHeight: "calc(100vh - 92px)",
          background:
            "linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)",
          padding: "22px 24px 96px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1100px",
            margin: "0 auto",
          }}
        >
          {/* Breadcrumb */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              color: "#98a2b3",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            <Link
              href="/"
              style={{
                color: "#667085",
                textDecoration: "none",
              }}
            >
              홈
            </Link>

            <span>›</span>

            <span>인포메이션</span>

            <span>›</span>

            <span
              style={{
                color: "#2f6fed",
              }}
            >
              공지사항
            </span>
          </div>

          {/* Hero */}
          <section
            style={{
              padding: "52px 0 34px",
            }}
          >
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
                letterSpacing: "0.04em",
              }}
            >
              TALKLY NOTICE
            </div>

            <h1
              style={{
                margin: "16px 0 0",
                color: "#0A1F44",
                fontSize: "clamp(36px, 5vw, 48px)",
                lineHeight: 1.2,
                letterSpacing: "-0.045em",
              }}
            >
              공지사항
            </h1>

            <p
              style={{
                margin: "14px 0 0",
                color: "#667085",
                fontSize: "15px",
                lineHeight: 1.8,
              }}
            >
              TALKLY 이용에 필요한 주요 안내와 새로운 소식을 확인하세요.
            </p>
          </section>

          {/* Quick navigation */}
          <section
            className="talkly-notice-quick-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, minmax(0,1fr))",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <QuickLink
              href="/notice"
              label="공지사항"
              active
            />

            <QuickLink
              href="/#reviews"
              label="수업후기"
            />

            <QuickLink
              href="/consultation"
              label="1:1 상담"
            />
          </section>

          {/* Notice board */}
          <section
            style={{
              overflow: "hidden",
              border: "1px solid #e4e7ec",
              borderRadius: "18px",
              background: "#ffffff",
              boxShadow:
                "0 10px 30px rgba(10,31,68,.05)",
            }}
          >
            <div
              className="talkly-notice-header"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "90px minmax(0, 1fr) 120px",
                gap: "16px",
                alignItems: "center",
                padding: "16px 22px",
                borderBottom:
                  "1px solid #eef1f5",
                background: "#f8fafc",
                color: "#667085",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              <div>구분</div>
              <div>제목</div>

              <div
                style={{
                  textAlign: "right",
                }}
              >
                등록일
              </div>
            </div>

            {notices.map((notice, index) => (
              <article
                key={notice.id}
                className="talkly-notice-row"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "90px minmax(0, 1fr) 120px",
                  gap: "16px",
                  alignItems: "center",
                  padding: "22px",
                  borderBottom:
                    index === notices.length - 1
                      ? "none"
                      : "1px solid #eef1f5",
                }}
              >
                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      minHeight: "28px",
                      padding: "0 9px",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "999px",
                      background: notice.pinned
                        ? "#eef4ff"
                        : "#f2f4f7",
                      color: notice.pinned
                        ? "#2f6fed"
                        : "#667085",
                      fontSize: "11px",
                      fontWeight: 900,
                    }}
                  >
                    {notice.category}
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {notice.pinned && (
                      <span aria-label="고정공지">
                        📌
                      </span>
                    )}

                    <strong
                      style={{
                        color: "#101828",
                        fontSize: "15px",
                        lineHeight: 1.5,
                      }}
                    >
                      {notice.title}
                    </strong>
                  </div>

                  <p
                    style={{
                      margin: "7px 0 0",
                      color: "#667085",
                      fontSize: "12px",
                      lineHeight: 1.7,
                    }}
                  >
                    {notice.description}
                  </p>
                </div>

                <div
                  style={{
                    color: "#98a2b3",
                    fontSize: "12px",
                    textAlign: "right",
                  }}
                >
                  {notice.date}
                </div>
              </article>
            ))}
          </section>

          <div
            style={{
              marginTop: "22px",
              display: "flex",
              justifyContent: "space-between",
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
              1:1 상담하기 →
            </Link>
          </div>
        </div>

        <style>{`
          @media (max-width: 720px) {
            .talkly-notice-quick-grid {
              grid-template-columns: 1fr !important;
            }

            .talkly-notice-header {
              display: none !important;
            }

            .talkly-notice-row {
              grid-template-columns: 1fr !important;
            }

            .talkly-notice-row > div:last-child {
              text-align: left !important;
            }
          }
        `}</style>
      </main>
    </>
  );
}

function QuickLink({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        minHeight: "52px",
        padding: "0 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: active
          ? "1px solid #2f6fed"
          : "1px solid #e4e7ec",
        borderRadius: "12px",
        background: active
          ? "#eef4ff"
          : "#ffffff",
        color: active
          ? "#2f6fed"
          : "#344054",
        textDecoration: "none",
        fontSize: "13px",
        fontWeight: 900,
      }}
    >
      {label}
    </Link>
  );
}

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};

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