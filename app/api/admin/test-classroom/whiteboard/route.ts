
import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { verifyTestStudentMode } from "@/lib/test-classroom-mode";

export const runtime = "nodejs";

type Point = {
  x: number;
  y: number;
};

type Stroke = {
  id: string;
  pageId: number;
  kind: "pen" | "highlighter" | "line";
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  authorId: string;
  createdAt: number;
};

const MAX_BODY_BYTES = 512 * 1024;
const MAX_STROKES = 500;
const MAX_POINTS_PER_STROKE = 3000;
const MAX_TOTAL_POINTS = 20000;

function positiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function validNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function validateStrokes(
  value: unknown,
  pageId: number,
  userId: string
): value is Stroke[] {
  if (!Array.isArray(value) || value.length > MAX_STROKES) {
    return false;
  }

  let totalPoints = 0;
  const ids = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return false;
    }

    const stroke = item as Record<string, unknown>;

    if (
      typeof stroke.id !== "string" ||
      stroke.id.length < 1 ||
      stroke.id.length > 150 ||
      ids.has(stroke.id)
    ) {
      return false;
    }

    ids.add(stroke.id);

    if (
      stroke.pageId !== pageId ||
      !["pen", "highlighter", "line"].includes(
        String(stroke.kind)
      )
    ) {
      return false;
    }

    if (
      typeof stroke.color !== "string" ||
      !/^#[0-9a-fA-F]{3,8}$/.test(stroke.color)
    ) {
      return false;
    }

    if (
      !validNumber(stroke.width) ||
      stroke.width <= 0 ||
      stroke.width > 100 ||
      !validNumber(stroke.opacity) ||
      stroke.opacity < 0 ||
      stroke.opacity > 1
    ) {
      return false;
    }

    if (
      typeof stroke.authorId !== "string" ||
      stroke.authorId.length < 1 ||
      stroke.authorId.length > 150 ||
      !validNumber(stroke.createdAt) ||
      stroke.createdAt < 0
    ) {
      return false;
    }

    // 다른 참여자가 작성한 기존 필기도
    // 전체 페이지 스냅샷에 포함될 수 있습니다.
    // 따라서 authorId가 현재 사용자와 달라도 허용합니다.
    void userId;

    if (
      !Array.isArray(stroke.points) ||
      stroke.points.length < 1 ||
      stroke.points.length > MAX_POINTS_PER_STROKE
    ) {
      return false;
    }

    totalPoints += stroke.points.length;

    if (totalPoints > MAX_TOTAL_POINTS) {
      return false;
    }

    for (const point of stroke.points) {
      if (
        !point ||
        typeof point !== "object" ||
        Array.isArray(point)
      ) {
        return false;
      }

      const p = point as Record<string, unknown>;

      if (
  !validNumber(p.x) ||
  !validNumber(p.y) ||
  p.x < 0 ||
  p.x > 100 ||
  p.y < 0 ||
  p.y > 100
) {
  return false;
}
    }
  }

  return true;
}

export async function POST(request: Request) {
  try {
    if (
      process.env.TALKLY_ENABLE_TEST_CLASSROOM !== "true"
    ) {
      return NextResponse.json(
        { error: "Test classroom is disabled." },
        { status: 403 }
      );
    }

    const origin = request.headers.get("origin");

    if (
      !origin ||
      origin !== new URL(request.url).origin
    ) {
      return NextResponse.json(
        { error: "Invalid origin." },
        { status: 403 }
      );
    }

    const contentLength = Number(
      request.headers.get("content-length") ?? "0"
    );

    if (
      !Number.isFinite(contentLength) ||
      contentLength > MAX_BODY_BYTES
    ) {
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 }
      );
    }

    const raw = await request.text();

    if (
      Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES
    ) {
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 }
      );
    }

    let body: Record<string, unknown>;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("Invalid JSON object");
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON." },
        { status: 400 }
      );
    }

    const {
      sessionId,
      textbookId,
      pageId,
      pageNumber,
      strokes,
    } = body;

    if (
      !positiveInteger(sessionId) ||
      !positiveInteger(textbookId) ||
      !positiveInteger(pageId) ||
      !positiveInteger(pageNumber)
    ) {
      return NextResponse.json(
        { error: "Invalid identifiers." },
        { status: 400 }
      );
    }

    const verified = await verifyTestStudentMode(
      sessionId
    );

    if (!verified) {
      return NextResponse.json(
        { error: "Test student authorization failed." },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    if (!validateStrokes(strokes, pageId, user.id)) {
      return NextResponse.json(
        { error: "Invalid whiteboard strokes." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error(
        "[TEST WHITEBOARD] Supabase configuration missing"
      );

      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const admin = createSupabaseAdmin(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: session,
      error: sessionError,
    } = await admin
      .from("class_sessions")
      .select(
        "enrollment_id,is_test,status,ended_at,selected_textbook_id"
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (
      sessionError ||
      !session ||
      session.is_test !== true ||
      session.status !== "in_progress" ||
      session.ended_at !== null ||
      session.selected_textbook_id !== textbookId
    ) {
      return NextResponse.json(
        { error: "Test session is not writable." },
        { status: 403 }
      );
    }

    const {
      data: enrollment,
      error: enrollmentError,
    } = await admin
      .from("enrollments")
      .select("is_test")
      .eq("id", session.enrollment_id)
      .maybeSingle();

    if (
      enrollmentError ||
      enrollment?.is_test !== true
    ) {
      return NextResponse.json(
        { error: "Invalid test enrollment." },
        { status: 403 }
      );
    }

    const {
      data: page,
      error: pageError,
    } = await admin
      .from("textbook_pages")
      .select("id")
      .eq("id", pageId)
      .eq("textbook_id", textbookId)
      .eq("page_number", pageNumber)
      .maybeSingle();

    if (pageError || !page) {
      return NextResponse.json(
        { error: "Invalid textbook page." },
        { status: 400 }
      );
    }

    const {
      error: saveError,
    } = await admin
      .from("classroom_whiteboard_states")
      .upsert(
        {
          session_id: sessionId,
          textbook_id: textbookId,
          page_number: pageNumber,
          strokes,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            "session_id,textbook_id,page_number",
        }
      );

    if (saveError) {
      console.error(
        "[TEST WHITEBOARD] Save failed:",
        saveError
      );

      return NextResponse.json(
        { error: "Whiteboard save failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
      textbookId,
      pageNumber,
    });
  } catch (error) {
    console.error(
      "[TEST WHITEBOARD] Unexpected error:",
      error
    );

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
