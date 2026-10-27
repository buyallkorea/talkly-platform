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
const { signupPhoneProof, confirmedSignupPhone } = await compile(
  "lib/talkly-ai/phone-proof.ts",
  "const createHash=globalThis.proofCrypto;",
);
const at = new Date(Date.now() - 120000).toISOString(),
  phone = "01012345678",
  metadata = signupPhoneProof(phone, at);
assert.equal(JSON.stringify(metadata).includes(phone), false);
assert.equal(confirmedSignupPhone({ app_metadata: metadata }, phone), phone);
assert.equal(confirmedSignupPhone({ user_metadata: metadata }, phone), null);
assert.equal(
  confirmedSignupPhone({ app_metadata: metadata }, "01099998888"),
  null,
);
assert.equal(
  confirmedSignupPhone(
    {
      app_metadata: {
        talkly_phone_proof: {
          ...metadata.talkly_phone_proof,
          source: "browser",
        },
      },
    },
    phone,
  ),
  null,
);
assert.deepEqual(signupPhoneProof(phone, "invalid"), {});
let exists = true,
  reservable = true,
  created = [],
  lookups = [];
const admin = {
  from(table) {
    assert.equal(table, "phone_verifications");
    let mutation = false;
    const q = {
      select: () => q,
      eq: (key, value) => {
        lookups.push([key, value]);
        return q;
      },
      is: () => q,
      not: () => q,
      gte: () => q,
      order: () => q,
      limit: () => q,
      update: () => {
        mutation = true;
        return q;
      },
      maybeSingle: async () => ({
        data: mutation
          ? reservable
            ? { id: "verified" }
            : null
          : exists
            ? { id: "verified", phone, verified_at: at }
            : null,
        error: null,
      }),
    };
    return q;
  },
  auth: {
    admin: {
      createUser: async (payload) => {
        created.push(payload);
        return {
          data: {
            user: {
              id: "new-user",
              email: "learner@example.com",
              email_confirmed_at: at,
            },
          },
          error: null,
        };
      },
    },
    resend: async () => {
      throw Error("unexpected email");
    },
  },
};
globalThis.signupProofHarness = {
  signupPhoneProof,
  NextResponse: { json: (v, o) => Response.json(v, o) },
  createAdminClient: () => admin,
  normalizeKoreanPhone: (x) => x.replace(/[^0-9]/g, ""),
  isValidKoreanMobilePhone: (x) => /^010\d{8}$/.test(x),
  hashPhoneVerificationValue: (p, t) => {
    assert.equal(p, phone);
    assert.equal(t, "one-use-token");
    return "known-hash";
  },
};
const { POST } = await compile(
  "app/api/auth/signup/route.ts",
  "const {signupPhoneProof,NextResponse,createAdminClient,normalizeKoreanPhone,isValidKoreanMobilePhone,hashPhoneVerificationValue}=globalThis.signupProofHarness;",
);
const send = (extra) =>
  POST(
    new Request("https://test.example/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: "Learner",
        email: "learner@example.com",
        password: "test-only-password",
        role: "student",
        phone,
        verificationToken: "one-use-token",
        ...extra,
      }),
    }),
  );
let response = await send({
  app_metadata: {
    role: "admin",
    talkly_phone_proof: { phone_sha256: "forged" },
  },
});
assert.equal(response.status, 200);
assert.equal(created.length, 1);
assert.deepEqual(created[0].app_metadata, metadata);
assert.equal(created[0].app_metadata.role, undefined);
assert.equal(created[0].user_metadata.role, "student");
assert.equal(created[0].email_confirm, false);
assert.equal(
  JSON.stringify(created[0].app_metadata).includes("one-use-token"),
  false,
);
assert.ok(
  lookups.some(
    ([key, value]) =>
      key === "verification_token_hash" && value === "known-hash",
  ),
);
created = [];
exists = false;
assert.equal((await send({})).status, 400);
assert.equal(created.length, 0);
exists = true;
reservable = false;
assert.equal((await send({})).status, 409);
assert.equal(created.length, 0);
reservable = true;
assert.equal((await send({ role: "admin" })).status, 400);
assert.equal(created.length, 0);
console.log(
  "PASS: actual signup stamps server phone hash/time only after valid consumed OTP, ignores browser app metadata, preserves role/email confirmation flow and refuses expired/replayed OTP; no live signup/SMS/email",
);
