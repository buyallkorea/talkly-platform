const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const home = fs.readFileSync("app/page.tsx", "utf8");
const style = fs.readFileSync("app/globals.css", "utf8");
const mobile = fs.readFileSync("components/HomeMobileMenu.tsx", "utf8");

test("AI link appears after 상담 in the compact top utility bar", () => {
  const utility = home.slice(home.indexOf('className="talkly-utility"'), home.indexOf("</header>"));
  const consult = utility.indexOf('href="/consultation"');
  const ai = utility.indexOf('href="/talkly-ai"');
  assert.ok(consult > 0 && ai > consult, "AI link should follow 1:1 consultation");
  assert.match(utility, /className="talkly-utility-inner"/);
  assert.match(utility, /className="talkly-utility-ai"/);
});

test("auth buttons retain their original dedicated header area", () => {
  const start = home.indexOf('className="talkly-home-desktop-auth"');
  const end = home.indexOf('<HomeMobileMenu />',start);
  const header = home.slice(start,end);
  assert.match(header, /<HomeAuthMenu\s*\/>/);
  assert.doesNotMatch(header, /talkly-ai|talkly-home-ai-mobile-link/);
  assert.doesNotMatch(style, /\.talkly-home-ai-mobile-link\{/);
  assert.doesNotMatch(style, /max-width:115px!important/);
});

test("small screens keep a visible, compact top bar and menu remains functional", () => {
  assert.match(home, /\.talkly-utility \{\s*display: block !important;/);
  assert.match(style, /\.talkly-utility-inner\{gap:12px!important\}/);
  assert.match(style, /@media\(max-width:680px\)/);
  assert.match(style, /\.talkly-utility-ai\{display:inline-flex/);
  assert.match(mobile, /href="\/talkly-ai" onClick=\{closeMenu\}/);
});
