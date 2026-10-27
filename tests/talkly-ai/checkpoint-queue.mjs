import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../lib/talkly-ai/checkpoint-queue.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { CheckpointQueue } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const sent = [],
  gates = [];
let active = 0,
  maxActive = 0;
const queue = new CheckpointQueue((id, turns) => {
  active++;
  maxActive = Math.max(active, maxActive);
  sent.push([id, turns]);
  return new Promise((resolve, reject) =>
    gates.push({
      resolve: () => {
        active--;
        resolve();
      },
      reject: () => {
        active--;
        reject(new Error("network failure"));
      },
    }),
  );
});
const turn = (n) => [{ role: "user", text: String(n) }];
const first = queue.save("a", turn(1));
const pending = Array.from({ length: 99 }, (_, i) =>
  queue.save("a", turn(i + 2)),
);
assert.equal(sent.length, 1);
gates[0].resolve();
await first;
await Promise.resolve();
assert.equal(sent.length, 2);
assert.equal(sent[1][1][0].text, "100");
gates[1].resolve();
await Promise.all(pending);
assert.equal(maxActive, 1);
// Coalescing cannot merge or relabel two sessions, and failure must not strand the queue.
const a = queue.save("old", turn(101));
const b = queue.save("new", turn(102));
const c = queue.save("new", turn(103));
const failure = assert.rejects(a, /network failure/);
gates[2].reject();
await failure;
await Promise.resolve();
assert.equal(sent[3][0], "new");
assert.equal(sent[3][1][0].text, "103");
gates[3].resolve();
await Promise.all([b, c]);
const original = Array.from({ length: 30 }, (_, i) => ({
  role: "user",
  text: String(i),
}));
const final = queue.save("last", original);
original.at(-1).text = "mutated";
assert.equal(sent[4][1].length, 20);
assert.equal(sent[4][1].at(-1).text, "29");
gates[4].resolve();
await final;
assert.equal(active, 0);
console.log(
  "PASS: 100 pending snapshots send first/latest only, single in-flight write, session isolation, failed-send recovery, waiter completion and bounded copied snapshot",
);
