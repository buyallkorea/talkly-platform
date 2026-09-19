import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Row = {
  title: string;
  publisher: string | null;
  description: string | null;
  image: string | null;
  salePrice: number | null;
};

type Textbook = {
  id: number;
  title: string;
  publisher: string | null;
  description: string | null;
  cover_image_url: string | null;
  sale_price: number | null;
};

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, ""));
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\blv\.?\s*/g, "")
    .replace(/\b3rd\b/g, "")
    .replace(/\(oup\)/g, "")
    .replace(/starter\s*[-~]\s*5$/g, "")
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function fileStem(value: string) {
  return value.replace(/\.[^.]+$/, "");
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
}

function columnIndex(cellRef: string) {
  const letters = cellRef.match(/[A-Z]+/i)?.[0]?.toUpperCase() || "A";
  let value = 0;
  for (const char of letters) value = value * 26 + char.charCodeAt(0) - 64;
  return value - 1;
}

function parseWorkbook(buffer: Buffer): Row[] {
  const zip = new AdmZip(buffer);
  const sharedXml = zip.getEntry("xl/sharedStrings.xml")?.getData().toString("utf8") || "";
  const sharedStrings = Array.from(sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((match) =>
    Array.from(match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
      .map((item) => decodeXml(item[1]))
      .join("")
  );

  const workbookXml = zip.getEntry("xl/workbook.xml")?.getData().toString("utf8") || "";
  const relsXml = zip.getEntry("xl/_rels/workbook.xml.rels")?.getData().toString("utf8") || "";
  const sheetMatch = workbookXml.match(/<sheet[^>]*name="교재등록"[^>]*r:id="([^"]+)"/);
  const relId = sheetMatch?.[1];
  let target = "worksheets/sheet1.xml";
  if (relId) {
    const rel = new RegExp(`<Relationship[^>]*Id="${relId}"[^>]*Target="([^"]+)"`).exec(relsXml);
    if (rel?.[1]) target = rel[1].replace(/^\//, "").replace(/^xl\//, "");
  }
  const sheetPath = target.startsWith("worksheets/") ? `xl/${target}` : `xl/${target}`;
  const sheetXml = zip.getEntry(sheetPath)?.getData().toString("utf8");
  if (!sheetXml) throw new Error("'교재등록' 시트를 찾을 수 없습니다.");

  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1] || "A1";
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
      let raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      if (type === "s") raw = sharedStrings[Number(raw)] ?? "";
      else if (type === "inlineStr") raw = stripTags(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] || "");
      else raw = decodeXml(raw);
      cells[columnIndex(ref)] = raw.trim();
    }
    rows.push(cells);
  }

  const headerIndex = rows.findIndex((r) => r.some((v) => v === "교재명"));
  if (headerIndex < 0) throw new Error("'교재명' 헤더를 찾을 수 없습니다.");
  const header = rows[headerIndex];
  const idx = (name: string) => header.findIndex((v) => v === name);
  const titleIdx = idx("교재명");
  const publisherIdx = idx("출판사명");
  const descriptionIdx = idx("교재설명");
  const imageIdx = idx("교재이미지");
  const priceIdx = idx("판매가격");

  return rows.slice(headerIndex + 1).map((r) => {
    const priceText = priceIdx >= 0 ? (r[priceIdx] || "").replace(/[^0-9]/g, "") : "";
    return {
      title: (r[titleIdx] || "").trim(),
      publisher: publisherIdx >= 0 ? (r[publisherIdx] || "").trim() || null : null,
      description: descriptionIdx >= 0 ? (r[descriptionIdx] || "").trim() || null : null,
      image: imageIdx >= 0 ? (r[imageIdx] || "").trim() || null : null,
      salePrice: priceText ? Number(priceText) : null,
    };
  }).filter((r) => r.title);
}

