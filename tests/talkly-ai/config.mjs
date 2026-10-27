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
const { TUTORS, normalizeTutorId, cleanTurns, seoulDay, PLAN, TRIAL_SECONDS, tutorInstructions } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
assert.equal(TUTORS.length, 6);
assert.equal(new Set(TUTORS.map((t) => t.id)).size, 6);
for (const country of new Set(TUTORS.map((t) => t.style))) {
  const tutors = TUTORS.filter((t) => t.style === country);
  assert.equal(tutors.length, 2);
  assert.equal(new Set(tutors.map((t) => t.gender)).size, 2);
}
assert.equal(PLAN.amount, 13900);
assert.equal(TRIAL_SECONDS, 180, "signup trial must remain three minutes");
assert.equal(PLAN.dailySeconds, 600);
assert.equal(PLAN.days, 30);
assert.equal(seoulDay(new Date("2026-10-24T14:59:59Z")), "2026-10-24");
assert.equal(seoulDay(new Date("2026-10-24T15:00:00Z")), "2026-10-25");
assert.equal(seoulDay(new Date("2026-12-31T14:59:59Z")), "2026-12-31");
assert.equal(seoulDay(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
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
assert(tutorInstructions("lively-female", []).includes("cheerful"));
assert(tutorInstructions("intellectual-male", []).includes("thoughtful"));
assert(tutorInstructions("calm-female", []).includes("patient"));
assert.equal(normalizeTutorId("uk-female"), "lively-female");
console.log(
  "PASS: 6 unique tutors, 3 personalities x 2 voice profiles, plan constants, Seoul midnight, bounded untrusted memory.",
);
