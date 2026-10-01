import "server-only";

import nodemailer from "nodemailer";

const SMTP_HOST =
  process.env.SMTP_HOST?.trim() ||
  "smtp.gmail.com";

const SMTP_PORT = Number(
  process.env.SMTP_PORT?.trim() || "465"
);

const SMTP_USER =
  process.env.SMTP_USER?.trim() || "";

const SMTP_PASSWORD =
  process.env.SMTP_PASSWORD?.trim() || "";

const SMTP_FROM_EMAIL =
  process.env.SMTP_FROM_EMAIL?.trim() ||
  SMTP_USER;

const SMTP_FROM_NAME =
  process.env.SMTP_FROM_NAME?.trim() ||
  "TALKLY";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function assertEmailConfig() {
  if (!SMTP_USER) {
    throw new Error(
      "SMTP_USER 환경변수가 설정되어 있지 않습니다."
    );
  }

  if (!SMTP_PASSWORD) {
    throw new Error(
      "SMTP_PASSWORD 환경변수가 설정되어 있지 않습니다."
    );
  }

  if (!SMTP_FROM_EMAIL) {
    throw new Error(
      "SMTP_FROM_EMAIL 환경변수가 설정되어 있지 않습니다."
    );
  }

  if (
    !Number.isInteger(SMTP_PORT) ||
    SMTP_PORT <= 0
  ) {
    throw new Error(
      "SMTP_PORT 환경변수가 올바르지 않습니다."
    );
  }
}

function createTransporter() {
  assertEmailConfig();

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
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
}: SendEmailParams) {
  const normalizedTo = to.trim();

  if (!normalizedTo) {
    throw new Error(
      "이메일 수신자 주소가 없습니다."
    );
  }

  const transporter =
    createTransporter();

  const info = await transporter.sendMail({
    from: {
      name: SMTP_FROM_NAME,
      address: SMTP_FROM_EMAIL,
    },
    to: normalizedTo,
    subject,
    html,
    text,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}