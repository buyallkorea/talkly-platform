import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const code = ts.transpileModule(
  await readFile(
    new URL("../../lib/talkly-ai/client-connection.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const { ConnectionEpoch, CancelledConnection, leaseMilliseconds } =
  await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  );
const gate = new ConnectionEpoch();
let release;
let stopped = 0;
let attempt = gate.begin();
const pending = gate.microphone(attempt, new Promise((r) => (release = r)));
gate.cancel();
release({
  getTracks: () => [
    {
      stop() {
        stopped++;
      },
    },
    {
      stop() {
        stopped++;
      },
    },
  ],
});
await assert.rejects(() => pending, CancelledConnection);
assert.equal(stopped, 2);
const old = gate.begin();
attempt = gate.begin();
assert.throws(() => gate.assert(old), CancelledConnection);
gate.assert(attempt);
const stream = {
  getTracks: () => [
    {
      stop() {
        stopped++;
      },
    },
  ],
};
assert.equal(await gate.microphone(attempt, Promise.resolve(stream)), stream);
assert.equal(stopped, 2);
gate.cancel();
assert.throws(() => gate.assert(attempt), CancelledConnection);
const server = "2026-10-25T03:00:00.000Z",
  deadline = "2026-10-25T03:03:50.000Z";
const oldNow = Date.now;
try {
  Date.now = () => 0;
  assert.equal(leaseMilliseconds(deadline, server, 240), 230000);
  Date.now = () => 9999999999999;
  assert.equal(leaseMilliseconds(deadline, server, 240), 230000);
} finally {
  Date.now = oldNow;
}
assert.equal(leaseMilliseconds("2026-10-25T02:59:59Z", server, 240), 0);
assert.equal(leaseMilliseconds("2026-10-25T04:00:00Z", server, 120), 120000);
assert.equal(leaseMilliseconds("2026-10-25T03:03:00Z", server, 180), 180000,
  "three-minute trial lease must not exceed 180 seconds");
assert.equal(leaseMilliseconds("2026-10-25T03:03:50Z", server, 180), 180000,
  "excess server deadline cannot extend trial lease");
assert.equal(leaseMilliseconds("2026-10-25T03:00:01Z", server, 180), 1000,
  "near-expired trial only receives actual remaining server lease");
assert.throws(() => leaseMilliseconds("2026-10-25T03:03:00Z", server, 0));
assert.throws(() => leaseMilliseconds("2026-10-25T03:03:00Z", server, -1));
assert.throws(() => leaseMilliseconds("2026-10-25T03:03:00Z", server, 241));

assert.throws(() => leaseMilliseconds("invalid", server, 240));
assert.throws(() => leaseMilliseconds(deadline, server, 999));
console.log(
  "PASS: late microphone tracks stop after cancellation; replaced attempts cannot resume; valid streams remain live; lease timing ignores PC clock skew and never exceeds server reservation.",
);
