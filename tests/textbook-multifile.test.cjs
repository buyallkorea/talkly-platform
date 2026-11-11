const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

test("the volume upload form accepts many single-page PDF/JPG/PNG/WEBP files in natural numeric order", () => {
  const form = read("app/admin/textbooks/[id]/volumes/[volumeId]/VolumePdfManager.tsx");
  assert.match(form, /multiple accept="\.pdf,\.jpg,\.jpeg,\.png,\.webp/);
  assert.match(form, /new Intl\.Collator\("ko", \{ numeric: true/);
  const sorter = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
  assert.deepEqual(["page-10.jpg", "page-2.pdf", "page-1.png"].sort((a,b) => sorter.compare(a,b)),
    ["page-1.png","page-2.pdf","page-10.jpg"]);
  assert.match(form, /function move\(index: number, delta: number\)/);
  assert.match(form, /operation: "render"/);
  assert.match(form, /operation: "finalize"/);
  assert.match(form, /startPage: pages\.length \+ 1/);
  assert.match(form, /originalFileUrl/);
  assert.match(form, /alreadyProcessed/);
});

test("server only renders after admin role and preserves existing audiobook hotspots", () => {
  const processor = read("app/api/admin/textbook-volumes/[volumeId]/process-files/route.ts");
  assert.match(processor, /supabase\.auth\.getUser\(\)/);
  assert.match(processor, /profile\?\.role !== "admin"/);
  assert.match(processor, /currentPageCount/);
  assert.match(processor, /volume\.original_file_url/);
  assert.match(processor, /status === "ready"/);
  assert.match(processor, /return message\("이미 등록된 교재입니다/);
  assert.match(processor, /sourcePath\) === "pdf"/);
  assert.match(processor, /loadImage\(bytes\)/);
  assert.match(processor, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(processor, /contentType: "image\/png"/);
  assert.match(processor, /\.from\("textbook_pages"\)/);
  assert.match(processor, /\.insert\(rows\)/);
  assert.match(processor, /page_count: rows\.length/);
  assert.match(processor, /original_file_type: originalFileType/);
  assert.doesNotMatch(processor, /\.from\("textbook_hotspots"\)\.(?:delete|update)/);
  assert.doesNotMatch(processor, /\.from\("textbooks"\)\.update/);
});

test("separate PDF pages and images are combined into a single safe volume without overwrite", () => {
  const processor = read("app/api/admin/textbook-volumes/[volumeId]/process-files/route.ts");
  const form = read("app/admin/textbooks/[id]/volumes/[volumeId]/VolumePdfManager.tsx");
  assert.match(processor, /const MAX_PAGES = 400/);
  assert.match(processor, /pageStoragePath\(pagesPrefix, number\)/);
  assert.match(processor, /validOriginal\(sourcePath, originalPrefix\)/);
  assert.match(processor, /validPage\(raw\.page_image_url, pagesPrefix\)/);
  assert.match(processor, /raw\.page_number !== i \+ 1/);
  assert.match(processor, /upsert: false/);
  assert.match(processor, /const createdPaths: string\[\] = \[\]/);
  assert.match(processor, /storage\.from\("textbook-pages"\)\.remove\(createdPaths\)/);
  assert.match(processor, /if \(payload\.operation === "discard"\)/);
  assert.match(form, /등록이 완료될 때까지 이 페이지를 닫거나 새로고침하지 마세요/);
});

test("teacher profile shows biography beside photograph and credentials in three sections", () => {
  const page = read("app/teachers/[id]/page.tsx");
  const css = read("app/globals.css");
  assert.match(page, /talkly-public-teacher-profile-hero/);
  assert.match(page, /talkly-public-teacher-introduction/);
  assert.match(page, /\{teacher\.bio\}/);
  assert.doesNotMatch(page, /학생 한 명 한 명의 성장을 함께하는 TALKLY 강사입니다/);
  assert.equal((page.match(/className="talkly-public-teacher-info-card"/g)||[]).length, 3);
  assert.match(page, /강의 경력/);
  assert.match(page, /학력/);
  assert.match(page, /자격 및 인증/);
  assert.match(page, /자격 및 인증 · 전문분야/);
  assert.equal((page.match(/<h2>자격 및 인증 · 전문분야<\/h2>/g)||[]).length, 1);
  assert.match(page, /aria-label="자격 및 인증"/);
  assert.match(page, /aria-label="전문분야"/);
  assert.doesNotMatch(page, /<h3>자격 및 인증<\/h3>/);
  assert.match(page, /teacher\.specialties\.length > 0/);
  assert.match(page, /teacher\.specialties\.join\(" · "\)/);
  assert.match(page, /talkly-public-teacher-specialties-text/);
  assert.doesNotMatch(page, /<h3>전문분야<\/h3>/);
  assert.doesNotMatch(page, /talkly-public-teacher-specialty-list/);
  assert.match(css, /\.talkly-public-teacher-credentials-card\{grid-column:1\/-1\}/);
  assert.match(read("lib/public-teachers.ts"), /specialties: \(teacher\.specialties \?\? \[\]\)/);
  assert.match(css, /\.talkly-public-teacher-profile-sections\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(page, /await requireTeacherDirectoryMember/);
});
