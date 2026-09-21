export default function EbookTestPage() {
  const ebookUrl =
  "https://www.alist.co.kr/ebook/ebook_index.asp?bcode=01HF0002SB";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1600px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: "#0a1f44",
                fontSize: "26px",
                fontWeight: 900,
              }}
            >
              External E-Book Test
            </h1>

            <p
              style={{
                margin: "6px 0 0",
                color: "#667085",
                fontSize: "14px",
              }}
            >
              eSmart Campus E-Book iframe 연결 테스트
            </p>
          </div>

          <a
            href={ebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              background: "#0a1f44",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 800,
            }}
          >
            새 창에서 열기
          </a>
        </div>

        <div
          style={{
            overflow: "hidden",
            width: "100%",
            height: "calc(100vh - 130px)",
            minHeight: "700px",
            border: "1px solid #dfe5ee",
            borderRadius: "16px",
            background: "#ffffff",
            boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <iframe
            src={ebookUrl}
            title="eSmart Campus E-Book Test"
            allow="autoplay; fullscreen"
            allowFullScreen
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              border: 0,
            }}
          />
        </div>
      </div>
    </main>
  );
}