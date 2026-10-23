"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main style={{ minHeight: "65vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f9fc", color: "#0a1f44" }}>
    <section style={{ maxWidth: 560, padding: 32, borderRadius: 18, border: "1px solid #dbe3ef", background: "white" }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: "#3f75dc" }}>TALKLY</p>
      <h1 style={{ fontSize: 25, fontWeight: 800, margin: "12px 0" }}>페이지를 불러오지 못했습니다</h1>
      <p style={{ color: "#475467", lineHeight: 1.8 }}>일시적인 연결 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginTop: 24 }}><button onClick={reset} style={{ background: "#3f75dc", color: "white", borderRadius: 9, padding: "12px 20px", fontWeight: 700, cursor: "pointer" }}>다시 시도</button><Link href="/" style={{ color: "#2455a6" }}>TALKLY 홈으로</Link></div>
    </section>
  </main>;
}
