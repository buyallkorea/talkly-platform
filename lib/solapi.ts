import "server-only";

import crypto from "crypto";

const SOLAPI_ENDPOINT =
  "https://api.solapi.com/messages/v4/send-many/detail";

function getSolapiConfig() {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;

  if (!apiKey) {
    throw new Error("SOLAPI_API_KEY 환경변수가 없습니다.");
  }

  if (!apiSecret) {
    throw new Error("SOLAPI_API_SECRET 환경변수가 없습니다.");
  }

  if (!senderNumber) {
    throw new Error("SOLAPI_SENDER_NUMBER 환경변수가 없습니다.");
  }

  return {
    apiKey,
    apiSecret,
    senderNumber: normalizeKoreanPhone(senderNumber),
  };
}

export function normalizeKoreanPhone(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function isValidKoreanMobilePhone(value: string) {
  return /^01[016789][0-9]{7,8}$/.test(
    normalizeKoreanPhone(value)
  );
}

export function createVerificationCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function createVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashPhoneVerificationValue(
  phone: string,
  value: string
) {
  const { apiSecret } = getSolapiConfig();

  return crypto
    .createHmac("sha256", apiSecret)
    .update(`talkly-phone-verification:${phone}:${value}`)
    .digest("hex");
}

export function safeHashEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createAuthorizationHeader() {
  const { apiKey, apiSecret } = getSolapiConfig();
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function sendTalklyVerificationSms(
  phone: string,
  code: string
) {
  const { senderNumber } = getSolapiConfig();
  const to = normalizeKoreanPhone(phone);

  const response = await fetch(SOLAPI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: createAuthorizationHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          to,
          from: senderNumber,
          text: `[TALKLY] 인증번호 ${code}`,
          type: "SMS",
        },
      ],
    }),
    cache: "no-store",
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error("SOLAPI SEND ERROR:", response.status, responseText);
    throw new Error("인증문자 발송에 실패했습니다.");
  }

  return responseText;
}