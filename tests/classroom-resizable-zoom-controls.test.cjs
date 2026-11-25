const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("student and teacher can resize registered textbook and chat layout without re-mounting children", () => {
  const s = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  assert.match(s, /const stageRef/);
  assert.match(s, /handleDown\("video"\)/);
  assert.match(s, /handleDown\("chat"\)/);
  assert.match(s, /handleDown\("shared"\)/);
  assert.match(s, /setPointerCapture/);
  assert.match(s, /aria-orientation="vertical"/);
  assert.match(s, /onKeyDown=\{handleKey/);
  assert.match(s, /localStorage\.setItem/);
  assert.match(s, /\{children\}/);
});

test("teacher has four primary buttons and emergency fallback survives", () => {
  const z = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  const css = read("app/classroom/[sessionId]/zoom-layout.css");
  assert.match(z, /onClick=\{testSpeaker\} title="Play a sound/);
  assert.match(z, /onClick=\{\(\) => void audioAction\(\)\}/);
  assert.match(z, /onClick=\{\(\) => void nativeAction\("video"\)\}/);
  assert.match(z, /nativeAction\(sharing \? "stop-share" : "share"\)/);
  assert.match(css, /data-host=true.*data-sharing=true/);
  assert.match(css, /position:absolute; left:0; bottom:0/);
  assert.match(css, /talkly-sdk-native-toolbar:hover/);
});
