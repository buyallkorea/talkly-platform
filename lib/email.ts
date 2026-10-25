import "server-only";

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";

const SMTP_PORT = Number(process.env.SMTP_PORT?.trim() || "465");

const SMTP_USER = process.env.SMTP_USER?.trim() || "";

const SMTP_PASSWORD = process.env.SMTP_PASSWORD?.trim() || "";

const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL?.trim() || SMTP_USER;

const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME?.trim() || "TALKLY";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  timeoutMs?: number;
};

function assertEmailConfig() {
  if (!SMTP_USER) {
    throw new Error("SMTP_USER 환경변수가 설정되어 있지 않습니다.");
  }

  if (!SMTP_PASSWORD) {
    throw new Error("SMTP_PASSWORD 환경변수가 설정되어 있지 않습니다.");
  }

  if (!SMTP_FROM_EMAIL) {
    throw new Error("SMTP_FROM_EMAIL 환경변수가 설정되어 있지 않습니다.");
  }

  if (!Number.isInteger(SMTP_PORT) || SMTP_PORT <= 0) {
    throw new Error("SMTP_PORT 환경변수가 올바르지 않습니다.");
  }
}

function createTransporter(timeoutMs?: number) {
  assertEmailConfig();

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    ...(timeoutMs === undefined
      ? {}
      : {
          connectionTimeout: timeoutMs,
          greetingTimeout: timeoutMs,
          socketTimeout: timeoutMs,
        }),
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  timeoutMs,
}: SendEmailParams) {
  if (
    timeoutMs !== undefined &&
    (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000)
  )
    throw new Error("Invalid email timeout");
  const normalizedTo = to.trim();

  if (!normalizedTo) {
    throw new Error("이메일 수신자 주소가 없습니다.");
  }

  const transporter = createTransporter(timeoutMs);

  const pending = transporter.sendMail({
    from: {
      name: SMTP_FROM_NAME,
      address: SMTP_FROM_EMAIL,
    },
    to: normalizedTo,
    subject,
    html,
    text,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const info =
      timeoutMs === undefined
        ? await pending
        : await Promise.race([
            pending,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                try {
                  transporter.close();
                } catch {}
                reject(new Error("Email result unconfirmed"));
              }, timeoutMs);
            }),
          ]);
    return {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (timeoutMs !== undefined) {
      try {
        transporter.close();
      } catch {}
    }
  }
}
