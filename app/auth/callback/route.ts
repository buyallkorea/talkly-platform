import {
  NextResponse,
} from "next/server";
import { createClient } from "@/lib/supabase-server";

function getSafeNextPath(
  value: string | null
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  return value;
}

export async function GET(
  request: Request
) {
  const requestUrl =
    new URL(request.url);

  const code =
    requestUrl.searchParams.get(
      "code"
    );

  const next =
    getSafeNextPath(
      requestUrl.searchParams.get(
        "next"
      )
    );

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "The invitation link is invalid or has expired."
        )}`,
        requestUrl.origin
      )
    );
  }

  const supabase =
    await createClient();

  const {
    error,
  } =
    await supabase.auth
      .exchangeCodeForSession(
        code
      );

  if (error) {
    console.error(
      "AUTH CALLBACK EXCHANGE ERROR:",
      error
    );

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "The invitation link could not be verified. Please request a new invitation."
        )}`,
        requestUrl.origin
      )
    );
  }

  return NextResponse.redirect(
    new URL(
      next,
      requestUrl.origin
    )
  );
}