const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("Zoom diagnostics is controlled, dismissible and never auto-opens on media errors", () => {
  const component = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  assert.match(component, /useState\(false\)/);
  assert.match(component, /onClick=\{\(\) => setDiagnosticsOpen\(open => !open\)\}/);
  assert.match(component, /onClick=\{\(\) => setDiagnosticsOpen\(false\)\}/);
  assert.match(component, /\{diagnosticsOpen && <div id="talkly-zoom-help-panel"/);
  assert.doesNotMatch(component, /setDiagnosticsOpen\(true\)/);
  assert.doesNotMatch(component, /<details className="talkly-zoom-diagnostics"/);
  assert.doesNotMatch(component, /className="talkly-zoom-camera-access"/);
});

test("normal video/audio controls remain visible, audio join request remains available", () => {
  const component = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  const css = read("app/classroom/[sessionId]/zoom-layout.css");
  assert.match(component, /nativeAction\("video"\)/);
  assert.match(component, /audioAction\(\)/);
  assert.match(component, /screen === "joined" && audioAttention &&/);
  assert.match(component, /aria-label=\{hostMode \? "Close help" : "도움말 닫기"\}/);
  assert.match(css, /talkly-zoom-help-close/);
  assert.match(css, /talkly-audio-instructions \{ display:none; \}/);
});
