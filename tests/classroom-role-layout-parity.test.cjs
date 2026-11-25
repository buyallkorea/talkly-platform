const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("teacher and student both receive the native Zoom split-layout instruction", () => {
  const frame = read("app/classroom/[sessionId]/ClassroomZoomFrame.tsx");
  const embed = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  assert.match(frame, /split: stage\?\.getAttribute\("data-material-mode"\) === "screen"/);
  assert.doesNotMatch(frame, /split:.*data-presenter/);
  assert.match(embed, /splitRef\.current = event\.data\.split;/);
  assert.doesNotMatch(embed, /splitRef\.current = !hostMode/);
  assert.match(embed, /setReceiving\(active\)/);
  assert.match(embed, /split && !sharing && screen === "joined"/);
});

test("teacher and student screen share spans the same first two columns and chat stays third", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  const stage = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  assert.match(page, /@media \(min-width: 1051px\)/);
  assert.match(page, /data-presenter="true"\] > \.talkly-classroom-video \{[\s\S]*?grid-column: 1 \/ 3;/);
  assert.match(page, /data-presenter="true"\] > \.talkly-chat \{[\s\S]*?grid-column: 3;/);
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
  assert.match(zoom, /join audio\|computer audio/);
  assert.match(zoom, /start video\|stop video/);
  assert.match(zoom, /share screen\|stop share/);
  assert.match(zoom, /talkly-zoom-optional-control/);
  assert.match(zoom, /talkly-zoom-view-selector/);
  assert.match(zoom, /if \(!label\) continue/);
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
