import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../app/talkly-ai/payment/success/page.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "success.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect")
    effect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(effect);
let messages = [],
  busy = [],
  allowed = [],
  done = [],
  urls = [],
  timers = [],
  calls = [],
  resolveFetch,
  rejectFetch;
globalThis.paymentUiHarness = {
  setMessage: (value) => messages.push(value),
  setBusy: (value) => busy.push(value),
  setRetryAllowed: (value) => allowed.push(value),
  setDone: (value) => done.push(value),
};
const js = ts.transpileModule(
  "const {setMessage,setBusy,setRetryAllowed,setDone}=globalThis.paymentUiHarness;export const effect=" +
    effect +
    ";",
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const { effect: run } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const saved = {
  fetch: globalThis.fetch,
  location: globalThis.location,
  history: globalThis.history,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};
const flush = async () => {
  await new Promise(setImmediate);
  await new Promise(setImmediate);
};
function reset() {
  messages = [];
  busy = [];
  allowed = [];
  done = [];
  urls = [];
  timers = [];
  calls = [];
  globalThis.location = {
    search: "?orderId=test-order&paymentKey=test-key&amount=13900",
    pathname: "/talkly-ai/payment/success",
  };
}
globalThis.history = { replaceState: (_a, _b, url) => urls.push(url) };
globalThis.setTimeout = (callback, delay) => {
  timers.push({ callback, delay });
  return timers.length;
};
globalThis.clearTimeout = () => {};
globalThis.fetch = (url, options) => {
  calls.push({ url, options });
  return new Promise((resolve, reject) => {
    resolveFetch = resolve;
    rejectFetch = reject;
    options.signal.addEventListener(
      "abort",
      () => reject(new DOMException("Aborted", "AbortError")),
      { once: true },
    );
  });
};
try {
  reset();
  let cleanup = run();
  assert.equal(busy.length, 0);
  await flush();
  assert.equal(timers[0].delay, 50000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.cache, "no-store");
  resolveFetch(
    new Response(JSON.stringify({ success: true, alreadyActivated: true }), {
      status: 200,
    }),
  );
  await flush();
  assert.deepEqual(done, [true]);
  assert.equal(busy.at(-1), false);
  assert.deepEqual(urls, ["/talkly-ai/payment/success"]);
  assert.ok(messages.at(-1).includes("이미"));
  cleanup();
  reset();
  cleanup = run();
  await flush();
  timers[0].callback();
  await flush();
  assert.equal(done.length, 0);
  assert.equal(busy.at(-1), false);
  assert.ok(messages.at(-1).includes("중복 구매 대신"));
  assert.equal(urls.length, 0);
  cleanup();
  reset();
  cleanup = run();
  const before = messages.length;
  cleanup();
  await flush();
  assert.equal(messages.length, before);
  assert.equal(done.length, 0);
  assert.equal(calls.length, 0);
  reset();
  cleanup = run();
  await flush();
  const pendingMessages = messages.length;
  cleanup();
  await flush();
  assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(messages.length, pendingMessages);
  assert.equal(done.length, 0);
  reset();
  globalThis.location.search = "";
  run();
  await flush();
  assert.equal(calls.length, 0);
  assert.equal(allowed.at(-1), false);
  assert.equal(busy.at(-1), false);
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
}
console.log(
  "PASS: actual payment effect bounded pending state, same-order replay message, URL cleanup only after success, timeout without false success, unmount abort and missing-parameter isolation",
);
