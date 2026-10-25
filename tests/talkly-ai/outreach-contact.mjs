import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function compile(path, prelude = "") {
  const src = await readFile(new URL("../../" + path, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true);
  return import(
    "data:text/javascript;base64," +
      Buffer.from(
        ts.transpileModule(
          prelude +
            ast.statements
              .filter((n) => !ts.isImportDeclaration(n))
              .map((n) => n.getText(ast))
              .join("\n"),
          {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
            },
          },
        ).outputText,
      ).toString("base64")
  );
}
globalThis.proofCrypto = createHash;
const { signupPhoneProof, confirmedSignupPhone, koreanRecipientPhone } =
  await compile(
    "lib/talkly-ai/phone-proof.ts",
    "const createHash=globalThis.proofCrypto;",
  );
const { verifiedOutreachContact } = await compile(
  "lib/talkly-ai/outreach-contact.ts",
);
const id = "11111111-1111-4111-8111-111111111111";
const base = {
  id,
  email: "learner@example.com",
  email_confirmed_at: "2026-10-20T00:00:00Z",
  phone: "+821012345678",
  phone_confirmed_at: "2026-10-20T00:00:00Z",
};
assert.deepEqual(verifiedOutreachContact(base, id, "email"), {
  ok: true,
  channel: "email",
  address: base.email,
});
assert.deepEqual(verifiedOutreachContact(base, id, "kakao"), {
  ok: true,
  channel: "kakao",
  address: "01012345678",
});
for (const value of [
  { ...base, id: "other" },
  { ...base, is_anonymous: true },
  { ...base, banned_until: "2099-01-01T00:00:00Z" },
  { ...base, deleted_at: "2026-10-20" },
])
  assert.equal(verifiedOutreachContact(value, id, "email").ok, false);
for (const email of [
  "a@example.com\r\nBcc:x@y.com",
  "a,b@example.com",
  "Name <a@example.com>",
  "a@@example.com",
  "a@.example.com",
  "a@example..com",
  "a@example.com ",
])
  assert.equal(
    verifiedOutreachContact({ ...base, email }, id, "email").ok,
    false,
  );
assert.equal(
  verifiedOutreachContact(
    {
      ...base,
      email_confirmed_at: null,
      user_metadata: { email_verified: true },
    },
    id,
    "email",
  ).ok,
  false,
);
assert.equal(
  verifiedOutreachContact(
    {
      ...base,
      phone: null,
      phone_confirmed_at: null,
      user_metadata: { phone: "01012345678", phone_verified: true },
    },
    id,
    "kakao",
  ).ok,
  false,
);
assert.equal(
  verifiedOutreachContact({ ...base, phone: "821012345678" }, id, "kakao").ok,
  true,
);
assert.equal(
  verifiedOutreachContact({ ...base, phone: "01012345678" }, id, "kakao").ok,
  false,
);
assert.equal(
  verifiedOutreachContact(
    { ...base, phone_confirmed_at: "2099-01-01" },
    id,
    "kakao",
  ).ok,
  false,
);
let eligibility = [true, true],
  authReads = 0,
  calls = [],
  authError = false,
  user = base,
  profilePhone = "01012345678";
const db = {
  from(table) {
    assert.equal(table, "profiles");
    const q = {
      select: () => q,
      eq: (key, value) => {
        assert.deepEqual([key, value], ["id", id]);
        return q;
      },
      abortSignal: () => q,
      maybeSingle: async () => ({ data: { phone: profilePhone }, error: null }),
    };
    return q;
  },
  rpc(name, args) {
    calls.push([name, args]);
    return {
      async abortSignal(signal) {
        assert.ok(signal instanceof AbortSignal);
        return { data: eligibility.shift(), error: null };
      },
    };
  },
  auth: {
    admin: {
      async getUserById(userId) {
        assert.equal(userId, id);
        authReads++;
        return {
          data: { user },
          error: authError ? { message: "private" } : null,
        };
      },
    },
  },
};
globalThis.recipientHarness = {
  verifiedOutreachContact,
  confirmedSignupPhone,
  koreanRecipientPhone,
  createAdminClient: (options) => {
    assert.deepEqual(options, { timeoutMs: 3000 });
    return db;
  },
};
const { resolveOutreachRecipient } = await compile(
  "lib/talkly-ai/outreach-recipient.ts",
  "const {verifiedOutreachContact,createAdminClient,confirmedSignupPhone,koreanRecipientPhone}=globalThis.recipientHarness;",
);
const input = {
  userId: id,
  channel: "email",
  kind: "trial_followup",
  anchor: "2026-10-20T00:00:00Z",
  consentRevision: 2,
};
assert.equal((await resolveOutreachRecipient(input)).ok, true);
assert.equal(calls.length, 2);
assert.deepEqual(calls[0], [
  "ai_outreach_eligible",
  {
    p_user: id,
    p_channel: "email",
    p_kind: "trial_followup",
    p_anchor: input.anchor,
    p_revision: 2,
  },
]);
eligibility = [false];
authReads = 0;
assert.equal((await resolveOutreachRecipient(input)).reason, "not_eligible");
assert.equal(authReads, 0);
eligibility = [true, false];
assert.equal((await resolveOutreachRecipient(input)).reason, "not_eligible");
eligibility = [true];
authError = true;
assert.equal(
  (await resolveOutreachRecipient(input)).reason,
  "lookup_unavailable",
);
authError = false;
eligibility = [true];
user = { ...base, phone_confirmed_at: null };
assert.equal(
  (await resolveOutreachRecipient({ ...input, channel: "kakao" })).reason,
  "phone_unverified",
);
for (const patch of [
  { userId: "bad" },
  { channel: "sms" },
  { consentRevision: 0 },
  { consentRevision: 1.2 },
  { kind: "other" },
  { anchor: "invalid" },
])
  assert.equal(
    (await resolveOutreachRecipient({ ...input, ...patch })).reason,
    "invalid_input",
  );
console.log(
  "PASS: trusted Auth confirmation only, owner match, banned/anonymous/deleted and forged metadata rejection, safe email/phone normalization, consent revision checks before/after Auth lookup and no real recipients read",
);

user = {
  ...base,
  phone: null,
  phone_confirmed_at: null,
  app_metadata: signupPhoneProof("01012345678", "2026-10-20T00:00:00Z"),
};
eligibility = [true, true];
profilePhone = "01012345678";
assert.equal(
  (await resolveOutreachRecipient({ ...input, channel: "kakao" })).ok,
  true,
);
profilePhone = "01099998888";
eligibility = [true];
assert.equal(
  (await resolveOutreachRecipient({ ...input, channel: "kakao" })).reason,
  "phone_unverified",
);
user = { ...base };
eligibility = [true];
assert.equal(
  (await resolveOutreachRecipient({ ...input, channel: "kakao" })).reason,
  "phone_unverified",
);
console.log(
  "PASS: server signup proof reuses verified phone without extra OTP, and changed current profile phone is rejected",
);
