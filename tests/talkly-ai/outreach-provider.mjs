import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const src = await readFile(
  new URL("../../lib/talkly-ai/outreach-provider.ts", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "provider.ts",
  src,
  ts.ScriptTarget.Latest,
  true,
);
let emailCalls = 0,
  fetchCalls = [],
  payload,
  mailResult = {
    messageId: "message-id",
    accepted: ["learner@example.com"],
    rejected: [],
  },
  throwMail = false;
globalThis.providerHarness = {
  createAuthorizationHeader: () => "test-placeholder",
  sendEmail: async (args) => {
    emailCalls++;
    assert.equal(args.timeoutMs, 15000);
    if (throwMail) throw Error("private SMTP failure");
    return mailResult;
  },
};
const code =
  "const {createAuthorizationHeader,sendEmail}=globalThis.providerHarness;" +
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n");
const { deliverOutreach, outreachSendConfiguration } = await import(
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
const names = [
  "TALKLY_AI_OUTREACH_DELIVERY_ENABLED",
  "TALKLY_AI_SERVICE_ORIGIN",
  "TALKLY_AI_OPERATOR_CONTACT",
  "TALKLY_AI_KAKAO_PFID",
  "SOLAPI_API_KEY",
  "SOLAPI_API_SECRET",
  "SOLAPI_SENDER_NUMBER",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM_EMAIL",
  "SMTP_PORT",
];
const saved = Object.fromEntries(names.map((n) => [n, process.env[n]])),
  oldFetch = globalThis.fetch;
for (const n of names) delete process.env[n];
globalThis.fetch = async (url, options) => {
  assert.equal(url, "https://api.solapi.com/messages/v4/send-many/detail");
  fetchCalls.push(JSON.parse(options.body));
  assert.ok(options.signal instanceof AbortSignal);
  return new Response(JSON.stringify(payload), { status: 200 });
};
const message = {
  subject: "(광고) Test",
  text: "(광고) Test\nUnsubscribe",
  html: "<p>Test</p>",
};
try {
  assert.equal(
    (await deliverOutreach("email", "learner@example.com", message)).state,
    "failed",
  );
  assert.equal(emailCalls, 0);
  assert.equal(fetchCalls.length, 0);
  Object.assign(process.env, {
    TALKLY_AI_OUTREACH_DELIVERY_ENABLED: "true",
    TALKLY_AI_SERVICE_ORIGIN: "https://test.example",
    TALKLY_AI_OPERATOR_CONTACT: "help@example.com",
    TALKLY_AI_KAKAO_PFID: "PFtest123",
    SOLAPI_API_KEY: "test",
    SOLAPI_API_SECRET: "test",
    SOLAPI_SENDER_NUMBER: "01000000000",
    SMTP_USER: "sender@example.com",
    SMTP_PASSWORD: "test",
  });
  assert.deepEqual(outreachSendConfiguration().available, {
    kakao: true,
    email: true,
  });
  assert.equal(
    (await deliverOutreach("email", "learner@example.com", message)).state,
    "accepted",
  );
  throwMail = true;
  assert.equal(
    (await deliverOutreach("email", "learner@example.com", message)).state,
    "unknown",
  );
  throwMail = false;
  mailResult = {
    messageId: "message-id",
    accepted: [],
    rejected: ["learner@example.com"],
  };
  assert.equal(
    (await deliverOutreach("email", "learner@example.com", message)).state,
    "failed",
  );
  assert.equal(fetchCalls.length, 0);
  payload = {
    groupInfo: {
      groupId: "group-id",
      count: { total: 1, registeredSuccess: 1, registeredFailed: 0 },
    },
    failedMessageList: [],
    messageList: [{ messageId: "message-id", statusCode: "2000" }],
  };
  assert.equal(
    (await deliverOutreach("kakao", "01012345678", message)).state,
    "accepted",
  );
  assert.equal(fetchCalls.length, 1);
  const sent = fetchCalls[0].messages[0];
  assert.equal(sent.kakaoOptions.disableSms, true);
  assert.equal(sent.kakaoOptions.bms.targeting, "I");
  assert.equal(sent.kakaoOptions.bms.chatBubbleType, "TEXT");
  assert.equal(sent.type, "BMS_FREE");
  assert.equal(sent.from, undefined);
  payload = {
    groupInfo: {
      groupId: "group-id",
      count: { total: 1, registeredSuccess: 0, registeredFailed: 1 },
    },
    failedMessageList: [{ to: "01012345678", messageId: "failed-id" }],
  };
  assert.equal(
    (await deliverOutreach("kakao", "01012345678", message)).state,
    "failed",
  );
  payload = {};
  assert.equal(
    (await deliverOutreach("kakao", "01012345678", message)).state,
    "unknown",
  );
  assert.equal(emailCalls, 3);
  console.log(
    "PASS: delivery OFF has zero sends, explicit configuration, SMTP acceptance/rejection/unknown, exact one Kakao request, SMS replacement OFF, friend targeting only and no cross-channel fallback",
  );
} finally {
  globalThis.fetch = oldFetch;
  for (const [n, v] of Object.entries(saved))
    if (v === undefined) delete process.env[n];
    else process.env[n] = v;
}
