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
    // Do not log raw Solapi bodies: they can contain the recipient or message.
    console.error("SOLAPI SEND HTTP ERROR:", response.status);
    throw new Error("인증문자 접수에 실패했습니다.");
  }

  // Solapi may return HTTP 200 even when individual messages could not be
  // registered (e.g. insufficient balance or unregistered sender number).
  // A successful HTTP request is not proof that this SMS was accepted.
  let delivery: {
    failedMessageList?: unknown[];
    groupInfo?: {
      count?: {
        registeredFailed?: number;
        registeredSuccess?: number;
      };
    };
  };
  try {
    delivery = JSON.parse(responseText);
  } catch {
    console.error("SOLAPI SEND RESPONSE INVALID");
    throw new Error("인증문자 접수 결과를 확인하지 못했습니다.");
  }

  const counts = delivery?.groupInfo?.count;
  const failedCount = Array.isArray(delivery?.failedMessageList)
    ? delivery.failedMessageList.length
    : 0;
  if (
    failedCount > 0 ||
    (typeof counts?.registeredFailed === "number" &&
      counts.registeredFailed > 0) ||
    (typeof counts?.registeredSuccess === "number" &&
      counts.registeredSuccess < 1)
  ) {
    console.error("SOLAPI SMS NOT REGISTERED");
    throw new Error("인증문자 접수에 실패했습니다. 솔라피 잔액과 발신번호를 확인해주세요.");
  }

  // No registration count is ambiguous; fail closed rather than claiming
  // that an SMS has been sent when Solapi did not confirm its acceptance.
  if (counts?.registeredSuccess !== 1) {
    console.error("SOLAPI SEND REGISTRATION UNCONFIRMED");
    throw new Error("인증문자 접수 여부를 확인하지 못했습니다.");
  }

  // Registration does not mean delivery to the recipient's handset.
  return responseText;
}