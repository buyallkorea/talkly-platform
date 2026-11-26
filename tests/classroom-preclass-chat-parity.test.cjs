const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("all classroom roles see chat input and send button before class begins", () => {
  const chat = read("app/classroom/[sessionId]/ClassroomChat.tsx");
  assert.match(chat, /<form onSubmit=\{handleSubmit\} className="talkly-chat-form"/);
  assert.doesNotMatch(chat, /\{canSend && \(\s*<form/);
  assert.match(chat, /disabled=\{!canSend \|\| loading \|\| !message\.trim\(\)\}/);
  assert.match(chat, /강사가 수업을 시작하면 채팅할 수 있습니다/);
  assert.match(chat, /if \(!canSend\) return/);
});

test("teacher Zoom, sharing status and chat are real three independent desktop columns", () => {
  const page = read("app/classroom/[sessionId]/page.tsx");
  assert.match(page, /data-presenter="true"\] > \.talkly-classroom-video \{[\s\S]*?grid-column: 1;/);
  assert.match(page, /data-presenter="true"\] > \.talkly-classroom-screen-guide \{[\s\S]*?grid-column: 2;/);
  assert.match(page, /data-presenter="true"\] > \.talkly-chat \{[\s\S]*?grid-column: 3/);
  assert.match(page, /data-presenter="false"\] > \.talkly-classroom-video \{[\s\S]*?grid-column: 1 \/ 3;/);
});

test("three-pane draggable separators align to the actual grid gutters", () => {
  const stage = read("app/classroom/[sessionId]/ClassroomMaterialStage.tsx");
  assert.match(stage, /const separatorLeft =/);
  assert.match(stage, /index === 1 \? 6 : 18/);
  assert.match(stage, /rect\.width - 24/);
  assert.match(stage, /separatorLeft\(sharedCameraWidth, 1\)/);
  assert.match(stage, /separatorLeft\(sharedVideoWidth, 2\)/);
  assert.match(stage, /separatorLeft\(paneWidths\[0\], 1\)/);
  assert.match(stage, /separatorLeft\(100 - paneWidths\[2\], 2\)/);
});
