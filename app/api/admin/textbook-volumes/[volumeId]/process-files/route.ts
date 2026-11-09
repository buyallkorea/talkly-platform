import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

type Context = { params: Promise<{ volumeId: string }> };
type PageInfo = { page_number: number; page_image_url: string; page_width: number; page_height: number };
type Input = {
  operation?: unknown; textbookId?: unknown; batchId?: unknown;
  storagePath?: unknown; startPage?: unknown;
  sources?: unknown; pages?: unknown;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCEPTED = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);
const MAX_FILE_BYTES = 60 * 1024 * 1024;
const MAX_PAGES = 400;
const MAX_FILES = 400;
const MAX_PIXELS = 35_000_000;
const message = (text: string, status: number) => NextResponse.json({ success: false, error: text }, { status });

function extension(path: string): string {
  return (path.split(".").pop() ?? "").toLowerCase();
}
function validOriginal(path: unknown, prefix: string): path is string {
  return typeof path === "string" && path.startsWith(prefix)
    && /^[a-zA-Z0-9_.-]{1,180}$/.test(path.slice(prefix.length))
    && ACCEPTED.has(extension(path));
}
function validPage(path: unknown, prefix: string): path is string {
  return typeof path === "string" && path.startsWith(prefix)
    && /^page-[0-9]{4}\.png$/.test(path.slice(prefix.length));
}
function pageStoragePath(base: string, number: number): string {
  return base + "page-" + String(number).padStart(4, "0") + ".png";
}
function canvasGlobals(canvas: typeof import("@napi-rs/canvas")) {
  const globalObject = globalThis as unknown as { DOMMatrix?: unknown; ImageData?: unknown; Path2D?: unknown };
  globalObject.DOMMatrix ??= canvas.DOMMatrix;
  globalObject.ImageData ??= canvas.ImageData;
  globalObject.Path2D ??= canvas.Path2D;
}

