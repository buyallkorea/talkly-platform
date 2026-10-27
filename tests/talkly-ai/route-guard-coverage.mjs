import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../app/api/talkly-ai/", import.meta.url));
const routes = [];
async function visit(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) await visit(full);
    else if (item.name === "route.ts") routes.push(full);
  }
}
await visit(root);
assert.ok(routes.length >= 20, "audit must cover all AI API routes");
let protectedWrites = 0;
for (const file of routes) {
  const source = await readFile(file, "utf8");
  const rel = path.relative(root, file).replaceAll(path.sep, "/");
  if (!/export async function (POST|PUT|PATCH|DELETE)\s*\(/.test(source)) continue;
  protectedWrites++;
  if (rel === "internal/recover-calls/route.ts") {
    assert.match(source, /requireIsolatedPreviewWrite\(/, rel);
    continue;
  }
  if (rel === "unsubscribe/route.ts") {
    assert.match(source, /requireIsolatedPreviewWrite\(request\)/, rel);
    continue;
  }
  assert.match(source, /context\(request\)/, "mutating AI endpoint bypasses preview isolation: " + rel);
  assert.doesNotMatch(source, /context\(\)/, "mutating AI endpoint must pass its request: " + rel);
}
assert.ok(protectedWrites >= 14, "route discovery unexpectedly found too few mutations");
console.log("PASS: "+protectedWrites+" mutating AI routes have preview database isolation checks.");
