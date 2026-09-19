"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import JSZip from "jszip";

type CoverPayload = {
  filename: string;
  mimeType: string;
  base64: string;
};

type ImportRow = {
  title: string;
  publisher: string | null;
  description: string | null;
  image: string | null;
  salePrice: number | null;
  cover?: CoverPayload | null;
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
  coversUpdated?: number;
  results: Result[];
};

type ExtractedImage = {
  rowNumber: number;
  filename: string;
  mimeType: string;
  base64: string;
};

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  const text = cleanText(value).replace(/[^0-9]/g, "");

  if (!text) return null;

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeZipPath(baseDir: string, target: string): string {
  if (target.startsWith("/")) {
    return target.replace(/^\/+/, "");
  }

  const parts = `${baseDir}/${target}`.split("/");
  const result: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;

    if (part === "..") {
      result.pop();
      continue;
    }

    result.push(part);
  }

  return result.join("/");
}

function getDirectory(path: string): string {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index) : "";
}

function getRelationshipPath(xmlPath: string): string {
  const directory = getDirectory(xmlPath);
  const filename = xmlPath.slice(xmlPath.lastIndexOf("/") + 1);

  return `${directory}/_rels/${filename}.rels`;
}

function findRelationshipTarget(
  relsXml: string,
  relationshipId: string
): string | null {
  const escapedId = escapeRegExp(relationshipId);

  const regex = new RegExp(
    `<Relationship[^>]*Id="${escapedId}"[^>]*Target="([^"]+)"`,
    "i"
  );

  const match = regex.exec(relsXml);

  return match?.[1] ? decodeXml(match[1]) : null;
}

function mimeTypeFromFilename(filename: string): string | null {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (extension === "png") return "image/png";

  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "webp") return "image/webp";

  return null;
}

async function getSheetPath(
  zip: JSZip,
  sheetName: string
): Promise<string> {
  const workbookFile = zip.file("xl/workbook.xml");
  const workbookRelsFile = zip.file(
    "xl/_rels/workbook.xml.rels"
  );

  if (!workbookFile || !workbookRelsFile) {
    throw new Error("엑셀 workbook 정보를 찾을 수 없습니다.");
  }

  const workbookXml = await workbookFile.async("text");
  const workbookRelsXml = await workbookRelsFile.async("text");

  const escapedSheetName = escapeRegExp(sheetName);

  const sheetRegex = new RegExp(
    `<sheet[^>]*name="${escapedSheetName}"[^>]*r:id="([^"]+)"`,
    "i"
  );

  const sheetMatch = sheetRegex.exec(workbookXml);

  if (!sheetMatch?.[1]) {
    throw new Error(`'${sheetName}' 시트를 찾을 수 없습니다.`);
  }

  const target = findRelationshipTarget(
    workbookRelsXml,
    sheetMatch[1]
  );

  if (!target) {
    throw new Error(`'${sheetName}' 시트 경로를 찾을 수 없습니다.`);
  }

  return normalizeZipPath("xl", target);
}

async function extractEmbeddedImages(
  zip: JSZip,
  sheetPath: string
): Promise<ExtractedImage[]> {
  const sheetFile = zip.file(sheetPath);

  if (!sheetFile) return [];

  const sheetXml = await sheetFile.async("text");

  const drawingMatch = sheetXml.match(
    /<drawing[^>]*r:id="([^"]+)"/i
  );

  if (!drawingMatch?.[1]) {
    return [];
  }

  const sheetRelsPath = getRelationshipPath(sheetPath);
  const sheetRelsFile = zip.file(sheetRelsPath);

  if (!sheetRelsFile) {
    return [];
  }

  const sheetRelsXml = await sheetRelsFile.async("text");

  const drawingTarget = findRelationshipTarget(
    sheetRelsXml,
    drawingMatch[1]
  );

  if (!drawingTarget) {
    return [];
  }

  const drawingPath = normalizeZipPath(
    getDirectory(sheetPath),
    drawingTarget
  );

  const drawingFile = zip.file(drawingPath);

  if (!drawingFile) {
    return [];
  }

  const drawingXml = await drawingFile.async("text");

  const drawingRelsPath = getRelationshipPath(drawingPath);
  const drawingRelsFile = zip.file(drawingRelsPath);

  if (!drawingRelsFile) {
    return [];
  }

  const drawingRelsXml = await drawingRelsFile.async("text");

  const images: ExtractedImage[] = [];

  const anchorRegex =
    /<(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)(?:\s[^>]*)?>([\s\S]*?)<\/(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)>/gi;

  for (const match of drawingXml.matchAll(anchorRegex)) {
    const anchorXml = match[1];

    const rowMatch = anchorXml.match(
      /<(?:xdr:)?from>[\s\S]*?<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>[\s\S]*?<\/(?:xdr:)?from>/i
    );

    const embedMatch = anchorXml.match(
      /<(?:a:)?blip[^>]*(?:r:)?embed="([^"]+)"/i
    );

    if (!rowMatch?.[1] || !embedMatch?.[1]) {
      continue;
    }

    // drawing row 값은 0부터 시작한다.
    const rowNumber = Number(rowMatch[1]) + 1;

    const mediaTarget = findRelationshipTarget(
      drawingRelsXml,
      embedMatch[1]
    );

    if (!mediaTarget) {
      continue;
    }

    const mediaPath = normalizeZipPath(
      getDirectory(drawingPath),
      mediaTarget
    );

    const mediaFile = zip.file(mediaPath);

    if (!mediaFile) {
      continue;
    }

    const filename =
      mediaPath.split("/").pop() || `cover-${rowNumber}.png`;

    const mimeType = mimeTypeFromFilename(filename);

    // 교재 표지로 사용할 수 있는 형식만 처리한다.
    if (!mimeType) {
      continue;
    }

    const base64 = await mediaFile.async("base64");

    images.push({
      rowNumber,
      filename,
      mimeType,
      base64,
    });
  }

  return images;
}

