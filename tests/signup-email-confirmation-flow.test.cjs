const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

test("signup honors email confirmation requirement before navigating to login", () => {
  const page = read("app/signup/page.tsx");
  const api = read("app/api/auth/signup/route.ts");
  assert.match(api, /requiresEmailConfirmation/);
  assert.match(api, /confirmationEmailSent/);
  assert.match(page, /if \(result\?\.requiresEmailConfirmation\)/);
  assert.match(page, /result\.confirmationEmailSent/);
  assert.match(page, /setSignupCompleted\(true\)/);
  const branch = page.slice(page.indexOf("if (result?.requiresEmailConfirmation)"));
  assert.match(branch, /return;/);
  assert.ok(branch.indexOf("return;") < branch.indexOf("router.replace(loginHref)"), "do not auto-redirect before email confirmation");
  assert.match(page, /loading \|\| !phoneVerified \|\| signupCompleted/);
});

test("login explains pending email verification", () => {
  const page = read("app/login/page.tsx");
  assert.match(page, /isUnconfirmed/);
  assert.match(page, /이메일 인증이 완료되지 않았습니다/);
});
