import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../app/talkly-ai/AiStudio.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('studio.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node)) functions.set(node.name?.text, node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
let fail = true, closes = 0, refreshes = 0, summaries = 0, microphones = 0;
const session = { current: 'session-a' }, segmentTurns = { current: [{role:'user',text:'Hello'}] };
const stopping = { current: false };
const harness = {
  session, segmentTurns, stopping,
  localClose() {}, setState() {}, setError() {},
  checkpoint: async id => assert.equal(id, 'session-a'),
  refresh: async () => { refreshes++; return {remaining:120}; },
  api: async (path, body) => {
    assert.equal(body.sessionId, 'session-a');
    if (path === 'session/summary') { summaries++; return {}; }
    assert.equal(path, 'session/stop'); closes++;
    if (fail) throw Error('network offline');
    return {success:true};
  },
  busyRef: {current:false}, active:{current:false},
};
// Execute the actual start preflight, stopping immediately before microphone setup.
const start = functions.get('start');
const preflight = start.slice(0, start.indexOf('    busyRef.current = true;')) + '\n microphones();\n}';
harness.microphones = () => microphones++;
globalThis.__stopHarness = harness;
const code = 'const {' + Object.keys(harness).join(',') + '} = globalThis.__stopHarness;\n' + functions.get('stop') + '\n' + preflight + '\nexport {stop,start};';
const js = ts.transpileModule(code, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
try {
  const {stop,start} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  assert.equal(await stop(), undefined);
  assert.equal(session.current, 'session-a', 'failed settlement must retain the retry target');
  assert.equal(segmentTurns.current.length, 1, 'failed settlement must retain report turns');
  assert.equal(stopping.current, false);
  await start();
  assert.equal(closes, 2, 'reconnect retries the same session');
  assert.equal(microphones, 0, 'failed settlement blocks a new connection');
  assert.equal(refreshes, 0);
  assert.equal(summaries, 0);
  fail = false;
  await start();
  assert.equal(closes, 3);
  assert.equal(session.current, null);
  assert.deepEqual(segmentTurns.current, []);
  assert.equal(summaries, 1);
  assert.equal(refreshes, 1);
  assert.equal(microphones, 1);
  await stop();
  assert.equal(closes, 3, 'acknowledged session must not be submitted again');
} finally { delete globalThis.__stopHarness; }
console.log('PASS: failed settlement retains the session and summary; reconnect settles before opening the microphone.');