async function parseWorkbook(file: File): Promise<ImportRow[]> {
  const arrayBuffer = await file.arrayBuffer();

  /*
   * 1. 셀 데이터 읽기
   */
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
  });

  const sheetName =
    workbook.SheetNames.find(
      (name) => name.trim() === "교재등록"
    ) ?? workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("엑셀 시트를 찾을 수 없습니다.");
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("'교재등록' 시트를 찾을 수 없습니다.");
  }

  /*
   * 첫 행을 헤더라고 가정하지 않는다.
   * 시트 전체를 배열로 읽고 실제 '교재명' 행을 찾는다.
   */
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(
    worksheet,
    {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }
  );

  const headerArrayIndex = matrix.findIndex((row) =>
    Array.isArray(row)
      ? row.some((cell) => cleanText(cell) === "교재명")
      : false
  );

  if (headerArrayIndex < 0) {
    throw new Error(
      "'교재명' 헤더를 찾을 수 없습니다. '교재등록' 시트를 확인해주세요."
    );
  }

  /*
   * 실제 Excel 행 번호도 별도로 찾는다.
   * 그림 anchor는 Excel의 실제 행 번호를 사용하기 때문이다.
   */
  const range = XLSX.utils.decode_range(
    worksheet["!ref"] || "A1:A1"
  );

  let headerSheetRowIndex = -1;
  let titleColumnIndex = -1;

  for (
    let rowIndex = range.s.r;
    rowIndex <= range.e.r && headerSheetRowIndex < 0;
    rowIndex += 1
  ) {
    for (
      let columnIndex = range.s.c;
      columnIndex <= range.e.c;
      columnIndex += 1
    ) {
      const address = XLSX.utils.encode_cell({
        r: rowIndex,
        c: columnIndex,
      });

      if (cleanText(worksheet[address]?.v) === "교재명") {
        headerSheetRowIndex = rowIndex;
        titleColumnIndex = columnIndex;
        break;
      }
    }
  }

  if (headerSheetRowIndex < 0 || titleColumnIndex < 0) {
    throw new Error("'교재명' 헤더 위치를 찾을 수 없습니다.");
  }

  const header = matrix[headerArrayIndex].map((cell) =>
    cleanText(cell)
  );

  const findColumn = (name: string) =>
    header.findIndex((value) => value === name);

  const titleIndex = findColumn("교재명");
  const publisherIndex = findColumn("출판사명");
  const descriptionIndex = findColumn("교재설명");
  const imageIndex = findColumn("교재이미지");
  const priceIndex = findColumn("판매가격");

  if (titleIndex < 0) {
    throw new Error("'교재명' 열을 찾을 수 없습니다.");
  }

  /*
   * 2. XLSX ZIP 내부에서 삽입된 그림 추출
   */
  const zip = await JSZip.loadAsync(arrayBuffer);

  const sheetPath = await getSheetPath(zip, sheetName);

  const embeddedImages = await extractEmbeddedImages(
    zip,
    sheetPath
  );

  const rows: ImportRow[] = [];

  let matrixDataIndex = headerArrayIndex + 1;

  for (
    let sheetRowIndex = headerSheetRowIndex + 1;
    sheetRowIndex <= range.e.r;
    sheetRowIndex += 1
  ) {
    const titleAddress = XLSX.utils.encode_cell({
      r: sheetRowIndex,
      c: titleColumnIndex,
    });

    const title = cleanText(worksheet[titleAddress]?.v);

    if (!title) {
      continue;
    }

    /*
     * matrix에서 현재 교재명이 들어 있는 행을 찾는다.
     * 빈 행이 있어도 잘못 밀리지 않도록 제목으로 확인한다.
     */
    let sourceRow: unknown[] | null = null;

    for (
      ;
      matrixDataIndex < matrix.length;
      matrixDataIndex += 1
    ) {
      const candidate = matrix[matrixDataIndex];

      if (
        Array.isArray(candidate) &&
        cleanText(candidate[titleIndex]) === title
      ) {
        sourceRow = candidate;
        matrixDataIndex += 1;
        break;
      }
    }

    if (!sourceRow) {
      continue;
    }

    const excelRowNumber = sheetRowIndex + 1;

    /*
     * 그림의 왼쪽 위 anchor 행이 현재 교재 행인 경우 연결한다.
     */
    const embeddedCover =
      embeddedImages.find(
        (image) => image.rowNumber === excelRowNumber
      ) ?? null;

    rows.push({
      title,

      publisher:
        publisherIndex >= 0
          ? cleanText(sourceRow[publisherIndex]) || null
          : null,

      description:
        descriptionIndex >= 0
          ? cleanText(sourceRow[descriptionIndex]) || null
          : null,

      image:
        imageIndex >= 0
          ? cleanText(sourceRow[imageIndex]) || null
          : null,

      salePrice:
        priceIndex >= 0
          ? parsePrice(sourceRow[priceIndex])
          : null,

      cover: embeddedCover
        ? {
            filename: embeddedCover.filename,
            mimeType: embeddedCover.mimeType,
            base64: embeddedCover.base64,
          }
        : null,
    });
  }

  if (rows.length === 0) {
    throw new Error("등록할 교재 데이터를 찾을 수 없습니다.");
  }

  return rows;
}

