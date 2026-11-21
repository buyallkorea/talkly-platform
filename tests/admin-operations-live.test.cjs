const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = path => fs.readFileSync(path, "utf8");

test("daily work panel appears before the legacy dashboard cards", () => {
  const page = read("app/admin/page.tsx");
  assert.match(page, /<AdminOperationsPanel mode="summary"\s*\/>/);
  assert.ok(page.indexOf('<AdminOperationsPanel mode="summary" />') < page.indexOf('DASHBOARD CARDS'));
  assert.match(read("app/admin/AdminSidebar.tsx"), /href: "\/admin\/live-classes"/);
  assert.match(read("app/admin/live-classes/page.tsx"), /<AdminOperationsPanel mode="live"/);
});

test("operations and browser presence APIs authenticate and do not expose service role", () => {
  const operations = read("app/api/admin/operations/route.ts");
  const presence = read("app/api/classroom/live-presence/route.ts");
  assert.match(operations, /client\.auth\.getUser\(\)/);
  assert.match(operations, /profile\?\.role !== "admin"/);
  assert.match(operations, /Cache-Control": "private, no-store"/);
  assert.match(presence, /client\.auth\.getUser\(\)/);
  assert.match(presence, /enrollment\.student_user_id === user\.id/);
  assert.match(presence, /parent_user_id", user\.id/);
  assert.match(presence, /!session\.is_external_teacher/);
  assert.match(presence, /onConflict: "class_session_id,user_id"/);
  assert.match(presence, /request\.headers\.get\("origin"\)/);
});

test("SDK reporting is best effort and real-time view does not claim Zoom app support", () => {
  const sdk = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  const ui = read("components/admin/AdminOperationsPanel.tsx");
  const data = read("lib/admin-operations.ts");
  assert.match(sdk, /if \(screen !== "joined"\) return/);
  assert.match(sdk, /fetch\("\/api\/classroom\/live-presence"/);
  assert.match(sdk, /25_000/);
  assert.match(ui, /20_000/);
  assert.match(ui, /Zoom 앱/);
  assert.match(data, /90_000/);
  assert.match(data, /!participant\?\.teacher && !participant\?\.student/);
  assert.match(data, /현재 수업 시간대/);
  assert.doesNotMatch(data, /\.insert\(|\.update\(|\.delete\(/);
});

test("live monitor retains compact responsive admin styles", () => {
  const css = read("app/globals.css");
  assert.match(css, /\.talkly-operations-tasks/);
  assert.match(css, /\.talkly-operations-table-wrap/);
  assert.match(css, /@media \(max-width:640px\)/);
});
