const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = (f) => fs.readFileSync(f, "utf8");

test("service-only chat repair is a least-privilege INSERT grant", () => {
  const sql = read("supabase/migrations/20261119005000_grant_service_role_test_classroom_chat_insert.sql");
  const executable = sql.split("\n").filter(line => !line.trim().startsWith("--")).join("\n");
  assert.match(executable, /grant insert on table public\.classroom_messages to service_role;/i);
  assert.doesNotMatch(executable, /grant (?:all|select|update|delete|truncate|references|trigger)/i);
  assert.doesNotMatch(executable, /grant .*\b(?:anon|authenticated)\b/i);
  assert.doesNotMatch(executable, /alter table .*disable row level security/i);
});

test("test classroom chat still requires actual admin test-student authorization", () => {
  const route = read("app/api/admin/test-classroom/chat/route.ts");
  assert.match(route, /TALKLY_ENABLE_TEST_CLASSROOM/);
  assert.match(route, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(route, /verifyTestStudentMode\(sessionId\)/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /session\?\.is_test !== true/);
  assert.match(route, /session\.status !== "in_progress"/);
  assert.match(route, /enrollment\?\.is_test !== true/);
  assert.match(route, /\.from\("classroom_messages"\)\.insert\(/);
  assert.doesNotMatch(route, /getUserMedia|mediaRecorder/i);
});
