import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const tokenHash =
      typeof body.token_hash === "string"
        ? body.token_hash.trim()
        : "";

    if (!tokenHash) {
      return NextResponse.json(
        { error: "Invalid invitation link." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    });

    if (error || !data.user) {
      console.error("TEACHER INVITE VERIFY ERROR:", error);

      return NextResponse.json(
        {
          error:
            "This invitation link is invalid or has expired. Please contact TALKLY support.",
        },
        { status: 400 }
      );
    }

    // Verify that the invitation belongs to a teacher.
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

    if (profileError || profile?.role !== "teacher") {
      return NextResponse.json(
        { error: "This invitation is not for a teacher account." },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("TEACHER INVITE ERROR:", error);

    return NextResponse.json(
      { error: "Unable to process the invitation." },
      { status: 500 }
    );
  }
}