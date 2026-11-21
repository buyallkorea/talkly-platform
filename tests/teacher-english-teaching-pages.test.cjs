const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("teacher-only lesson, attendance and level test pages have English system copy", () => {
  const teacherFiles = [
    "app/teacher/classes/[sessionId]/page.tsx",
    "app/teacher/classes/[sessionId]/attendance/page.tsx",
    "app/teacher/classes/[sessionId]/attendance/AttendanceForm.tsx",
    "app/teacher/classes/[sessionId]/ClassFeedbackForm.tsx",
    "app/teacher/classes/[sessionId]/CompleteClassButton.tsx",
    "app/teacher/classes/[sessionId]/TeacherNoteForm.tsx",
    "app/teacher/classes/[sessionId]/EvaluationForm.tsx",
    "app/teacher/level-tests/page.tsx",
    "app/teacher/level-tests/[id]/page.tsx",
    "app/teacher/level-tests/[id]/LevelTestEvaluationForm.tsx",
    "app/teacher/students/[enrollmentId]/page.tsx",
    "app/teacher/page.tsx",
    "components/teacher/TeacherClassroomLink.tsx",
  ];
  for (const file of teacherFiles) {
    const nonCommentLines = read(file).split("\n").filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line));
    assert.doesNotMatch(nonCommentLines.join("\n"), /[가-힣]/, file);
  }
});

test("classroom role remains based on authenticated teacher profile, not browser preference", () => {
  const classroom = read("app/classroom/[sessionId]/page.tsx");
  assert.match(classroom, /getClassroomText\(profile\.role === "teacher"\)/);
  const layout = read("app/teacher/layout.tsx");
  assert.match(layout, /profile\.role !== "teacher"/);
  assert.match(layout, /teacherProfile\.is_active/);
});

test("teacher-specific Zoom sound, reconnect and mic diagnostics use English while students retain Korean", () => {
  const zoom = read("app/classroom/[sessionId]/ClassroomZoomEmbed.tsx");
  assert.match(zoom, /getClassroomText\(hostMode\)/);
  assert.match(zoom, /setMicCheckMessage\(hostMode && outcome\.message\.includes/);
  assert.match(zoom, /hostMode \? "Check microphone" : "마이크 점검"/);
  assert.match(zoom, /hostMode \? "Reconnect Zoom" : "Zoom 재연결"/);
  assert.match(zoom, /hostMode \? "Connection settings" : "연결 설정"/);
});

test("textbook controls render English for teacher but keep Korean for student", () => {
  const filename = "app/classroom/textbooks/[id]/viewer/ClassroomTextbookViewerClient.tsx";
  const code = ts.transpileModule(read(filename), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require, console, process });
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const props = { textbookId: 3, title: "English Reading", viewerName: "Teacher", pages: [{ id: 1, pageNumber: 1, imageUrl: "https://example.org/1.jpg", hotspots: [{ id: 2, label: "Listening", xPercent: 5, yPercent: 5, widthPercent: 15, heightPercent: 10, audioUrl: "https://example.org/sound.mp3" }] }] };
  const teacher = renderToStaticMarkup(React.createElement(exports.default, { ...props, viewerRole: "teacher" }));
  const student = renderToStaticMarkup(React.createElement(exports.default, { ...props, viewerRole: "student" }));
  assert.doesNotMatch(teacher, /[가-힣]/);
  assert.match(teacher, /Fit to screen/);
  assert.match(teacher, /Next page/);
  assert.match(student, /화면 맞춤/);
  assert.match(student, /다음 페이지/);
});
