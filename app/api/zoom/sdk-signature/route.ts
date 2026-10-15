import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase-server";

type SignatureRequestBody = {
  meetingNumber: string;
  role: 0 | 1;
  sessionId: number;
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
    const sessionId = Number(body.sessionId);

    if (
      !Number.isSafeInteger(sessionId) ||
      sessionId <= 0 ||
      !/^\d+$/.test(meetingNumber)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "올바른 수업 ID와 회의 번호가 필요합니다.",
        },
        { status: 400 }
      );
    }

    // Zoom 호스트 인증은 /api/zoom/host-auth에서만 처리한다.
    // 이 API는 관리자, 강사, 학생, 학부모 모두에게
    // 참가자(role 0) 서명만 발급한다.
    if (role !== 0) {
      return NextResponse.json(
        {
          success: false,
          error: "이 API에서는 Zoom 참가자 서명만 발급할 수 있습니다.",
        },
        { status: 403 }
      );
    }

    const { data: session, error: sessionError } =
      await supabase
        .from("class_sessions")
        .select(`
          id,
          enrollment_id,
          meeting_id,
          meeting_provider,
          status,
          ended_at,
          teacher_user_id,
          is_external_teacher
        `)
        .eq("id", sessionId)
        .maybeSingle();

    if (
      sessionError ||
      !session ||
      session.meeting_provider !== "zoom" ||
      String(session.meeting_id ?? "").trim() !== meetingNumber
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "해당 수업의 Zoom 회의를 확인할 수 없습니다.",
        },
        { status: 403 }
      );
    }

    if (
      session.ended_at ||
      !["scheduled", "in_progress"].includes(session.status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "종료되었거나 입장할 수 없는 수업입니다.",
        },
        { status: 403 }
      );
    }

    const { data: enrollment, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select("id, child_id, student_user_id, teacher_user_id")
        .eq("id", session.enrollment_id)
        .maybeSingle();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        {
          success: false,
          error: "수강정보를 확인할 수 없습니다.",
        },
        { status: 403 }
      );
    }

    const assignedTeacherId =
      session.teacher_user_id ??
      enrollment.teacher_user_id;

    let allowed = false;

    if (profile.role === "admin") {
      allowed = true;
    } else if (profile.role === "teacher") {
      allowed =
        !session.is_external_teacher &&
        assignedTeacherId === user.id;
    } else if (profile.role === "student") {
      allowed = enrollment.student_user_id === user.id;
    } else if (
      profile.role === "parent" &&
      enrollment.child_id
    ) {
      const { data: child, error: childError } =
        await supabase
          .from("children")
          .select("id")
          .eq("id", enrollment.child_id)
          .eq("parent_user_id", user.id)
          .maybeSingle();

      allowed = !childError && Boolean(child);
    }

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "이 수업의 Zoom 서명 발급 권한이 없습니다.",
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
          error: "Zoom Meeting SDK 환경변수가 설정되지 않았습니다.",
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
      role: 0,
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
        error: "Meeting SDK 서명 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
