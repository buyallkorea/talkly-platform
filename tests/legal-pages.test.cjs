const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, mocks = {}) {
  const source = fs.readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require(name) { return mocks[name] || require(name); }});
  return exports;
}
const data = load('components/legal/legal-content.ts');
const Document = load('components/legal/LegalDocument.tsx', {
  './legal-content': data,
  './legal-document.module.css': {default: {}},
  '@/components/SiteHeader': {default: () => null},
  'next/link': {default: ({children, ...props}) => React.createElement('a', props, children)},
}).default;
for (const kind of ['terms', 'privacy']) {
  test(`${kind}: all table-of-contents targets resolve and draft status remains explicit`, () => {
    const sections = data[kind];
    const html = renderToStaticMarkup(React.createElement(Document, {kind, sections}));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), target);
    assert.ok(html.includes('data-legal-status="draft"'));
    assert.ok(html.includes('시행일'));
    assert.ok(html.includes('확정 후 공지'));
    assert.ok(html.includes('아직 시행되지 않으며'));
    assert.ok(html.includes('href="/terms"') && html.includes('href="/privacy"'));
    assert.ok(!html.includes('type="checkbox"'));
    assert.equal(sections.length, kind === 'terms' ? 13 : 12);
  });
}
test('draft documents are excluded from indexing', () => {
  for (const kind of ['terms','privacy']) assert.match(fs.readFileSync(`app/${kind}/page.tsx`, 'utf8'), /robots: \{ index: false, follow: false \}/);
});
test('home footer and signup link to both documents without submitting consent', () => {
  for (const path of ['app/page.tsx','app/signup/page.tsx']) {
    const s = fs.readFileSync(path, 'utf8');
    assert.ok(s.includes('href="/terms"') && s.includes('href="/privacy"'));
  }
  assert.ok(fs.readFileSync('app/signup/page.tsx','utf8').includes('초안에 동의한 것으로 처리하지 않습니다'));
});
