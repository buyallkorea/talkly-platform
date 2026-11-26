const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("teacher uses its own Zoom pane while student Zoom retains the shared-video split", () => {
  const frame = read("app/classroom/[sessionId]/ClassroomZoomFrame.tsx");
  const embed = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  assert.match(frame, /split: stage\?\.getAttribute\("data-material-mode"\) === "screen" && stage\?\.getAttribute\("data-presenter"\) !== "true"/);
  assert.match(embed, /splitRef\.current = event\.data\.split;/);
  assert.match(embed, /setReceiving\(active\)/);
});

test("teacher and student both have 3 resizable panes, but the teacher Zoom never spans into middle pane", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  const stage = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  assert.match(page, /@media \(min-width: 1051px\)/);
  assert.match(page, /grid-column: 1 !important; grid-row: 1;/);
  assert.match(page, /display: flex !important; grid-column: 2 !important;/);
  assert.match(page, /grid-column: 3 !important; grid-row: 1;/);
  assert.match(page, /talkly-classroom-stage \{ gap: 12px; \}/);
  assert.match(page, /talkly-classroom-stage > \.talkly-pane-resizer \{[\s\S]*?width: 10px/);
  assert.match(stage, /data-sharing=\{sharing \? "true" : "false"\}/);
  assert.match(stage, /sharedCameraWidth\}fr\)/);
  assert.match(stage, /sharedVideoWidth - sharedCameraWidth/);
  assert.match(stage, /handleDown\("camera"\)/);
  assert.match(stage, /handleDown\("shared"\)/);
  assert.match(stage, /handleDown\("chat"\)/);
});

test("untranslated English teacher copy never masquerades as an action failure", () => {
  const language = read("lib/classroom-language.ts");
  assert.doesNotMatch(language, /return "Unable to complete this action\. Please try again\.";/);
  assert.match(language, /return text;/);
  assert.match(language, /"교재": "Materials"/);
});

test("native Zoom audio, microphone, camera and share remain while labelled optional menus are hidden", () => {
  const zoom = read("lib/zoom-layout.ts");
  const css = read("app/classroom/[sessionId]/zoom-layout.css");
  assert.match(zoom, /function simplifyZoomControls/);
  assert.match(zoom, /join/);
  assert.match(zoom, /computer audio/);
  assert.match(zoom, /start video\|stop video/);
  assert.match(zoom, /share screen\|screen share/);
  assert.match(zoom, /talkly-zoom-optional-control/);
  assert.match(zoom, /talkly-zoom-view-selector/);
  assert.match(zoom, /if \(!label \|\| rect\.height <= 0 \|\| rect\.width <= 0\) continue/);
  assert.match(css, /talkly-sdk-native-toolbar \.talkly-zoom-optional-control/);
  assert.match(css, /\.talkly-zoom-view-selector/);
});

test("native Zoom control classification works without toolbar wrapper and handles icon-only view cluster", () => {
  const adapter = read("lib/zoom-layout.ts");
  assert.match(adapter, /function nativeLabel/);
  assert.match(adapter, /const lowerBoundary/);
  assert.match(adapter, /isToolbar/);
  assert.match(adapter, /topRightIcons\.length >= 3/);
  assert.match(adapter, /leave\|exit/);
  assert.match(adapter, /addLayoutClass\(button, "talkly-zoom-optional-control"\)/);
  assert.match(adapter, /AUDIO_BUTTON\.test\(label\) \|\| VIDEO_BUTTON\.test\(label\) \|\| SHARE_BUTTON\.test\(label\)/);
});
