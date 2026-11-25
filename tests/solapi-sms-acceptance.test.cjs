const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("SMS registration checks individual Solapi failures, not just HTTP 200", () => {
  const s = fs.readFileSync(path.join(__dirname, "../lib/solapi.ts"), "utf8");
  assert.match(s, /response\.ok/);
  assert.match(s, /JSON\.parse\(responseText\)/);
  assert.match(s, /failedMessageList/);
  assert.match(s, /registeredFailed/);
  assert.match(s, /registeredSuccess/);
  assert.match(s, /counts\?\.registeredSuccess !== 1/);
  assert.match(s, /인증문자 접수에 실패했습니다/);
  assert.doesNotMatch(s, /console\.error\("SOLAPI SEND ERROR:", response\.status, responseText\)/);
});

test("SMS send route removes unused verification when provider rejects registration", () => {
  const s = fs.readFileSync(path.join(__dirname, "../app/api/auth/phone/send/route.ts"), "utf8");
  assert.match(s, /await sendTalklyVerificationSms\(phone, code\)/);
  assert.match(s, /await admin\.from\("phone_verifications"\)\.delete\(\)\.eq\("id", created\.id\)/);
  assert.match(s, /status: 502/);
});
