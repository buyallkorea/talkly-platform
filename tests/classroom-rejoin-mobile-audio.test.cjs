const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const read = file => fs.readFileSync(file, "utf8");

test("in-progress lessons bypass teacher materials selection on reentry", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  assert.match(page, /hostMode && materials !== "ready" && session\.status !== "in_progress"/);
  assert.match(page, /<ClassroomResponsiveZoom meetingUrl=\{session\.meeting_url\} hostMode=\{hostMode\}>/);
  assert.match(page, /session\.ended_at \|\| session\.status === "completed"/);
  const zoomAccess = read("lib/classroom-zoom-access.ts");
  assert.match(zoomAccess, /\["scheduled", "in_progress"\]/);
  assert.match(zoomAccess, /session\.ended_at/);
});

test("Zoom mobile app URL accepts only https Zoom meeting links", () => {
  const source = read("app/classroom/[sessionId]/ClassroomResponsiveZoom.tsx");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    URL,
    require(name) {
      if (name === "react") return {};
      if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
      throw new Error("Unexpected import " + name);
    },
  });
  assert.equal(exports.safeZoomMeetingUrl("https://zoom.us/j/123456789?pwd=test"), "https://zoom.us/j/123456789?pwd=test");
  assert.equal(exports.safeZoomMeetingUrl("https://us06web.zoom.us/j/123456789"), "https://us06web.zoom.us/j/123456789");
  for (const invalid of [
    "https://zoom.us.evil.example/j/123", "https://evil.example/zoom.us/j/123",
    "javascript:alert(1)", "http://zoom.us/j/123456",
    "https://zoom.us/evil/123456", "", null,
  ]) assert.equal(exports.safeZoomMeetingUrl(invalid), null);
  assert.match(source, /setView\(handheld \? "mobile" : "embedded"\)/);
  assert.match(source, /view === "external"/);
  assert.match(source, /setView\("external"\)/);
  assert.match(source, /오디오 연결 문제\? Zoom 앱에서 열기/);
  assert.match(source, /Zoom 앱에서 수업 열기/);
  assert.match(source, /view === "checking"/);
  assert.match(source, /target="_blank" rel="noopener noreferrer"/);
  assert.match(source, /브라우저 화면으로 시도 \(모바일 지원 제한\)/);
  assert.match(source, /강사 호스트 권한은 Zoom 앱에 자동으로 전달되지 않습니다/);
});

test("Zoom reconnect explicitly confirms and keeps backend class state unchanged", () => {
  const embed = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  assert.match(embed, /function reconnectClassroom\(\)/);
  assert.match(embed, /window\.confirm\(hostMode/);
  assert.match(embed, /retryZoom\(\)/);
  assert.match(embed, /await teardownRef\.current/);
  assert.match(embed, /teardownRef\.current = previousCleanup/);
  assert.match(embed, /Reconnect Zoom · 다시 연결/);
  assert.match(embed, /Meeting joined · 영상 입장 완료/);
  assert.match(embed, /Connect computer audio · 오디오 연결/);
  assert.match(embed, /<details className="talkly-textbook-audio-help">/);
  assert.doesNotMatch(embed, /fetch\("\/api\/classroom\/session-status",.*reconnectClassroom/s);
});

test("small screens use stacked panels and compact Zoom controls without touching SDK-owned nodes", () => {
  const classroom = read("app/classroom/[sessionId]/page.tsx");
  const css = read("app/classroom/[sessionId]/zoom-layout.css");
  assert.match(classroom, /@media \(max-width: 1050px\)/);
  assert.match(classroom, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(classroom, /talkly-mobile-zoom-access/);
  assert.match(css, /@media \(max-width: 1050px\)/);
  assert.match(css, /max-height: min\(43dvh, 205px\)/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /min-height: 43px/);
  const frame = read("app/classroom/[sessionId]/ClassroomZoomFrame.tsx");
  assert.match(frame, /allow="camera; microphone; display-capture; autoplay; fullscreen"/);
});
