import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  createVerificationCode,
  hashPhoneVerificationValue,
  isValidKoreanMobilePhone,
  normalizeKoreanPhone,
  sendTalklyVerificationSms,
} from "@/lib/solapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_EXPIRES_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const rawPhone =
      body && typeof body.phone === "string" ? body.phone : "";
    const phone = normalizeKoreanPhone(rawPhone);

    if (!isValidKoreanMobilePhone(phone)) {
      return NextResponse.json(
        { error: "올바른 휴대폰 번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const now = new Date();
    const cooldownSince = new Date(
      now.getTime() - RESEND_COOLDOWN_SECONDS * 1000
    ).toISOString();
    const hourSince = new Date(
      now.getTime() - 60 * 60 * 1000
    ).toISOString();

    const { data: recentVerification, error: recentError } = await admin
      .from("phone_verifications")
      .select("id, created_at")
      .eq("phone", phone)
      .gte("created_at", cooldownSince)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentError) {
      console.error("PHONE VERIFICATION RECENT CHECK ERROR:", recentError);
      return NextResponse.json(
        { error: "인증 요청을 확인하지 못했습니다." },
        { status: 500 }
      );
    }

    if (recentVerification) {
      return NextResponse.json(
        { error: "인증번호는 60초 후 다시 요청할 수 있습니다." },
        { status: 429 }
      );
    }

    const { count, error: countError } = await admin
      .from("phone_verifications")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", hourSince);

    if (countError) {
      console.error("PHONE VERIFICATION RATE CHECK ERROR:", countError);
      return NextResponse.json(
        { error: "인증 요청을 확인하지 못했습니다." },
        { status: 500 }
      );
    }

    if ((count ?? 0) >= MAX_SENDS_PER_HOUR) {
      return NextResponse.json(
        {
          error:
            "인증번호 요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: 429 }
      );
    }

    const code = createVerificationCode();
    const codeHash = hashPhoneVerificationValue(phone, code);
    const expiresAt = new Date(
      now.getTime() + CODE_EXPIRES_MINUTES * 60 * 1000
    ).toISOString();

    const { data: created, error: insertError } = await admin
      .from("phone_verifications")
      .insert({
        phone,
        code_hash: codeHash,
        expires_at: expiresAt,
        attempt_count: 0,
      })
      .select("id")
      .single();

    if (insertError || !created) {
      console.error("PHONE VERIFICATION INSERT ERROR:", insertError);
      return NextResponse.json(
        { error: "인증번호를 생성하지 못했습니다." },
        { status: 500 }
      );
    }

    try {
      await sendTalklyVerificationSms(phone, code);
    } catch (error) {
      await admin.from("phone_verifications").delete().eq("id", created.id);
      console.error("PHONE VERIFICATION SMS ERROR:", error);

      return NextResponse.json(
        {
          error:
            "인증문자를 발송하지 못했습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      expiresInSeconds: CODE_EXPIRES_MINUTES * 60,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error("PHONE VERIFICATION SEND ERROR:", error);
    return NextResponse.json(
      { error: "인증번호 발송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}