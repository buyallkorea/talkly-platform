import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ success: false, error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    if (!accountId || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Zoom environment variables are missing." },
        { status: 500 }
      );
    }

    const credentials = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

    const response = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: response.status,
          error: "Zoom 연결 확인에 실패했습니다.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Zoom connection successful",
      token_type: data.token_type,
      expires_in: data.expires_in,
    });
  } catch (error) {
    console.error("Zoom connection test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Zoom connection test failed.",
      },
      { status: 500 }
    );
  }
}