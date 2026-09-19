"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

type ImportRow = {
  title: string;
  publisher: string | null;
  description: string | null;
  image: string | null;
  salePrice: number | null;
};

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

type ExcelRow = Record<string, unknown>;

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parsePrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  const text = textValue(value).replace(/[^0-9]/g, "");

  if (!text) return null;

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : null;
}

async function readWorkbook(file: File): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
  });

  const sheetName =
    workbook.SheetNames.find((name) => name.trim() === "교재등록") ??
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("엑셀 파일에서 시트를 찾을 수 없습니다.");
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("'교재등록' 시트를 찾을 수 없습니다.");
  }

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
    defval: "",
    raw: false,
  });

  const parsed: ImportRow[] = rows
    .map((row) => {
      const title = textValue(row["교재명"]);

      return {
        title,
        publisher: textValue(row["출판사명"]) || null,
        description: textValue(row["교재설명"]) || null,
        image: textValue(row["교재이미지"]) || null,
        salePrice: parsePrice(row["판매가격"]),
      };
    })
    .filter((row) => row.title);

  if (parsed.length === 0) {
    throw new Error(
      "'교재명' 열을 확인할 수 없거나 등록할 교재가 없습니다."
    );
  }

  return parsed;
}

async function readApiResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  throw new Error(
    text.trim() ||
      `서버 요청에 실패했습니다. HTTP ${response.status}`
  );
}

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

    if (!excel) {
      setError("교재등록 XLSX 파일을 선택해주세요.");
      return;
    }

    if (!/\.xlsx$/i.test(excel.name)) {
      setError("XLSX 파일만 사용할 수 있습니다.");
      return;
    }

    setLoading(true);

    try {
      /*
       * 중요:
       * 25MB 이상의 XLSX 파일 자체를 서버로 전송하지 않습니다.
       * 브라우저에서 필요한 셀만 읽고 작은 JSON 데이터만 전송합니다.
       */
      const rows = await readWorkbook(excel);

      const response = await fetch("/api/admin/textbooks/bulk-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows,
        }),
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "교재 정보 일괄등록에 실패했습니다."
        );
      }

      setResult(data as ResponseData);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "교재 정보 일괄등록에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 20 }}>
      <section
        style={{
          padding: 24,
          border: "1px solid #d8e2f0",
          borderRadius: 16,
          background: "#fff",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#0A1F44",
            fontSize: 20,
          }}
        >
          1. 교재등록 엑셀
        </h2>

        <p
          style={{
            color: "#667085",
            lineHeight: 1.7,
          }}
        >
          ‘교재명 / 출판사명 / 교재설명 / 교재이미지 / 판매가격’ 열을
          읽습니다. 자료구분 열은 사용하지 않습니다. 현재 등록된 교재명과
          자동 매칭하여 기존 textbook ID와 Grade 연결을 그대로 유지합니다.
          엑셀 파일은 브라우저에서 읽고 필요한 교재 정보만 서버로 전송합니다.
        </p>

        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            setExcel(e.target.files?.[0] || null);
            setError("");
            setResult(null);
          }}
        />
      </section>

      <section
        style={{
          padding: 24,
          border: "1px solid #d8e2f0",
          borderRadius: 16,
          background: "#fff",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#0A1F44",
            fontSize: 20,
          }}
        >
          2. 교재 표지 이미지 (선택)
        </h2>

        <p
          style={{
            color: "#667085",
            lineHeight: 1.7,
          }}
        >
          표지 이미지는 교재 정보와 별도로 처리합니다. 이번 엑셀 일괄등록은
          기존 표지를 변경하지 않습니다. PDF와 오디오 ZIP도 여기서 처리하지
          않습니다.
        </p>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) =>
            setCovers(Array.from(e.target.files || []))
          }
        />

        {covers.length > 0 && (
          <p
            style={{
              marginBottom: 0,
              color: "#344054",
            }}
          >
            선택한 표지: {covers.length}개
            <br />
            <span
              style={{
                color: "#b54708",
                fontSize: 13,
              }}
            >
              현재 단계에서는 표지를 업로드하지 않습니다. 교재 정보 등록 후
              표지 일괄등록을 별도로 진행합니다.
            </span>
          </p>
        )}
      </section>

      {error && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "#fff1f3",
            color: "#b42318",
            fontWeight: 700,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !excel}
        style={{
          minHeight: 52,
          border: 0,
          borderRadius: 12,
          background:
            loading || !excel ? "#98a2b3" : "#0A1F44",
          color: "white",
          fontWeight: 900,
          cursor:
            loading || !excel ? "not-allowed" : "pointer",
        }}
      >
        {loading
          ? "교재 정보 확인 및 등록 중..."
          : "교재 정보 일괄등록"}
      </button>

      {result && (
        <section
          style={{
            padding: 24,
            border: "1px solid #d8e2f0",
            borderRadius: 16,
            background: "#fff",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              color: "#0A1F44",
            }}
          >
            처리 결과
          </h2>

          <p style={{ fontWeight: 800 }}>
            전체 {result.total}종 · 갱신 {result.updated}종 · 미매칭{" "}
            {result.unmatched}종 · 실패 {result.failed}종
          </p>

          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            {result.results.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background:
                    item.status === "updated"
                      ? "#ecfdf3"
                      : item.status === "unmatched"
                        ? "#fffaeb"
                        : "#fff1f3",
                  color: "#344054",
                }}
              >
                <strong>{item.title}</strong>
                {" — "}

                {item.status === "updated"
                  ? `갱신 완료${
                      item.coverUpdated ? " · 표지 등록" : ""
                    }`
                  : item.message || item.status}

                {item.matchedTitle &&
                item.matchedTitle !== item.title
                  ? ` (매칭: ${item.matchedTitle})`
                  : ""}
              </div>
            ))}
          </div>
        </section>
      )}
    </form>
  );
}