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

test("no Zoom native toolbar button can be hidden by TALKLY optional menu filters", () => {
  const adapter = read("lib/zoom-layout.ts");
  const css = read("app/classroom/[sessionId]/zoom-layout.css");
  assert.match(adapter, /markNativeToolbar\(widget\);/);
  assert.doesNotMatch(adapter, /^\s*simplifyZoomControls\(widget\);/m);
  assert.doesNotMatch(css, /talkly-zoom-optional-control\s*,?\s*\{\s*display\s*:\s*none/m);
  assert.doesNotMatch(css, /\.talkly-zoom-view-selector\s*\{\s*display\s*:\s*none/m);
  assert.match(css, /opacity:1!important/);
  assert.match(css, /visibility:visible!important/);
});

test("teacher screen-sharing mode restores actual synchronized textbook pane", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  const stage = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  const select = read("app/api/classroom/select-textbook/route.ts");
  assert.match(page, /classroom-textbook \{[\s\S]*?display:flex!important/);
  assert.match(page, /isTeacherTestSession/);
  assert.match(stage, /Share TALKLY textbook/);
  assert.match(stage, /change\("textbook"\)/);
  assert.match(select, /testTeacher/);
  assert.match(select, /!assignment && !testStudent && !testTeacher/);
});
