import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase-admin";
import {
  createVerificationToken,
  hashPhoneVerificationValue,
  isValidKoreanMobilePhone,
  normalizeKoreanPhone,
  safeHashEquals,
} from "@/lib/solapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VERIFY_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const rawPhone =
      body && typeof body.phone === "string"
        ? body.phone
        : "";

    const code =
      body && typeof body.code === "string"
        ? body.code.replace(/[^0-9]/g, "")
        : "";

    const phone = normalizeKoreanPhone(rawPhone);

    if (!isValidKoreanMobilePhone(phone)) {
      return NextResponse.json(
        {
          error: "올바른 휴대폰 번호를 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (!/^[0-9]{6}$/.test(code)) {
      return NextResponse.json(
        {
          error: "6자리 인증번호를 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const admin = createAdminClient();

    const nowIso = new Date().toISOString();

    const {
      data: verification,
      error: lookupError,
    } = await admin
      .from("phone_verifications")
      .select(
        `
          id,
          code_hash,
          expires_at,
          verified_at,
          attempt_count,
          created_at
        `
      )
      .eq("phone", phone)
      .is("verified_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "PHONE VERIFICATION LOOKUP ERROR:",
        lookupError
      );

      return NextResponse.json(
        {
          error: "인증정보를 확인하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    if (!verification) {
      return NextResponse.json(
        {
          error:
            "유효한 인증번호가 없습니다. 인증번호를 다시 요청해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      verification.attempt_count >=
      MAX_VERIFY_ATTEMPTS
    ) {
      return NextResponse.json(
        {
          error:
            "인증번호 입력 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.",
        },
        {
          status: 429,
        }
      );
    }

    const submittedHash =
      hashPhoneVerificationValue(
        phone,
        code
      );

    const matched = safeHashEquals(
      verification.code_hash,
      submittedHash
    );

    const nextAttemptCount =
      verification.attempt_count + 1;

    if (!matched) {
      const { error: attemptUpdateError } =
        await admin
          .from("phone_verifications")
          .update({
            attempt_count: nextAttemptCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", verification.id);

      if (attemptUpdateError) {
        console.error(
          "PHONE VERIFICATION ATTEMPT UPDATE ERROR:",
          attemptUpdateError
        );
      }

      const remaining = Math.max(
        0,
        MAX_VERIFY_ATTEMPTS -
          nextAttemptCount
      );

      return NextResponse.json(
        {
          error:
            remaining > 0
              ? `인증번호가 일치하지 않습니다. ${remaining}회 더 입력할 수 있습니다.`
              : "인증번호 입력 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    const verificationToken =
      createVerificationToken();

    const verificationTokenHash =
      hashPhoneVerificationValue(
        phone,
        verificationToken
      );

    const verifiedAt =
      new Date().toISOString();

    const {
      data: updatedVerification,
      error: updateError,
    } = await admin
      .from("phone_verifications")
      .update({
        verified_at: verifiedAt,
        verification_token_hash:
          verificationTokenHash,
        attempt_count: nextAttemptCount,
        updated_at: verifiedAt,
      })
      .eq("id", verification.id)
      .is("verified_at", null)
      .select("id")
      .maybeSingle();

    if (
      updateError ||
      !updatedVerification
    ) {
      console.error(
        "PHONE VERIFICATION UPDATE ERROR:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "휴대폰 인증을 완료하지 못했습니다. 다시 시도해주세요.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      verificationToken,
    });
  } catch (error) {
    console.error(
      "PHONE VERIFICATION VERIFY ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "휴대폰 인증 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}