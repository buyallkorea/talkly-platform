"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  title: string;
  matchedTitle?: string;
  textbookId?: number;
  status: "updated" | "unmatched" | "failed";
  message?: string;
  coverUpdated?: boolean;
};

type ResponseData = {
  total: number;
  updated: number;
  unmatched: number;
  failed: number;
  results: Result[];
};

export default function BulkTextbookImportForm() {
  const router = useRouter();
  const [excel, setExcel] = useState<File | null>(null);
  const [covers, setCovers] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResponseData | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!excel) return setError("교재등록 XLSX 파일을 선택해주세요.");
    setLoading(true);
    try {
      const form = new FormData();
      form.append("excel", excel);
      covers.forEach((file) => form.append("covers", file));
      const response = await fetch("/api/admin/textbooks/bulk-import", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "일괄등록에 실패했습니다.");
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "일괄등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 20 }}>
      <section style={{ padding: 24, border: "1px solid #d8e2f0", borderRadius: 16, background: "#fff" }}>
        <h2 style={{ margin: 0, color: "#0A1F44", fontSize: 20 }}>1. 교재등록 엑셀</h2>
        <p style={{ color: "#667085", lineHeight: 1.7 }}>
          ‘교재명 / 출판사명 / 교재설명 / 교재이미지 / 판매가격’ 열을 읽습니다. 자료구분 열은 사용하지 않습니다.
          현재 등록된 교재명과 자동 매칭하여 기존 textbook ID와 Grade 연결을 그대로 유지합니다.
        </p>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setExcel(e.target.files?.[0] || null)} />
      </section>

      <section style={{ padding: 24, border: "1px solid #d8e2f0", borderRadius: 16, background: "#fff" }}>
        <h2 style={{ margin: 0, color: "#0A1F44", fontSize: 20 }}>2. 교재 표지 이미지 (선택)</h2>
        <p style={{ color: "#667085", lineHeight: 1.7 }}>
          JPG, PNG, WEBP 표지를 여러 장 한 번에 선택할 수 있습니다. 엑셀 ‘교재이미지’ 셀에 파일명이 있으면 그 파일을 우선 사용하고,
          비어 있으면 이미지 파일명과 교재명이 같은 경우 자동 매칭합니다. PDF와 오디오 ZIP은 여기서 처리하지 않습니다.
        </p>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setCovers(Array.from(e.target.files || []))} />
        {covers.length > 0 && <p style={{ marginBottom: 0, color: "#344054" }}>선택한 표지: {covers.length}개</p>}
      </section>

      {error && <div style={{ padding: 16, borderRadius: 12, background: "#fff1f3", color: "#b42318", fontWeight: 700 }}>{error}</div>}

      <button type="submit" disabled={loading || !excel} style={{ minHeight: 52, border: 0, borderRadius: 12, background: loading || !excel ? "#98a2b3" : "#0A1F44", color: "white", fontWeight: 900, cursor: loading || !excel ? "not-allowed" : "pointer" }}>
        {loading ? "일괄등록 처리 중..." : "교재 정보 일괄등록"}
      </button>

      {result && (
        <section style={{ padding: 24, border: "1px solid #d8e2f0", borderRadius: 16, background: "#fff" }}>
          <h2 style={{ marginTop: 0, color: "#0A1F44" }}>처리 결과</h2>
          <p style={{ fontWeight: 800 }}>전체 {result.total}종 · 갱신 {result.updated}종 · 미매칭 {result.unmatched}종 · 실패 {result.failed}종</p>
          <div style={{ display: "grid", gap: 8 }}>
            {result.results.map((item, index) => (
              <div key={`${item.title}-${index}`} style={{ padding: 12, borderRadius: 10, background: item.status === "updated" ? "#ecfdf3" : "#fff4ed", color: "#344054" }}>
                <strong>{item.title}</strong> — {item.status === "updated" ? `갱신 완료${item.coverUpdated ? " · 표지 등록" : ""}` : item.message || item.status}
                {item.matchedTitle && item.matchedTitle !== item.title ? ` (매칭: ${item.matchedTitle})` : ""}
              </div>
            ))}
          </div>
        </section>
      )}
    </form>
  );
}