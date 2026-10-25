import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const source = (
  await readFile(
    new URL("../../lib/talkly-ai/reengagement.ts", import.meta.url),
    "utf8",
  )
).replace(/^import.*;$/m, "");
const version = "2026-10-25-v2-adult19";
const js = ts.transpileModule(
  "const CONSENT_VERSION=" + JSON.stringify(version) + ";\n" + source,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const { outreachCandidate, outreachDelivery, OUTREACH_DRAFTS } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const now = new Date("2026-10-25T01:00:00Z");
const member = {
  id: "owner",
  role: "student",
  status: "active",
  consentVersion: version,
  validUntil: null,
  trialUsed: 30,
  lastActivity: "2026-10-23T01:00:00Z",
  hasPaid: false,
  activeSession: false,
  paymentPending: false,
};
const trial = outreachCandidate(member, now);
assert.equal(trial.kind, "trial_followup");
for (const patch of [
  { role: "admin" },
  { role: "teacher" },
  { status: "suspended" },
  { consentVersion: "old" },
  { activeSession: true },
  { paymentPending: true },
  { trialUsed: 0 },
  { lastActivity: "2026-10-25T00:30:00Z" },
  { validUntil: "invalid" },
  { validUntil: "2026-10-26T00:00:00Z" },
])
  assert.equal(outreachCandidate({ ...member, ...patch }, now), null);
const expired = outreachCandidate(
  { ...member, hasPaid: true, validUntil: "2026-10-23T00:00:00Z" },
  now,
);
assert.equal(expired.kind, "pass_expired");
assert.equal(
  outreachCandidate(
    { ...member, hasPaid: true, validUntil: "2026-10-24T02:00:00Z" },
    now,
  ),
  null,
);
assert.equal(
  outreachDelivery(
    trial,
    { email: false, kakao: false },
    { email: true, kakao: true },
    new Set(),
    now,
  ).channel,
  null,
);
assert.equal(
  outreachDelivery(
    trial,
    { email: true, kakao: true },
    { email: true, kakao: true },
    new Set(),
    now,
  ).channel,
  "email",
);
assert.equal(
  outreachDelivery(
    trial,
    { email: true, kakao: true },
    { email: false, kakao: true },
    new Set(),
    now,
  ).channel,
  "kakao",
);
assert.equal(
  outreachDelivery(
    trial,
    { email: true, kakao: true },
    { email: true, kakao: true },
    new Set([trial.key]),
    now,
  ).reason,
  "already_sent",
);
assert.equal(
  outreachDelivery(
    trial,
    { email: true, kakao: true },
    { email: true, kakao: true },
    new Set(),
    new Date("2026-10-25T09:00:00Z"),
  ).reason,
  "outside_hours",
);
assert.equal(
  outreachCandidate({ ...member, lastActivity: "2026-10-22T00:00:00Z" }, now)
    .key,
  trial.key,
); // Only one trial follow-up even if the learner returns.
assert.ok(
  Object.values(OUTREACH_DRAFTS).every(
    (d) =>
      d.title.startsWith("(광고)") &&
      d.text.includes("수신거부") &&
      d.text.includes("자동결제는 없습니다"),
  ),
);
console.log(
  "PASS: trial/lapsed-pass eligibility, adult/customer/active exclusions, cooldown, consent, one channel, dedup key, daytime window and explicit draft disclosures.",
);
