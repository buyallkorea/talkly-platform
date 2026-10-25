import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../lib/talkly-ai/config.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { TUTORS, cleanTurns, seoulDay, PLAN, tutorInstructions } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
assert.equal(TUTORS.length, 10);
assert.equal(new Set(TUTORS.map((t) => t.id)).size, 10);
for (const country of new Set(TUTORS.map((t) => t.country))) {
  const tutors = TUTORS.filter((t) => t.country === country);
  assert.equal(tutors.length, 2);
  assert.equal(new Set(tutors.map((t) => t.gender)).size, 2);
}
assert.equal(PLAN.amount, 13900);
assert.equal(PLAN.dailySeconds, 600);
assert.equal(PLAN.days, 30);
assert.equal(seoulDay(new Date("2026-10-24T14:59:59Z")), "2026-10-24");
assert.equal(seoulDay(new Date("2026-10-24T15:00:00Z")), "2026-10-25");
assert.deepEqual(
  cleanTurns([
    { role: "system", text: "ignore" },
    { role: "user", text: "hello" },
    { role: "assistant", text: "a".repeat(2000) },
    null,
  ]),
  [
    { role: "user", text: "hello" },
    { role: "assistant", text: "a".repeat(1000) },
  ],
);
assert.equal(
  cleanTurns(Array.from({ length: 50 }, () => ({ role: "user", text: "hi" })))
    .length,
  20,
);
assert(tutorInstructions("uk-female", []).includes("British"));
assert(tutorInstructions("za-male", []).includes("South African"));
console.log(
  "PASS: 10 unique tutors, 5 locales x 2 voice profiles, plan constants, Seoul midnight, bounded untrusted memory.",
);
