import assert from "node:assert/strict";
import ts from "typescript";
import { readFile } from "node:fs/promises";
const saved = {
  user: process.env.SMTP_USER,
  password: process.env.SMTP_PASSWORD,
  from: process.env.SMTP_FROM_EMAIL,
  port: process.env.SMTP_PORT,
  timeout: globalThis.setTimeout,
  clear: globalThis.clearTimeout,
};
Object.assign(process.env, {
  SMTP_USER: "sender@example.com",
  SMTP_PASSWORD: "test-placeholder",
  SMTP_FROM_EMAIL: "sender@example.com",
  SMTP_PORT: "465",
});
let transports = [],
  timers = [],
  pending = false;
globalThis.mailerHarness = {
  createTransport(options) {
    const transport = {
      options,
      closed: 0,
      sendMail: async (message) => {
        transport.message = message;
        if (pending) return new Promise(() => {});
        return {
          messageId: "message-id",
          accepted: [message.to],
          rejected: [],
        };
      },
      close() {
        transport.closed++;
      },
    };
    transports.push(transport);
    return transport;
  },
};
globalThis.setTimeout = (cb, ms) => {
  const item = { cb, ms };
  timers.push(item);
  return item;
};
globalThis.clearTimeout = (item) => {
  item.cleared = true;
};
try {
  const src = await readFile(
    new URL("../../lib/email.ts", import.meta.url),
    "utf8",
  );
  const ast = ts.createSourceFile(
    "email.ts",
    src,
    ts.ScriptTarget.Latest,
    true,
  );
  const code =
    "const nodemailer=globalThis.mailerHarness;" +
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getText(ast))
      .join("\n");
  const { sendEmail } = await import(
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
  const message = {
    to: "learner@example.com",
    subject: "Test",
    html: "<p>Test</p>",
    text: "Test",
  };
  await sendEmail(message);
  assert.equal(transports[0].options.connectionTimeout, undefined);
  assert.equal(transports[0].closed, 0);
  assert.equal(timers.length, 0);
  await sendEmail({ ...message, timeoutMs: 15000 });
  assert.equal(transports[1].options.connectionTimeout, 15000);
  assert.equal(transports[1].options.greetingTimeout, 15000);
  assert.equal(transports[1].options.socketTimeout, 15000);
  assert.equal(timers.at(-1).cleared, true);
  assert.equal(transports[1].closed, 1);
  pending = true;
  const timeout = assert.rejects(
    sendEmail({ ...message, timeoutMs: 15000 }),
    /unconfirmed/,
  );
  timers.at(-1).cb();
  await timeout;
  assert.ok(transports.at(-1).closed >= 1);
  assert.equal(timers.at(-1).cleared, true);
  const count = transports.length;
  await assert.rejects(sendEmail({ ...message, timeoutMs: 0 }));
  assert.equal(transports.length, count);
  console.log(
    "PASS: legacy SMTP behavior unchanged, optional whole-send deadline closes transport, pending result stays unconfirmed, timers cleared and invalid options do not connect; zero SMTP connections",
  );
} finally {
  globalThis.setTimeout = saved.timeout;
  globalThis.clearTimeout = saved.clear;
  for (const [key, value] of [
    ["SMTP_USER", saved.user],
    ["SMTP_PASSWORD", saved.password],
    ["SMTP_FROM_EMAIL", saved.from],
    ["SMTP_PORT", saved.port],
  ])
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
}
