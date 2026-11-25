const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("ODP layout keeps one small lesson header with class status and elapsed time", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  const controls = read("app/classroom/[sessionId]/ClassSessionControls.tsx");
  assert.doesNotMatch(page, /<strong>CLASS CONTROL<\/strong>/);
  assert.match(page, /ClassSessionControls/);
  assert.match(controls, /elapsedLabel/);
  assert.match(controls, /role="timer"/);
});

test("teacher selects only material mode, student only reads selected material type", () => {
  const stage = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  assert.match(stage, /onChange=\{event => void change/);
  assert.doesNotMatch(stage, /Screen share help/);
  assert.doesNotMatch(stage, /Teaching with online materials/);
  assert.match(stage, /handleDown\("camera"\)/);
  assert.match(stage, /handleDown\("chat"\)/);
});

test("Zoom native media controls remain; external Zoom app fallback appears only after SDK error", () => {
  const wrapper = read("app/classroom/[sessionId]/ClassroomResponsiveZoom.tsx");
  const zoom = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  assert.match(wrapper, /safeJoinUrl && zoomFailed/);
  assert.match(wrapper, /event\.source !== frame\.contentWindow/);
  assert.match(zoom, /talkly-zoom-connection-state/);
  assert.match(zoom, /id="talkly-zoom-sdk-root"/);
  assert.doesNotMatch(zoom, /className="talkly-zoom-status"/);
});

test("test student readiness polling stays but extra banner disappears; chat has only messages and input", () => {
  const watcher = read("app/classroom/[sessionId]/TestStudentStartWatcher.tsx");
  const chat = read("app/classroom/[sessionId]/ClassroomChat.tsx");
  assert.match(watcher, /window\.setInterval\(check, 2000\)/);
  assert.match(watcher, /return null;/);
  assert.doesNotMatch(chat, /className="talkly-chat-hint"/);
  assert.match(chat, /className="talkly-chat-form"/);
});
