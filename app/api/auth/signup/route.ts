import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase-admin";
import {
  hashPhoneVerificationValue,
  isValidKoreanMobilePhone,
  normalizeKoreanPhone,
} from "@/lib/solapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignupRole = "student" | "parent";

const SIGNUP_VERIFICATION_VALID_MINUTES = 15;

function isSignupRole(value: unknown): value is SignupRole {
  return value === "student" || value === "parent";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const admin = createAdminClient();

  let verificationId: string | null = null;
  let verificationReserved = false;

  try {
    const body = await request.json().catch(() => null);

    const name =
      body && typeof body.name === "string"
        ? body.name.trim()
        : "";

    const email =
      body && typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      body && typeof body.password === "string"
        ? body.password
        : "";

    const role = body?.role;

    const rawPhone =
      body && typeof body.phone === "string"
        ? body.phone
        : "";

    const verificationToken =
      body && typeof body.verificationToken === "string"
        ? body.verificationToken.trim()
        : "";

    const phone = normalizeKoreanPhone(rawPhone);

    if (!name) {
      return NextResponse.json(
        {
          error: "이름을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        {
          error: "올바른 이메일을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "비밀번호는 8자 이상 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isSignupRole(role)) {
      return NextResponse.json(
        {
          error: "회원 유형을 확인해주세요.",
        },
        {
          status: 400,
        }
      );
    }

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

    if (!verificationToken) {
      return NextResponse.json(
        {
          error: "휴대폰 인증이 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * 브라우저의 인증완료 상태를 신뢰하지 않습니다.
     *
     * verify API에서 발급한 일회용 verificationToken을
     * 다시 SHA-256 해시하여 DB의 실제 인증 기록과 비교합니다.
     */
    const verificationTokenHash =
      hashPhoneVerificationValue(
        phone,
        verificationToken
      );

    const minimumVerifiedAt = new Date(
      Date.now() -
        SIGNUP_VERIFICATION_VALID_MINUTES *
          60 *
          1000
    ).toISOString();

    const {
      data: verification,
      error: verificationError,
    } = await admin
      .from("phone_verifications")
      .select(
        `
          id,
          phone,
          verified_at,
          verification_token_hash,
          consumed_at
        `
      )
      .eq("phone", phone)
      .eq(
        "verification_token_hash",
        verificationTokenHash
      )
      .is("consumed_at", null)
      .not("verified_at", "is", null)
      .gte("verified_at", minimumVerifiedAt)
      .order("verified_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (verificationError) {
      console.error(
        "SIGNUP VERIFICATION LOOKUP ERROR:",
        verificationError
      );

      return NextResponse.json(
        {
          error:
            "휴대폰 인증정보를 확인하지 못했습니다.",
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
            "휴대폰 인증이 만료되었거나 이미 사용되었습니다. 인증번호를 다시 받아주세요.",
        },
        {
          status: 400,
        }
      );
    }

    verificationId = verification.id;

    /*
     * 인증 토큰을 먼저 예약(consume)합니다.
     *
     * 같은 verificationToken으로 동시에 두 번 가입 요청이
     * 들어오는 것을 방지합니다.
     */
    const consumedAt = new Date().toISOString();

    const {
      data: reservedVerification,
      error: reserveError,
    } = await admin
      .from("phone_verifications")
      .update({
        consumed_at: consumedAt,
        updated_at: consumedAt,
      })
      .eq("id", verification.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle();

    if (reserveError) {
      console.error(
        "SIGNUP VERIFICATION RESERVE ERROR:",
        reserveError
      );

      return NextResponse.json(
        {
          error:
            "휴대폰 인증정보를 처리하지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }

    if (!reservedVerification) {
      return NextResponse.json(
        {
          error:
            "이미 사용된 휴대폰 인증입니다. 인증번호를 다시 받아주세요.",
        },
        {
          status: 409,
        }
      );
    }

    verificationReserved = true;

    /*
     * 중요:
     *
     * 별도의 NEXT_PUBLIC_SUPABASE_ANON_KEY 등을 검사하거나
     * 브라우저용 Supabase client를 만들지 않습니다.
     *
     * TALKLY 기존 서버 구조인 createAdminClient()를 그대로 사용합니다.
     */
    const {
      data: signupData,
      error: signupError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        name,
        role,
        phone,
      },
    });

    if (signupError) {
      console.error(
        "SIGNUP CREATE USER ERROR:",
        signupError
      );

      /*
       * Supabase 가입 자체가 실패했다면
       * SMS 인증을 다시 사용할 수 있도록 예약을 해제합니다.
       */
      const { error: releaseError } =
        await admin
          .from("phone_verifications")
          .update({
            consumed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", verification.id)
          .eq("consumed_at", consumedAt);

      if (releaseError) {
        console.error(
          "SIGNUP VERIFICATION RELEASE ERROR:",
          releaseError
        );
      }

      verificationReserved = false;

      const message =
        signupError.message?.toLowerCase() ?? "";

      if (
        message.includes("already") ||
        message.includes("registered") ||
        message.includes("exists")
      ) {
        return NextResponse.json(
          {
            error:
              "이미 가입된 이메일입니다. 로그인해주세요.",
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            "회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.",
        },
        {
          status: 500,
        }
      );
    }

    if (!signupData.user) {
      console.error(
        "SIGNUP CREATE USER ERROR: user was not returned"
      );

      /*
       * user가 생성되지 않은 예외 상황에서도
       * 인증 토큰을 다시 사용할 수 있도록 복구합니다.
       */
      const { error: releaseError } =
        await admin
          .from("phone_verifications")
          .update({
            consumed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", verification.id)
          .eq("consumed_at", consumedAt);

      if (releaseError) {
        console.error(
          "SIGNUP VERIFICATION RELEASE ERROR:",
          releaseError
        );
      }

      verificationReserved = false;

      return NextResponse.json(
        {
          error:
            "회원가입을 완료하지 못했습니다. 다시 시도해주세요.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * auth.users INSERT 시 public.handle_new_user()가 실행되어
     *
     * profiles:
     *   id
     *   name
     *   role
     *   phone
     *
     * 그리고 role에 따라
     * parent_profiles 또는 student_profiles
     * 가 자동 생성됩니다.
     */

    return NextResponse.json({
      ok: true,
      userId: signupData.user.id,
      email: signupData.user.email ?? email,
      role,
      requiresEmailConfirmation:
        !signupData.user.email_confirmed_at,
    });
  } catch (error) {
    console.error("SIGNUP UNEXPECTED ERROR:", error);

    /*
     * 예상하지 못한 오류가 발생했는데
     * 이미 인증 토큰을 예약한 상태라면 복구를 시도합니다.
     */
    if (
      verificationId &&
      verificationReserved
    ) {
      try {
        const adminForRelease =
          createAdminClient();

        const { error: releaseError } =
          await adminForRelease
            .from("phone_verifications")
            .update({
              consumed_at: null,
              updated_at:
                new Date().toISOString(),
            })
            .eq("id", verificationId);

        if (releaseError) {
          console.error(
            "SIGNUP UNEXPECTED RELEASE ERROR:",
            releaseError
          );
        }
      } catch (releaseException) {
        console.error(
          "SIGNUP UNEXPECTED RELEASE EXCEPTION:",
          releaseException
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "회원가입 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}