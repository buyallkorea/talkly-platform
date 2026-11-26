const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("student and parent see the same preclass Zoom/material/chat layout instead of waiting page", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  assert.doesNotMatch(page, /return \(\s*<ClassroomWaitingRoom/);
  assert.match(page, /isLearner && session\.status === "scheduled" && !session\.started_at && <TestStudentStartWatcher/);
  assert.match(page, /<ClassroomResponsiveZoom/);
  assert.match(page, /<ClassroomMaterialStage/);
  assert.match(page, /<ClassroomChat/);
  assert.match(page, /session\.status === "in_progress" &&\s*Boolean\(session\.started_at\)/);
});

test("student may preview camera and microphone while Zoom host is absent", () => {
  const embed = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  const preview = read("app/classroom/[sessionId]/ClassroomDevicePreview.tsx");
  assert.match(embed, /!hostMode && \(screen === "loading" \|\| screen === "joining" \|\| screen === "waiting"\)/);
  assert.match(embed, /<ClassroomDevicePreview \/>/);
  assert.match(embed, /setTimeout\(\(\) => setAttempt\(value => value \+ 1\), 10000\)/);
  assert.match(preview, /getUserMedia\(\{\s*video: \{ facingMode: "user" \},\s*audio: false/);
  assert.match(preview, /getUserMedia\(\{ audio: true, video: false \}\)/);
  assert.match(preview, /streamRef\.current\?\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
  assert.match(preview, /autoPlay playsInline muted/);
  assert.doesNotMatch(preview, /client\.join\(/);
});

test("joining Zoom does not count attendance without teacher's official class start", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  const access = read("lib/classroom-zoom-access.ts");
  assert.match(page, /StudentAttendanceRecorder/);
  assert.match(page, /session\.status === "in_progress" &&\s*Boolean\(session\.started_at\)/);
  assert.match(access, /\["scheduled", "in_progress"\]\.includes\(session\.status\)/);
});
