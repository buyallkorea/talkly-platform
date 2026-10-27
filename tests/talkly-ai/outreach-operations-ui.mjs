import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const src = await readFile(
  new URL("../../app/admin/talkly-ai/OutreachOperations.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "ops.tsx",
  src,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let handler;
function visit(n) {
  if (ts.isFunctionDeclaration(n) && n.name?.text === "process")
    handler = n.getText(ast);
  ts.forEachChild(n, visit);
}
visit(ast);
let states = [],
  calls = [],
  resolveFetch,
  rejectFetch,
  refreshes = 0;
const guard = { current: false };
globalThis.operationsHarness = {
  guard,
  setBusy: (v) => states.push(["busy", v]),
  setMessage: (v) => states.push(["message", v]),
  setConfirmed: (v) => states.push(["confirmed", v]),
  router: { refresh: () => refreshes++ },
};
const code =
  "const {guard,setBusy,setMessage,setConfirmed,router}=globalThis.operationsHarness;export function make(enabled,confirmed){" +
  handler +
  ";return process;}";
const { make } = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ).toString("base64")
);
const saved = globalThis.fetch;
globalThis.fetch = (url, options) => {
  calls.push([url, options]);
  return new Promise((resolve, reject) => {
    resolveFetch = resolve;
    rejectFetch = reject;
  });
};
try {
  await make(false, true)();
  await make(true, false)();
  assert.equal(calls.length, 0);
  const run = make(true, true),
    first = run();
  await run();
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0][1].body), { confirm: true });
  resolveFetch(
    new Response(
      JSON.stringify({
        success: true,
        result: {
          status: "processed",
          accepted: 1,
          failed: 0,
          unknown: 0,
          skipped: 0,
          deferred: 0,
          unrecorded: 0,
        },
      }),
      { status: 200 },
    ),
  );
  await first;
  assert.equal(refreshes, 1);
  assert.ok(
    states.some(
      ([key, value]) =>
        key === "message" && value.includes("전달 완료가 아닙니다"),
    ),
  );
  assert.equal(guard.current, false);
  const timed = run();
  rejectFetch(new DOMException("timed out", "TimeoutError"));
  await timed;
  assert.ok(
    states.at(-2)[0] === "message" ||
      states.some(
        ([key, value]) => key === "message" && value.includes("대기열 상태"),
      ),
  );
  assert.equal(calls.length, 2);
  assert.equal(guard.current, false);
  console.log(
    "PASS: disabled/unconfirmed control cannot call API, duplicate click blocked, explicit confirmation only, acceptance not delivery, refresh after result and timeout does not resend; fetch mocked",
  );
} finally {
  globalThis.fetch = saved;
}
