const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = path => fs.readFileSync(path, "utf8");

test("Issue 56: desktop classroom dedicates 20%, 50%, 30% to video, materials and chat", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  assert.match(page, /grid-template-columns: minmax\(0, 2fr\) minmax\(0, 5fr\) minmax\(0, 3fr\)/);
  assert.match(page, /talkly-classroom-video/);
  assert.match(page, /talkly-classroom-textbook/);
  assert.match(page, /<ClassroomChat/);
  assert.match(page, /@media \(min-width: 900px\) and \(max-width: 1050px\)/);
  assert.match(page, /@media \(max-width: 640px\)/);
  assert.match(page, /talkly-classroom-stage\[data-material-mode="screen"\] > \.talkly-classroom-video \{ grid-column: 1 \/ 3/);
  assert.match(page, /talkly-classroom-screen-guide/);
});

test("Issue 56: device controls below video and errors marked red without moving SDK nodes", () => {
  const css = read("app/classroom/[sessionId]/zoom-layout.css");
  const zoom = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  assert.match(css, /ISSUE-56/);
  assert.match(css, /\.talkly-zoom-body \{\s*order:0/);
  assert.match(css, /\.talkly-zoom-status \{[\s\S]*?order:1/);
  assert.match(css, /\.talkly-zoom-health\[data-health=error\]/);
  assert.match(css, /flex:0 0 38px/);
  assert.match(css, /talkly-zoom-diagnostic-panel/);
  assert.match(css, /talkly-zoom-diagnostics:not\(\[open\]\) > \.talkly-zoom-diagnostic-panel \{ display:none/);
  assert.match(zoom, /className="talkly-zoom-quick-actions"/);
  assert.match(zoom, /className="talkly-zoom-diagnostics"/);
  assert.match(css, /\.talkly-zoom-health\[data-health=ok\]/);
  assert.match(zoom, /cameraOn === false \? \(hostMode \? "Camera off" : "카메라 꺼짐"\)/);
  assert.match(zoom, /data-health=\{audioState === "disconnected" \? "error"/);
  assert.match(zoom, /micCheckOk === false \? "error"/);
  assert.match(zoom, /cameraControlFailed \? "error"/);
  assert.match(zoom, /상대방 상태 \(읽기 전용\)/);
  assert.match(zoom, /onClick=\{reconnectClassroom\}/);
  assert.match(zoom, /onClick=\{\(\) => void checkMicrophone\(\)\}/);
  assert.match(zoom, /onClick=\{\(\) => void nativeAction\("video"\)\}/);
  assert.match(zoom, /onClick=\{\(\) => void nativeAction\(sharing \? "stop-share" : "share"\)\}/);
  assert.match(zoom, /<div className="talkly-zoom-diagnostic-panel">/);
  assert.match(zoom, /await teardownRef\.current/);
  assert.doesNotMatch(css, /appendChild|removeChild/);
});

test("Issue 56: screen-sharing keeps the established SDK iframe and class chat separate", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  const frame = read("app/classroom/[sessionId]/ClassroomZoomFrame.tsx");
  const material = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  assert.match(page, /<ClassroomZoomFrame/);
  assert.match(page, /<ClassroomTextbookPanel/);
  assert.match(frame, /allow="camera; microphone; display-capture; autoplay; fullscreen"/);
  assert.match(material, /data-material-mode=\{expanded \? "screen" : "textbook"\}/);
  assert.match(material, /className="talkly-material-share-help"/);
});
