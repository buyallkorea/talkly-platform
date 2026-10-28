import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../app/talkly-ai/AiStudio.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "studio.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let effect;
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(ast) === "useEffect" &&
    node.arguments[0].getText(ast).includes('api("account")')
  )
    effect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(effect);
const configSource = await readFile(new URL("../../lib/talkly-ai/config.ts", import.meta.url), "utf8");
const configJs = ts.transpileModule(configSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { normalizeTutorId } = await import("data:text/javascript;base64," + Buffer.from(configJs).toString("base64"));
let calls = 0,
  events = [],
  resolveApi,
  rejectApi;
globalThis.accountHarness = {
  normalizeTutorId,
  api: (path) => {
    assert.equal(path, "account");
    calls++;
    return new Promise((resolve, reject) => {
      resolveApi = resolve;
      rejectApi = reject;
    });
  },
  setAccount: (value) => events.push(["account", value]),
  setRemaining: (value) => events.push(["remaining", value]),
  setTutor: (value) => events.push(["tutor", value]),
  setError: (value) => events.push(["error", value]),
};
const code =
  "const {api,setAccount,setRemaining,setTutor,setError,normalizeTutorId}=globalThis.accountHarness;export const effect=" +
  effect +
  ";";
const js = ts.transpileModule(code, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { effect: run } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const flush = () => new Promise(setImmediate);
let cleanup = run();
cleanup();
await flush();
assert.equal(calls, 0);
assert.equal(events.length, 0);
cleanup = run();
await flush();
assert.equal(calls, 1);
const account = { remaining: 180, member: { last_tutor_id: "uk-female" } };
resolveApi(account);
await flush();
assert.deepEqual(events, [
  ["account", account],
  ["remaining", 180],
  ["tutor", "lively-female"],
]);
cleanup();
events = [];
cleanup = run();
await flush();
resolveApi({ remaining: 120, member: { last_tutor_id: "calm-male" } });
await flush();
assert.deepEqual(events.at(-1), ["tutor", "calm-male"], "current tutor IDs remain selected");
cleanup();
events = [];
cleanup = run();
await flush();
cleanup();
resolveApi(account);
await flush();
assert.equal(events.length, 0);
events = [];
cleanup = run();
await flush();
rejectApi(new Error("일시 오류"));
await flush();
assert.deepEqual(events, [["error", "일시 오류"]]);
cleanup();
console.log(
  "PASS: deferred initial account lookup, cancelled-before-start avoids request, owned account/timer/tutor hydration, stale reply isolation and error feedback",
);