function findTextbook(rowTitle: string, textbooks: Textbook[]) {
  const needle = normalizeTitle(rowTitle);
  const exact = textbooks.filter((t) => normalizeTitle(t.title) === needle);
  if (exact.length === 1) return exact[0];
  const close = textbooks.filter((t) => {
    const candidate = normalizeTitle(t.title);
    return candidate.length >= 8 && (candidate.startsWith(needle) || needle.startsWith(candidate));
  });
  return close.length === 1 ? close[0] : null;
}

function findCover(row: Row, files: File[]) {
  if (row.image) {
    const wanted = row.image.toLowerCase();
    const exact = files.find((file) => file.name.toLowerCase() === wanted);
    if (exact) return exact;
  }
  const titleKey = normalizeTitle(row.title);
  const matches = files.filter((file) => normalizeTitle(fileStem(file.name)) === titleKey);
  return matches.length === 1 ? matches[0] : null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const form = await request.formData();
    const excel = form.get("excel");
    if (!(excel instanceof File)) {
      return NextResponse.json({ error: "엑셀 파일을 선택해주세요." }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(excel.name)) {
      return NextResponse.json({ error: "XLSX 파일만 사용할 수 있습니다." }, { status: 400 });
    }
    const coverFiles = form.getAll("covers").filter((v): v is File => v instanceof File && v.size > 0);
    const rows = parseWorkbook(Buffer.from(await excel.arrayBuffer()));
    if (rows.length === 0) return NextResponse.json({ error: "등록할 교재 행이 없습니다." }, { status: 400 });

    const admin = createAdminClient();
    const { data: textbooks, error: textbookError } = await admin
      .from("textbooks")
      .select("id,title,publisher,description,cover_image_url,sale_price");
    if (textbookError) throw textbookError;

    const results: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      const textbook = findTextbook(row.title, (textbooks || []) as Textbook[]);
      if (!textbook) {
        results.push({ title: row.title, status: "unmatched", message: "기존 교재와 자동 매칭되지 않았습니다." });
        continue;
      }

      let coverPath = textbook.cover_image_url;
      const cover = findCover(row, coverFiles);
      if (cover) {
        if (!/^image\/(jpeg|png|webp)$/i.test(cover.type)) {
          results.push({ title: row.title, textbookId: textbook.id, status: "failed", message: `지원하지 않는 표지 형식: ${cover.name}` });
          continue;
        }
        const safeName = sanitizeFilename(cover.name);
        const newPath = `covers/bulk/${textbook.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await admin.storage.from("textbook-files").upload(
          newPath,
          Buffer.from(await cover.arrayBuffer()),
          { contentType: cover.type, cacheControl: "3600", upsert: false }
        );
        if (uploadError) {
          results.push({ title: row.title, textbookId: textbook.id, status: "failed", message: `표지 업로드 실패: ${uploadError.message}` });
          continue;
        }
        coverPath = newPath;
      }

      const update: Record<string, unknown> = {
        publisher: row.publisher,
        description: row.description,
        sale_price: row.salePrice,
        updated_at: new Date().toISOString(),
      };
      if (coverPath) update.cover_image_url = coverPath;

      const { error: updateError } = await admin.from("textbooks").update(update).eq("id", textbook.id);
      if (updateError) {
        if (cover && coverPath && coverPath !== textbook.cover_image_url) {
          await admin.storage.from("textbook-files").remove([coverPath]);
        }
        results.push({ title: row.title, textbookId: textbook.id, status: "failed", message: updateError.message });
        continue;
      }

      if (cover && textbook.cover_image_url && textbook.cover_image_url !== coverPath) {
        await admin.storage.from("textbook-files").remove([textbook.cover_image_url]);
      }
      results.push({
        title: row.title,
        matchedTitle: textbook.title,
        textbookId: textbook.id,
        status: "updated",
        coverUpdated: Boolean(cover),
      });
    }

    const updated = results.filter((r) => r.status === "updated").length;
    const unmatched = results.filter((r) => r.status === "unmatched").length;
    const failed = results.filter((r) => r.status === "failed").length;
    return NextResponse.json({ total: rows.length, updated, unmatched, failed, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "교재 일괄등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
