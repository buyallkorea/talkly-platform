import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error Node's test runner loads the TypeScript source directly.
import { getSafeNextPath } from "../lib/safe-next-path.ts";

for (const path of ["/", "/parent/level-tests/1", "/teacher?view=week#today", "/signup?next=%2Fstudent"]) {
  test(`preserves internal path ${path}`, () => assert.equal(getSafeNextPath(path), path));
}
for (const path of [null, "", "https://example.com", "//example.com", "/\\example.com", "/\t/example.com", "/\n/example.com", "/\r/example.com", " /admin", "javascript:alert(1)"]) {
  test(`rejects unsafe path ${JSON.stringify(path)}`, () => assert.equal(getSafeNextPath(path), null));
}
