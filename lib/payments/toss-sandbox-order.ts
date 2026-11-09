import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOSS_SANDBOX_AMOUNT = 1000;
export const TOSS_SANDBOX_ORDER_PREFIX = "TALKLYTEST";
const MAX_AGE_SECONDS = 10 * 60;

export function isSandboxKeyPair(clientKey: string | undefined, secretKey: string | undefined): boolean {
  return Boolean(clientKey?.startsWith("test_gck_") && secretKey?.startsWith("test_gsk_"));
}

function signOrder(secret: string, adminId: string, timestamp: string, nonce: string): string {
  const signingKey = createHmac("sha256", secret).update("talkly-admin-test-signing-v1").digest();
  return createHmac("sha256", signingKey)
    .update([TOSS_SANDBOX_ORDER_PREFIX, adminId, timestamp, nonce, TOSS_SANDBOX_AMOUNT].join("|"))
    .digest("hex")
    .slice(0, 20);
}

/** No production enrollment, order or payment table is touched by this test. */
export function createSandboxOrder(secret: string, adminId: string, now = Date.now()): string {
  const timestamp = Math.floor(now / 1000).toString(36);
  const nonce = randomBytes(8).toString("hex");
  return [TOSS_SANDBOX_ORDER_PREFIX, timestamp, nonce, signOrder(secret, adminId, timestamp, nonce)].join("-");
}

export function verifySandboxOrder(secret: string, adminId: string, orderId: string, now = Date.now()): boolean {
  const pieces = orderId.split("-");
  if (pieces.length !== 4 || pieces[0] !== TOSS_SANDBOX_ORDER_PREFIX ||
      !/^[0-9a-z]{5,10}$/.test(pieces[1]) || !/^[a-f0-9]{16}$/.test(pieces[2]) ||
      !/^[a-f0-9]{20}$/.test(pieces[3])) return false;
  const issued = parseInt(pieces[1], 36) * 1000;
  if (!Number.isSafeInteger(issued) || issued > now + 30_000 || now - issued > MAX_AGE_SECONDS * 1000) return false;
  const expected = signOrder(secret, adminId, pieces[1], pieces[2]);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(pieces[3], "hex"));
}