export async function POST(request: NextRequest, { params }: Context) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return message("로그인이 필요합니다.", 401);
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") return message("관리자 권한이 필요합니다.", 403);

  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host !== request.nextUrl.host) return message("올바르지 않은 요청입니다.", 403); }
    catch { return message("올바르지 않은 요청입니다.", 403); }
  }

  const volumeId = Number((await params).volumeId);
  if (!Number.isSafeInteger(volumeId) || volumeId < 1) return message("올바르지 않은 권 ID입니다.", 400);

  let payload: Input;
  try {
    if (Number(request.headers.get("content-length") || 0) > 160_000) return message("요청 크기를 줄여주세요.", 413);
    payload = await request.json() as Input;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return message("잘못된 요청입니다.", 400);
  } catch { return message("요청 데이터를 확인해주세요.", 400); }
  const textbookId = payload.textbookId;
  const batchId = payload.batchId;
  if (typeof textbookId !== "number" || !Number.isSafeInteger(textbookId) || textbookId < 1
      || typeof batchId !== "string" || !UUID.test(batchId)) return message("교재 ID나 업로드 작업 ID가 올바르지 않습니다.", 400);

  const originalPrefix = `textbooks/${textbookId}/volumes/${volumeId}/original/${batchId}/`;
  const pagesPrefix = `textbooks/${textbookId}/volumes/${volumeId}/pages/${batchId}/`;
  const db = createAdminClient();
  const [{ data: volume, error: volumeError }, { count: currentPageCount, error: countError }] = await Promise.all([
    db.from("textbook_volumes").select("id,textbook_id,status,original_file_url,page_count")
      .eq("id", volumeId).eq("textbook_id", textbookId).maybeSingle(),
    db.from("textbook_pages").select("id", { count: "exact", head: true }).eq("volume_id", volumeId),
  ]);
  if (volumeError || countError) return message("교재 상태를 확인하지 못했습니다.", 503);
  if (!volume) return message("교재 권 정보를 찾을 수 없습니다.", 404);
  if ((currentPageCount ?? 0) > 0 || volume.original_file_url || volume.status === "ready") {
    return message("이미 등록된 교재입니다. 기존 페이지와 오디오 정보를 보호하기 위해 덮어쓸 수 없습니다.", 409);
  }

  if (payload.operation === "render") {
    const sourcePath = payload.storagePath;
    const startPage = payload.startPage;
    if (!validOriginal(sourcePath, originalPrefix) ||
        typeof startPage !== "number" || !Number.isSafeInteger(startPage) ||
        startPage < 1 || startPage > MAX_PAGES) return message("파일 경로 또는 페이지 순서가 올바르지 않습니다.", 400);

    const { data: downloaded, error: downloadError } = await db.storage.from("textbook-files").download(sourcePath);
    if (downloadError || !downloaded) return message("업로드한 원본 파일을 읽지 못했습니다.", 503);
    if (downloaded.size < 1 || downloaded.size > MAX_FILE_BYTES) return message("원본 파일은 60MB 이하여야 합니다.", 413);

    const bytes = Buffer.from(await downloaded.arrayBuffer());
    const canvas = await import("@napi-rs/canvas");
    const createdPaths: string[] = [];
    const output: PageInfo[] = [];
    const addImage = async (image: Buffer, width: number, height: number) => {
      const number = startPage + output.length;
      if (number > MAX_PAGES) throw Error("한 권의 페이지는 400페이지를 넘길 수 없습니다.");
      if (width < 1 || height < 1 || width * height > MAX_PIXELS) throw Error("이미지 해상도가 너무 큽니다.");
      const destination = pageStoragePath(pagesPrefix, number);
      const { error } = await db.storage.from("textbook-pages").upload(destination, image, {
        contentType: "image/png", cacheControl: "3600", upsert: false,
      });
      if (error) throw Error(number + "페이지 저장 실패: " + error.message);
      createdPaths.push(destination);
      output.push({ page_number: number, page_image_url: destination, page_width: width, page_height: height });
    };

    try {
      if (extension(sourcePath) === "pdf") {
        if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return message("PDF 형식이 올바르지 않습니다.", 400);
        canvasGlobals(canvas);
        // PDF.js must be imported after native DOMMatrix/ImageData/Path2D setup.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const loading = pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: false, useSystemFonts: true });
        const pdfDoc = await loading.promise;
        try {
          if (pdfDoc.numPages < 1 || pdfDoc.numPages + startPage - 1 > MAX_PAGES)
            throw Error("PDF 페이지 수가 너무 많습니다. 한 권은 최대 400페이지입니다.");
          for (let index = 1; index <= pdfDoc.numPages; index++) {
            const page = await pdfDoc.getPage(index);
            try {
              const viewport = page.getViewport({ scale: 1.5 });
              const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
              if (width * height > MAX_PIXELS) throw Error("PDF 페이지 해상도가 너무 큽니다.");
              const surface = canvas.createCanvas(width, height);
              const context = surface.getContext("2d");
              await page.render({ canvas: surface as never, canvasContext: context as never, viewport }).promise;
              await addImage(surface.toBuffer("image/png"), width, height);
            } finally { page.cleanup(); }
          }
        } finally { await pdfDoc.destroy(); }
      } else {
        // Decode image bytes; never trust extension or browser MIME alone.
        const source = await canvas.loadImage(bytes);
        const width = source.width, height = source.height;
        if (!width || !height || width * height > MAX_PIXELS)
          throw Error("이미지 크기가 너무 큽니다. 한 페이지는 3,500만 픽셀 이하로 준비해주세요.");
        const surface = canvas.createCanvas(width, height);
        const context = surface.getContext("2d");
        context.drawImage(source, 0, 0);
        await addImage(surface.toBuffer("image/png"), width, height);
      }
      return NextResponse.json({ success: true, pages: output, pageCount: output.length });
    } catch (error) {
      if (createdPaths.length) {
        const { error: cleanupError } = await db.storage.from("textbook-pages").remove(createdPaths);
        if (cleanupError) console.error("TEXTBOOK BATCH RENDER CLEANUP ERROR:", cleanupError.message);
      }
      console.error("TEXTBOOK BATCH RENDER ERROR:", error);
      return message(error instanceof Error ? error.message : "파일 변환 중 오류가 발생했습니다.", 422);
    }
  }

  if (payload.operation === "finalize") {
    const sources = payload.sources, pages = payload.pages;
    if (!Array.isArray(sources) || sources.length < 1 || sources.length > MAX_FILES ||
        new Set(sources).size !== sources.length || !sources.every(path => validOriginal(path, originalPrefix)))
      return message("원본 파일 목록을 확인해주세요.", 400);
    if (!Array.isArray(pages) || pages.length < 1 || pages.length > MAX_PAGES)
      return message("페이지 목록이 올바르지 않습니다.", 400);

    const rows: Array<PageInfo & { textbook_id: number; volume_id: number }> = [];
    for (let i = 0; i < pages.length; i++) {
      const raw = pages[i] as Partial<PageInfo> | null;
      if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
          raw.page_number !== i + 1 ||
          !validPage(raw.page_image_url, pagesPrefix) ||
          raw.page_image_url !== pageStoragePath(pagesPrefix, i + 1) ||
          typeof raw.page_width !== "number" || typeof raw.page_height !== "number" ||
          !Number.isSafeInteger(raw.page_width) || !Number.isSafeInteger(raw.page_height) ||
          raw.page_width < 1 || raw.page_height < 1 ||
          raw.page_width * raw.page_height > MAX_PIXELS) return message("페이지 순서나 이미지 정보가 올바르지 않습니다.", 400);
      rows.push({
        textbook_id: textbookId, volume_id: volumeId,
        page_number: raw.page_number, page_image_url: raw.page_image_url,
        page_width: raw.page_width, page_height: raw.page_height,
      });
    }

    const extensions = (sources as string[]).map(extension);
    const originalFileType = extensions.every(ext => ext === "pdf") ? "pdf"
      : extensions.every(ext => ext !== "pdf") ? "images" : "mixed";

    // Rows are inserted only after all pages are rendered; existing pages untouched.
    const { data: inserted, error: insertError } = await db.from("textbook_pages")
      .insert(rows).select("id,page_number");
    if (insertError || inserted?.length !== rows.length) {
      console.error("TEXTBOOK BATCH INSERT ERROR:", insertError?.message ?? "Count mismatch");
      return message("페이지 저장이 완료되지 않았습니다. 새로고침 후 상태를 확인해주세요.", 503);
    }
    const { data: updated, error: updateError } = await db.from("textbook_volumes")
      .update({
        original_file_url: sources[0], original_file_type: originalFileType,
        page_count: rows.length, status: "ready", updated_at: new Date().toISOString(),
      })
      .eq("id", volumeId).eq("textbook_id", textbookId)
      .select("id,page_count,status").single();
    if (updateError || !updated) {
      console.error("TEXTBOOK BATCH VOLUME UPDATE ERROR:", updateError?.message);
      // Never delete inserted pages after a successful DB insert.
      return message("페이지는 저장되었지만 교재 상태 갱신이 완료되지 않았습니다. 관리자 확인이 필요합니다.", 503);
    }
    return NextResponse.json({ success: true, pageCount: rows.length, volume: updated });
  }

  if (payload.operation === "discard") {
    const sources = payload.sources, pages = payload.pages;
    if (!Array.isArray(sources) || sources.length > MAX_FILES || !sources.every(path => validOriginal(path, originalPrefix))
      || !Array.isArray(pages) || pages.length > MAX_PAGES || !pages.every(path => validPage(path, pagesPrefix)))
      return message("정리할 파일 목록이 올바르지 않습니다.", 400);
    const [sourceResult, pageResult] = await Promise.all([
      sources.length ? db.storage.from("textbook-files").remove(sources) : Promise.resolve({ error: null }),
      pages.length ? db.storage.from("textbook-pages").remove(pages) : Promise.resolve({ error: null }),
    ]);
    if (sourceResult.error || pageResult.error) return message("일부 임시 파일을 정리하지 못했습니다.", 503);
    return NextResponse.json({ success: true });
  }
  return message("지원하지 않는 작업입니다.", 400);
}
