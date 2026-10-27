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
let fn;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "recoverPayment")
    fn = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(fn);
let calls = [],
  messages = [],
  busy = [],
  refreshCalls = 0,
  resolveApi,
  rejectApi,
  refreshError = false;
const busyRef = { current: false },
  active = { current: false },
  stopping = { current: false };
globalThis.recoveryHarness = {
  busy: false,
  busyRef,
  active,
  stopping,
  connectionBusy: false,
  PLAN: { amount: 13900 },
  setBusy: (value) => busy.push(value),
  setPaymentMessage: (value) => messages.push(value),
  api: (path, data) => {
    assert.equal(path, "payment/confirm");
    calls.push(data);
    return new Promise((resolve, reject) => {
      resolveApi = resolve;
      rejectApi = reject;
    });
  },
  refresh: async () => {
    refreshCalls++;
    if (refreshError) throw new Error("account read unavailable");
  },
};
const code =
  "const {busy,busyRef,active,stopping,connectionBusy,PLAN,setBusy,setPaymentMessage,api,refresh}=globalThis.recoveryHarness;export " +
  fn;
const js = ts.transpileModule(code, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { recoverPayment } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
active.current = true;
await recoverPayment("order");
assert.equal(calls.length, 0);
active.current = false;
const pending = recoverPayment("order");
assert.equal(busyRef.current, true);
await recoverPayment("order");
assert.equal(calls.length, 1);
assert.deepEqual(calls[0], {
  orderId: "order",
  amount: 13900,
  lookupOnly: true,
});
assert.equal(calls[0].paymentKey, undefined);
resolveApi({ success: true });
await pending;
assert.equal(refreshCalls, 1);
assert.equal(busyRef.current, false);
assert.equal(busy.at(-1), false);
assert.ok(messages.at(-1).includes("반영"));
refreshError = true;
const retry = recoverPayment("order");
resolveApi({ success: true, alreadyActivated: true });
await retry;
assert.ok(messages.at(-1).includes("반영은 확인"));
assert.equal(busyRef.current, false);
refreshError = false;
const terminal = recoverPayment("order");
rejectApi(Object.assign(new Error("승인 실패로 종료"), { terminal: true }));
await terminal;
assert.equal(messages.at(-1), "승인 실패로 종료");
assert.equal(busyRef.current, false);
refreshError = true;
const terminalRefresh = recoverPayment("order");
rejectApi(Object.assign(new Error("만료로 종료"), { terminal: true }));
await terminalRefresh;
assert.ok(messages.at(-1).includes("새로고침"));
assert.equal(busyRef.current, false);
stopping.current = true;
const count = calls.length;
await recoverPayment("order");
assert.equal(calls.length, count);
console.log(
  "PASS: owner-order lookup-only recovery without client key/new purchase, duplicate/live/stopping guards, account refresh and confirmed-but-refresh-failed feedback",
);
