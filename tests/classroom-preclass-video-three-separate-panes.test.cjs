const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("student in READY with no active screen share has three genuinely separate DOM panes", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  const stage = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  assert.match(stage, /data-sharing=\{sharing \? "true" : "false"\}/);
  assert.match(page, /data-presenter="false"\]\[data-sharing="false"\] > \.talkly-classroom-video/);
  assert.match(page, /grid-column: 1 !important;/);
  assert.match(page, /data-presenter="false"\]\[data-sharing="false"\] > \.talkly-classroom-screen-guide/);
  assert.match(page, /display: flex !important;/);
  assert.match(page, /\.talkly-classroom-stage\[data-material-mode="screen"\] > \.talkly-chat \{/);
  assert.match(page, /grid-column: 3 !important;/);
});

test("student Zoom expands into shared material area only when Zoom sharing is actually active", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  const frame = read("app/classroom/[sessionId]/ClassroomZoomFrame.tsx");
  assert.match(frame, /stage\?\.getAttribute\("data-sharing"\) === "true"/);
  assert.match(frame, /attributeFilter: \["data-material-mode", "data-presenter", "data-sharing", "data-camera-percent"\]/);
  assert.match(page, /data-presenter="false"\]\[data-sharing="true"\] > \.talkly-classroom-video/);
  assert.match(page, /grid-column: 1 \/ 3 !important;/);
  assert.match(page, /data-presenter="false"\]\[data-sharing="true"\] > \.talkly-classroom-screen-guide/);
  assert.match(page, /display: none !important;/);
});

test("preclass camera preview remains a local video, without replacing Zoom media controls", () => {
  const embed = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  const preview = read("app/classroom/[sessionId]/ClassroomDevicePreview.tsx");
  assert.match(embed, /<ClassroomDevicePreview \/>/);
  assert.match(preview, /getUserMedia/);
  assert.match(preview, /getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
});
