import { NextResponse } from "next/server";

export async function GET() {
  try {
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
          error: data,
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