async function readApiResponse(response: Response) {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  throw new Error(
    text.trim() || `서버 요청에 실패했습니다. HTTP ${response.status}`
  );
}

export default function BulkTextbookImportForm() {
  const router = useRouter();

  const [excel, setExcel] = useState<File | null>(null);
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
      const rows = await parseWorkbook(excel);

      const coversFound = rows.filter(
        (row) => Boolean(row.cover)
      ).length;

      /*
       * 이미지 추출에 실패한 상태에서 교재 정보를 다시 갱신하지 않는다.
       * 엑셀 구조를 먼저 확인하도록 중단한다.
       */
      if (coversFound === 0) {
        throw new Error(
          "엑셀에 삽입된 교재 표지 이미지를 찾지 못했습니다. 데이터베이스는 변경하지 않았습니다."
        );
      }

      const response = await fetch(
        "/api/admin/textbooks/bulk-import",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rows }),
        }
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "교재 정보 및 표지 일괄등록에 실패했습니다."
        );
      }

      setResult(data as ResponseData);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "교재 정보 및 표지 일괄등록에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: "grid",
        gap: 20,
      }}
    >
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
          교재등록 엑셀
        </h2>

        <p
          style={{
            color: "#667085",
            lineHeight: 1.7,
          }}
        >
          교재명, 출판사명, 교재설명, 판매가격과 엑셀에 삽입된
          교재 표지를 함께 읽습니다. 자료구분 열은 사용하지 않습니다.
          기존 textbook ID와 Grade 연결은 그대로 유지합니다.
        </p>

        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            setExcel(event.target.files?.[0] ?? null);
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
          자동 처리
        </h2>

        <p
          style={{
            color: "#667085",
            lineHeight: 1.7,
            marginBottom: 0,
          }}
        >
          기존 교재 ID, 커리큘럼 Grade 연결, PDF, 교재 페이지,
          오디오 및 Interactive PDF 데이터는 변경하지 않습니다.
          표지가 정상 추출된 교재만 Storage에 등록합니다.
        </p>
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
          ? "교재 정보와 표지 처리 중..."
          : "교재 정보 + 표지 일괄등록"}
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
            전체 {result.total}종 · 갱신 {result.updated}종 · 표지{" "}
            {result.coversUpdated ?? 0}종 · 미매칭{" "}
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