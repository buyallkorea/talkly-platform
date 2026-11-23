const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = path => fs.readFileSync(path, "utf8");

test("AI studio preserves natural voice conversation and shows actual transcript", () => {
  const studio = read("app/talkly-ai/AiStudio.tsx");
  const panel = read("app/talkly-ai/SessionLearningTools.tsx");
  assert.match(studio, /conversation\.item\.input_audio_transcription\.completed/);
  assert.match(studio, /response\.output_audio_transcript\.done/);
  assert.match(studio, /<SessionLearningTools/);
  assert.match(panel, /turns\.map\(\(turn, index\)/);
  assert.match(panel, /turn\.text/);
  assert.match(panel, /자막 숨기기/);
  assert.match(panel, /자막 표시/);
  assert.match(panel, /음성 인식 결과/);
  assert.match(panel, /생활 문법 보기/);
});
test("grammar tips require exact learner turn and are generated only on one-time summary", () => {
  const summaries = read("lib/talkly-ai/reports.ts");
  const route = read("app/api/talkly-ai/session/summary/route.ts");
  assert.match(summaries, /function validateGrammarNotes/);
  assert.match(summaries, /userPhrases\.some/);
  assert.match(route, /validateGrammarNotes\(parsed\.grammarNotes, turns\)/);
  assert.match(route, /grammarNotes/);
  assert.match(route, /status: succeeded \? "ready" : "not_saved", notes:/);
  assert.match(route, /learning_summary_consent_at/);
  assert.match(route, /s\.state !== "closed"/);
  assert.match(route, /"session_id", s\.id/);
});
test("PDF is generated privately and directly downloaded as .pdf", () => {
  const pdf = read("lib/talkly-ai/daily-pdf.ts");
  const ui = read("app/talkly-ai/SessionLearningTools.tsx");
  assert.match(pdf, /%PDF-1\.4/);
  assert.match(pdf, /\/Filter \/DCTDecode/);
  assert.match(pdf, /application\/pdf/);
  assert.match(pdf, /anchor\.download = "TALKLY-AI-"/);
  assert.match(pdf, /canvas\.toDataURL\("image\/jpeg"/);
  assert.doesNotMatch(pdf, /fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(ui, /downloadDailyLessonPdf/);
  assert.match(ui, /PDF에는 현재 화면의 대화문/);
});
test("AI homepage shows TALKLY-inspired editorial design and avoids false testimonial claims", () => {
  const page = read("app/talkly-ai/page.tsx");
  const css = read("app/talkly-ai/talkly-ai.css");
  assert.match(page, /YOUR ENGLISH, YOUR PACE/);
  assert.match(page, /tai-benefits/);
  assert.match(page, /tai-how/);
  assert.match(page, /id="tai-studio"/);
  assert.match(page, /<AiStudio \/>/);
  assert.match(page, /성인 이용 기준 적용/);
  assert.match(css, /tai-ai-hero/);
  assert.match(css, /tai-study-desk/);
  assert.match(css, /@media\(max-width:480px\)/);
});
