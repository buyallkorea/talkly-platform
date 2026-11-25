const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("three-pane classroom preserves chat and allows every pane to shrink to 10%", () => {
  const s = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  assert.match(s, /sharedCameraWidth/);
  assert.match(s, /constrain\(at, 10, sharedVideoWidth - 10\)/);
  assert.match(s, /constrain\(at, Math\.max\(20, sharedCameraWidth \+ 10\), 90\)/);
  assert.match(s, /constrain\(at, 10, 100 - chat - 10\)/);
  assert.match(s, /constrain\(100 - at, 10, 100 - video - 10\)/);
  assert.match(s, /onPointerDown=\{handleDown\("camera"\)\}/);
  assert.match(s, /onPointerDown=\{handleDown\("shared"\)\}/);
  assert.match(s, /onPointerDown=\{handleDown\("chat"\)\}/);
  assert.match(s, /비율 초기화/);
  assert.match(s, /localStorage\.setItem/);
  assert.match(s, /\{children\}/);
});

test("Zoom video remains visible in student share mode even before actual screen share", () => {
  const css = read("app/classroom/[sessionId]/zoom-layout.css");
  const embed = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  const frame = read("app/classroom/[sessionId]/ClassroomZoomFrame.tsx");
  assert.match(css, /data-split=true\]\[data-receiving=false\] #talkly-zoom-sdk-root\{width:100%!important\}/);
  assert.match(embed, /talkly-zoom-camera-width/);
  assert.match(frame, /talkly-zoom-camera-width/);
  assert.match(embed, /cameraColumnPixelsRef/);
  assert.match(embed, /client\.setViewType\?\.\("gallery"\)/);
});

test("Zoom connection error recovery remains accessible, while teacher end action is not styled as ended state", () => {
  const controls = read("app/classroom/[sessionId]/ClassSessionControls.tsx");
  const embed = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  const action = read("lib/zoom-ui-controls.ts");
  assert.match(controls, /ui\("수업 끝내기"\)/);
  assert.match(embed, /reconnectClassroom/);
  assert.match(embed, /컴퓨터 오디오/);
  assert.match(action, /turn on/);
  assert.match(action, /turn off/);
});
