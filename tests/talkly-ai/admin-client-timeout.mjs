import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
let captured;
globalThis.clientCapture = (url, key, options) => {
  captured = { url, key, options };
  return captured;
};
const src = await readFile(
  new URL("../../lib/supabase-admin.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile("admin.ts", src, ts.ScriptTarget.Latest, true);
const code =
  "const createClient=globalThis.clientCapture;" +
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n");
const { createAdminClient } = await import(
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
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetch: globalThis.fetch,
};
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.example";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-placeholder";
globalThis.fetch = async (input, init) => ({ input, init });
try {
  createAdminClient();
  assert.deepEqual(captured.options, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (const timeoutMs of [-1, 0, 499, 30001, NaN, 1.5])
    assert.throws(() => createAdminClient({ timeoutMs }));
  createAdminClient({ timeoutMs: 3000 });
  let result = await captured.options.global.fetch("https://test.example", {
    headers: { test: "value" },
  });
  assert.ok(result.init.signal instanceof AbortSignal);
  assert.equal(result.init.headers.test, "value");
  const controller = new AbortController();
  controller.abort();
  result = await captured.options.global.fetch("https://test.example", {
    signal: controller.signal,
  });
  assert.equal(result.init.signal.aborted, true);
  const request = new Request("https://test.example", {
    signal: controller.signal,
  });
  result = await captured.options.global.fetch(request);
  assert.equal(result.init.signal.aborted, true);
  console.log(
    "PASS: existing admin client defaults unchanged, optional bounded fetch validated, headers and caller/Request cancellation retained; no live requests",
  );
} finally {
  globalThis.fetch = saved.fetch;
  for (const [name, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", saved.url],
    ["SUPABASE_SERVICE_ROLE_KEY", saved.key],
  ])
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}
