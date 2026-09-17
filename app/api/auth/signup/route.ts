import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  hashPhoneVerificationValue,
  isValidKoreanMobilePhone,
  normalizeKoreanPhone,
} from "@/lib/solapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERIFIED_TOKEN_VALID_MINUTES = 15;

type SignupRole = "parent" | "student";

function isSignupRole(value: unknown): value is SignupRole {
  return value === "parent" || value === "student";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const name =
      body && typeof body.name === "string" ? body.name.trim() : "";
    const email =
      body && typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";
    const password =
      body && typeof body.password === "string" ? body.password : "";
    const role = body?.role;
    const phone = normalizeKoreanPhone(
      body && typeof body.phone === "string" ? body.phone : ""
    );
    const verificationToken =
      body && typeof body.verificationToken === "string"
        ? body.verificationToken
        : "";

    if (!name) {
      return NextResponse.json(
        { error: "이름을 입력해주세요." },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "올바른 이메일을 입력해주세요." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "비밀번호는 8자 이상 입력해주세요." },
        { status: 400 }
      );
    }

    if (!isSignupRole(role)) {
      return NextResponse.json(
        { error: "회원 유형을 확인해주세요." },
        { status: 400 }
      );
    }

    if (!isValidKoreanMobilePhone(phone) || !verificationToken) {
      return NextResponse.json(
        { error: "휴대폰 인증을 완료해주세요." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const tokenHash = hashPhoneVerificationValue(phone, verificationToken);
    const validSince = new Date(
      Date.now() - VERIFIED_TOKEN_VALID_MINUTES * 60 * 1000
    ).toISOString();

    const { data: verification, error: verificationError } = await admin
      .from("phone_verifications")
      .select("id, phone, verified_at, consumed_at")
      .eq("phone", phone)
      .eq("verification_token_hash", tokenHash)
      .is("consumed_at", null)
      .not("verified_at", "is", null)
      .gte("verified_at", validSince)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verificationError) {
      console.error("SIGNUP VERIFICATION LOOKUP ERROR:", verificationError);
      return NextResponse.json(
        { error: "휴대폰 인증정보를 확인하지 못했습니다." },
        { status: 500 }
      );
    }

    if (!verification) {
      return NextResponse.json(
        {
          error:
            "휴대폰 인증이 만료되었거나 유효하지 않습니다. 다시 인증해주세요.",
        },
        { status: 400 }
      );
    }

    const reservedAt = new Date().toISOString();
    const { data: reservedVerification, error: reserveError } = await admin
      .from("phone_verifications")
      .update({
        consumed_at: reservedAt,
        updated_at: reservedAt,
      })
      .eq("id", verification.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();

    if (reserveError || !reservedVerification) {
      console.error("SIGNUP TOKEN RESERVE ERROR:", reserveError);
      return NextResponse.json(
        { error: "이미 사용되었거나 만료된 휴대폰 인증입니다. 다시 인증해주세요." },
        { status: 409 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.error("SIGNUP ENV ERROR: Supabase public env is missing");
      return NextResponse.json(
        { error: "회원가입 서버 설정을 확인할 수 없습니다." },
        { status: 500 }
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          phone,
        },
      },
    });

    if (error) {
      console.error("SERVER SIGNUP ERROR:", error);

      const { error: releaseError } = await admin
        .from("phone_verifications")
        .update({
          consumed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", verification.id)
        .eq("consumed_at", reservedAt);

      if (releaseError) {
        console.error("SIGNUP TOKEN RELEASE ERROR:", releaseError);
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "회원가입 정보를 확인할 수 없습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      userId: data.user.id,
    });
  } catch (error) {
    console.error("SIGNUP API ERROR:", error);
    return NextResponse.json(
      { error: "회원가입 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}