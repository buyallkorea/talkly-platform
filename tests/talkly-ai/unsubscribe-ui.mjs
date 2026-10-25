import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL(
    "../../app/talkly-ai/unsubscribe/UnsubscribeForm.tsx",
    import.meta.url,
  ),
  "utf8",
);
const ast = ts.createSourceFile(
  "form.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let effect, withdraw;
function visit(n) {
  if (ts.isCallExpression(n) && n.expression.getText(ast) === "useEffect")
    effect = n.arguments[0].getText(ast);
  if (ts.isFunctionDeclaration(n) && n.name?.text === "withdraw")
    withdraw = n.getText(ast);
  ts.forEachChild(n, visit);
}
visit(ast);
const secret = "x".repeat(43),
  token = { current: null },
  guard = { current: false };
let states = [],
  calls = [],
  resolveFetch;
globalThis.unsubUi = {
  token,
  guard,
  valid: true,
  validUnsubscribeToken: (v) =>
    typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v),
  setValid: (v) => states.push(["valid", v]),
  setReady: (v) => states.push(["ready", v]),
  setBusy: (v) => states.push(["busy", v]),
  setDone: (v) => states.push(["done", v]),
  setMessage: (v) => states.push(["message", v]),
};
const code =
  "const {token,guard,valid,validUnsubscribeToken,setValid,setReady,setBusy,setDone,setMessage}=globalThis.unsubUi;export const effect=" +
  effect +
  ";export " +
  withdraw;
const { effect: run, withdraw: send } = await import(
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
const saved = {
  fetch: globalThis.fetch,
  location: globalThis.location,
  history: globalThis.history,
};
let cleanups = [];
globalThis.location = {
  hash: "#token=" + secret,
  pathname: "/talkly-ai/unsubscribe",
};
globalThis.history = {
  replaceState: (_a, _b, p) => {
    cleanups.push(p);
    globalThis.location.hash = "";
  },
};
globalThis.fetch = (path, options) => {
  calls.push([path, options]);
  return new Promise((resolve) => {
    resolveFetch = resolve;
  });
};
try {
  const cleanup = run();
  cleanup();
  run();
  await Promise.resolve();
  assert.equal(calls.length, 0);
  assert.equal(token.current, secret);
  assert.ok(states.some(([k, v]) => k === "valid" && v === true));
  assert.deepEqual(cleanups, ["/talkly-ai/unsubscribe"]);
  const first = send();
  await send();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    token: secret,
    confirm: true,
  });
  resolveFetch(
    new Response(JSON.stringify({ success: true }), { status: 200 }),
  );
  await first;
  assert.equal(token.current, "");
  assert.equal(guard.current, false);
  assert.ok(states.some(([k, v]) => k === "done" && v === true));
  states = [];
  token.current = secret;
  const failed = send();
  resolveFetch(
    new Response(JSON.stringify({ error: "링크를 확인해 주세요." }), {
      status: 404,
    }),
  );
  await failed;
  assert.equal(token.current, secret);
  assert.equal(
    states.some(([k, v]) => k === "done" && v === true),
    false,
  );
  assert.equal(guard.current, false);
  console.log(
    "PASS: opening/strict effect does not unsubscribe, fragment cleared once without losing capability, explicit POST confirmation, duplicate-click guard, success clears token and failure remains retryable",
  );
} finally {
  for (const [key, value] of Object.entries(saved))
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
}
