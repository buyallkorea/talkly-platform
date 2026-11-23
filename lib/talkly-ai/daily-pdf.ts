import type { Turn } from "./config";
import type { LearningSummary } from "./reports";

export type GrammarNote = { before: string; after: string; rule: string; example: string };
export type DailyLessonNotes = LearningSummary & { grammarNotes: GrammarNote[] };

/**
 * Generates a real, offline PDF download. Text is rendered on the learner's
 * device first so Korean glyphs are supported without uploading transcripts,
 * remote font downloads, or a paid PDF service. The PDF is image-based: keep
 * the selectable transcript in the accessible lesson UI as well.
 */
export function downloadDailyLessonPdf(input: {
  tutor: string;
  turns: Turn[];
  notes: DailyLessonNotes | null;
  date?: Date;
}) {
  if (typeof document === "undefined") throw new Error("PDF는 브라우저에서만 저장할 수 있어요.");
  const date = input.date ?? new Date();
  const kst = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", dateStyle: "long",
  }).format(date);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  const W = 1240, H = 1754, margin = 84, endY = H - 116, available = W - margin * 2;
  // Convert each finished page immediately; avoid holding many large canvases
  // in memory on phones and tablets.
  const images: Uint8Array[] = [];
  let canvas!: HTMLCanvasElement, ctx!: CanvasRenderingContext2D, y = 0, pageNo = 0;

  function flushPage() {
    if (!pageNo) return;
    ctx.fillStyle = "#94a3b8";
    ctx.font = '23px "Noto Sans KR", Arial, sans-serif';
    ctx.fillText("TALKLY AI  ·  내 기기에서 생성한 수업 기록", margin, H - 80);
    ctx.textAlign = "right";
    ctx.fillText(String(pageNo), W - margin, H - 80);
    ctx.textAlign = "left";
    images.push(base64ToBytes(canvas.toDataURL("image/jpeg", 0.86).split(",")[1] ?? ""));
    canvas.width = 0;
    canvas.height = 0;
  }
  function makePage() {
    flushPage();
    pageNo++;
    canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF 화면을 그릴 수 없어요.");
    ctx = context;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#3f3270";
    ctx.fillRect(0, 0, W, 15);
    ctx.font = '800 25px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
    ctx.fillStyle = "#57479a";
    ctx.fillText("TALKLY AI  /  DAILY CONVERSATION", margin, 49);
    y = 115;
  }
  function color(fill: string) { ctx.fillStyle = fill; }
  function font(size: number, bold = false) {
    ctx.font = (bold ? "700 " : "400 ") + size + 'px "Noto Sans KR", "Malgun Gothic", Arial, sans-serif';
  }
  function ensure(space: number) { if (y + space > endY) makePage(); }
  function line(text: string, { size = 27, bold = false, ink = "#1f2440", height = 43, indent = 0 } = {}) {
    ensure(height);
    font(size, bold); color(ink);
    ctx.fillText(text, margin + indent, y);
    y += height;
  }
  function paragraph(value: string, opts: {
    size?: number; ink?: string; indent?: number; bold?: boolean; gap?: number;
  } = {}) {
    const size = opts.size ?? 27, indent = opts.indent ?? 0;
    const width = available - indent;
    const raw = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 900);
    if (!raw) return;
    ensure(43);
    font(size, !!opts.bold);
    let current = "";
    // Codepoint wrapping works for Korean, English and long strings without spaces.
    for (const char of Array.from(raw)) {
      const candidate = current + char;
      if (ctx.measureText(candidate).width > width && current) {
        line(current, { size, indent, ink: opts.ink ?? "#344054", bold: opts.bold });
        current = char;
      } else current = candidate;
    }
    if (current) line(current, { size, indent, ink: opts.ink ?? "#344054", bold: opts.bold });
    y += opts.gap ?? 8;
  }
  function section(label: string) {
    ensure(90);
    y += 21;
    ctx.fillStyle = "#ede7f8";
    ctx.fillRect(margin, y, available, 2);
    y += 23;
    line(label, { size: 32, bold: true, ink: "#3a2b78", height: 54 });
  }
  makePage();
  line("오늘의 영어회화 학습 기록", { size: 48, bold: true, ink: "#211a41", height: 78 });
  line(kst + "  ·  AI Tutor: " + input.tutor.slice(0, 50), {
    size: 25, ink: "#64748b", height: 43,
  });
  paragraph("이 자료는 자동 음성 인식과 AI 분석을 바탕으로 작성되었습니다. 발화 전사·교정에 오류가 있을 수 있으며 공인 평가 결과가 아닙니다.", { size: 23, ink: "#667085" });

  if (input.notes?.topics.length) {
    section("오늘 이야기한 주제");
    input.notes.topics.slice(0, 3).forEach(topic => paragraph("• " + topic));
  }
  section("오늘의 영어 대화");
  const turns = input.turns.slice(-100);
  if (!turns.length) paragraph("기록된 대화 문장이 없습니다.");
  turns.forEach((item) => {
    const role = item.role === "user" ? "나" : input.tutor.slice(0, 50);
    ensure(78);
    line(role, { size: 22, bold: true, ink: item.role === "user" ? "#7451ba" : "#176c76", height: 34 });
    paragraph(item.text, { size: 27, indent: 14, gap: 16 });
  });
  if (input.notes?.grammarNotes.length) {
    section("실제 대화에서 배운 생활 문법");
    input.notes.grammarNotes.slice(0, 3).forEach((g, i) => {
      ensure(150);
      line(String(i + 1) + ". 내가 한 말", { size: 22, bold: true, ink: "#64748b", height: 32 });
      paragraph(g.before);
      line("이렇게 표현해 보세요", { size: 22, bold: true, ink: "#176c76", height: 32 });
      paragraph(g.after, { bold: true, ink: "#126d65" });
      paragraph(g.rule, { size: 24 });
      if (g.example) paragraph("예문: " + g.example, { size: 23, ink: "#7451ba", gap: 22 });
    });
  }
  if (input.notes?.expressions.length) {
    section("오늘의 유용한 영어 표현");
    input.notes.expressions.slice(0, 3).forEach((exp, i) => paragraph(String(i + 1) + ". " + exp));
  }
  if (input.notes?.nextPractice) {
    section("다음 수업에 연습할 내용");
    paragraph(input.notes.nextPractice);
  }
  flushPage();
  const blob = new Blob([pdfWithJpegPages(images, W, H).buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "TALKLY-AI-" + day + ".pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, item) => n + item.length, 0);
  const all = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { all.set(part, offset); offset += part.length; }
  return all;
}
export function pdfWithJpegPages(images: Uint8Array[], width: number, height: number): Uint8Array {
  if (!images.length || images.length > 100 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height))
    throw new Error("PDF 페이지 정보가 유효하지 않아요.");
  const encode = (s: string) => new TextEncoder().encode(s);
  const objects: Uint8Array[] = [];
  const kids = images.map((_, i) => String(5 + i * 3) + " 0 R").join(" ");
  objects.push(encode("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.push(encode("<< /Type /Pages /Kids [" + kids + "] /Count " + images.length + " >>"));
  images.forEach((jpeg, i) => {
    const imageId = 3 + i * 3, contentId = 4 + i * 3;
    objects.push(concatBytes([
      encode("<< /Type /XObject /Subtype /Image /Width " + width + " /Height " + height +
        " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n"),
      jpeg, encode("\nendstream"),
    ]));
    const content = "q\n595.28 0 0 841.89 0 0 cm\n/Im Do\nQ\n";
    objects.push(encode("<< /Length " + encode(content).length + " >>\nstream\n" + content + "endstream"));
    objects.push(encode("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] " +
      "/Resources << /XObject << /Im " + imageId + " 0 R >> >> /Contents " + contentId + " 0 R >>"));
  });
  const chunks: Uint8Array[] = [encode("%PDF-1.4\n%PDF-DATA\n")];
  const offsets = [0];
  let current = chunks[0].length;
  objects.forEach((object, idx) => {
    offsets.push(current);
    const part = concatBytes([encode(String(idx + 1) + " 0 obj\n"), object, encode("\nendobj\n")]);
    chunks.push(part); current += part.length;
  });
  const xrefAt = current;
  let trailer = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (const offset of offsets.slice(1))
    trailer += String(offset).padStart(10, "0") + " 00000 n \n";
  trailer += "trailer\n<< /Size " + (objects.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" + xrefAt + "\n%%EOF\n";
  chunks.push(encode(trailer));
  return concatBytes(chunks);
}
