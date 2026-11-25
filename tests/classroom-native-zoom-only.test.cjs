const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("classroom displays only Zoom-owned audio, video and sharing controls", () => {
  const s = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  assert.match(s, /await client\.join\(/);
  assert.match(s, /id="talkly-zoom-sdk-root"/);
  assert.doesNotMatch(s, /className="talkly-zoom-status"/);
  assert.doesNotMatch(s, /className="talkly-audio-connection-banner"/);
  assert.doesNotMatch(s, /className="talkly-zoom-diagnostics"/);
  assert.doesNotMatch(s, /className="talkly-zoom-camera-access"/);
  assert.match(s, /<div className="talkly-zoom-body">/);
});

test("Zoom native toolbar stays fully visible for teachers and students", () => {
  const css = read("app/classroom/[sessionId]/zoom-layout.css");
  assert.match(css, /talkly-zoom-shell\[data-host=true\] \.talkly-sdk-native-toolbar/);
  assert.match(css, /opacity:1!important/);
  assert.match(css, /visibility:visible!important/);
  const stage = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  assert.match(stage, /handleDown\("camera"\)/);
  assert.match(stage, /handleDown\("shared"\)/);
  assert.match(stage, /handleDown\("chat"\)/);
});
