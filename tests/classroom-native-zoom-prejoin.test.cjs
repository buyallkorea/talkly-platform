const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("new Zoom lessons allow native join before host ten minutes early", () => {
  const route = read("app/api/zoom/create-meeting/route.ts");
  assert.match(route, /join_before_host: true/);
  assert.match(route, /jbh_time: 10/);
  assert.match(route, /waiting_room: false/);
  assert.doesNotMatch(route, /join_before_host: false/);
});

test("legacy test meetings reconcile early-join via verified Zoom settings", () => {
  const route = read("app/api/admin/test-classroom/prepare-zoom/route.ts");
  assert.match(route, /verifyTestStudentMode\(sessionId\)/);
  assert.match(route, /profile\?\.role !== "admin"/);
  assert.match(route, /!session\.is_test/);
  assert.match(route, /!enrollment\?\.is_test/);
  assert.match(route, /session\.status !== "scheduled"/);
  assert.match(route, /method: "PATCH"/);
  assert.match(route, /join_before_host: true, jbh_time: 10, waiting_room: false/);
  assert.match(route, /settings\?\.join_before_host !== true/);
});

test("test student prepares existing Zoom meeting before SDK iframe is rendered", () => {
  const frame = read("app/classroom/[sessionId]/ClassroomZoomFrame.tsx");
  assert.match(frame, /fetch\("\/api\/admin\/test-classroom\/prepare-zoom"/);
  assert.match(frame, /if \(!meetingPrepared\) return/);
  assert.match(frame, /<iframe ref=\{frame\}/);
});

test("TALKLY preview never obscures Zoom native prejoin toolbar", () => {
  const zoom = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  assert.match(zoom, /!hostMode && \(screen === "loading" \|\| screen === "waiting"\)/);
  assert.doesNotMatch(zoom, /!hostMode && \(screen === "loading" \|\| screen === "joining"/);
});
