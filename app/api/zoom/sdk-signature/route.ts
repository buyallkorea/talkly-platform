import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase-server";

type SignatureRequestBody = {
  meetingNumber: string;
  role: 0 | 1;
};

function base64UrlEncode(input: Buffer | string) {
  const value =
    typeof input === "string" ? Buffer.from(input) : input;

  return value
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자 권한을 확인할 수 없습니다.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as SignatureRequestBody;

    const meetingNumber = String(
      body.meetingNumber || ""
    ).trim();
    const role = Number(body.role);

    if (!meetingNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Meeting Number가 필요합니다.",
        },
        { status: 400 }
      );
    }

    if (role !== 0 && role !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 Meeting SDK role 값이 아닙니다.",
        },
        { status: 400 }
      );
    }

    if (
      role === 1 &&
      profile.role !== "teacher" &&
      profile.role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "호스트 권한은 강사 또는 관리자만 사용할 수 있습니다.",
        },
        { status: 403 }
      );
    }

    const sdkKey =
      process.env.NEXT_PUBLIC_ZOOM_MEETING_SDK_CLIENT_ID;
    const sdkSecret =
      process.env.ZOOM_MEETING_SDK_CLIENT_SECRET;

    if (!sdkKey || !sdkSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Zoom Meeting SDK 환경변수가 설정되지 않았습니다.",
        },
        { status: 500 }
      );
    }

    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;

    const header = {
      alg: "HS256",
      typ: "JWT",
    };

    const payload = {
      sdkKey,
      mn: meetingNumber,
      role,
      iat,
      exp,
      appKey: sdkKey,
      tokenExp: exp,
    };

    const unsignedToken = `${base64UrlEncode(
      JSON.stringify(header)
    )}.${base64UrlEncode(JSON.stringify(payload))}`;

    const signature = crypto
      .createHmac("sha256", sdkSecret)
      .update(unsignedToken)
      .digest();

    const token = `${unsignedToken}.${base64UrlEncode(
      signature
    )}`;

    return NextResponse.json({
      success: true,
      signature: token,
      sdkKey,
    });
  } catch (error) {
    console.error("ZOOM SDK SIGNATURE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Meeting SDK 서명 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}