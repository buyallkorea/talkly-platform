import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import ClassroomTextbookPanelClient from "./ClassroomTextbookPanelClient";

type Props = {
  textbookId: number;
  sessionId: number;
  enrollmentId: number;
  viewerRole: string;
  testStudentMode?: boolean;
};

type HotspotRow = {
  id: number;
  page_id: number;
  type: string;
  label: string | null;
  x_percent: number | string;
  y_percent: number | string;
  width_percent: number | string;
  height_percent: number | string;
  audio_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export default async function ClassroomTextbookPanel({
  textbookId,
  sessionId,
  enrollmentId,
  viewerRole,
  testStudentMode = false,
}: Props) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return <div style={{ padding: "24px", color: "#fff" }}>교재 서버 환경변수가 설정되지 않았습니다.</div>;
  }

  const adminSupabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: textbook, error: textbookError } = await adminSupabase
    .from("textbooks").select("id, title, page_count, status")
    .eq("id", textbookId).maybeSingle();

  if (textbookError || !textbook) {
    return <div style={{ padding: "24px", color: "#fff" }}>교재를 불러오지 못했습니다.</div>;
  }

  const { data: pageRows, error: pagesError } = await adminSupabase
    .from("textbook_pages").select("id, page_number, page_image_url")
    .eq("textbook_id", textbookId).order("page_number", { ascending: true });

  if (pagesError || !pageRows || pageRows.length === 0) {
    return <div style={{ padding: "24px", color: "#fff" }}>아직 준비된 교재 페이지가 없습니다.</div>;
  }

  const pageIds = pageRows.map((page) => page.id);
  const { data: hotspotRows, error: hotspotsError } = await adminSupabase
    .from("textbook_hotspots")
    .select(`id, page_id, type, label, x_percent, y_percent, width_percent,
      height_percent, audio_url, sort_order, is_active`)
    .in("page_id", pageIds).eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (hotspotsError) {
    return <div style={{ padding: "24px", color: "#fff" }}>교재 핫스팟을 불러오지 못했습니다.</div>;
  }

  const pages = await Promise.all(pageRows.map(async (page) => {
    const { data: signedPage, error: signedPageError } = await adminSupabase.storage
      .from("textbook-pages").createSignedUrl(page.page_image_url, 60 * 60);
    if (signedPageError || !signedPage?.signedUrl) {
      throw new Error(`${page.page_number}페이지 이미지를 불러오지 못했습니다.`);
    }

    const pageHotspots = ((hotspotRows ?? []) as HotspotRow[]).filter(
      (hotspot) => hotspot.page_id === page.id && hotspot.type === "audio" && hotspot.audio_url
    );
    const hotspots = await Promise.all(pageHotspots.map(async (hotspot) => {
      const { data: signedAudio, error: signedAudioError } = await adminSupabase.storage
        .from("textbook-audio").createSignedUrl(hotspot.audio_url as string, 60 * 60);
      if (signedAudioError || !signedAudio?.signedUrl) return null;
      return {
        id: hotspot.id,
        label: hotspot.label || "듣기",
        xPercent: Number(hotspot.x_percent),
        yPercent: Number(hotspot.y_percent),
        widthPercent: Number(hotspot.width_percent),
        heightPercent: Number(hotspot.height_percent),
        audioUrl: signedAudio.signedUrl,
      };
    }));
    return {
      id: page.id,
      pageNumber: page.page_number,
      imageUrl: signedPage.signedUrl,
      hotspots: hotspots.filter((hotspot): hotspot is NonNullable<typeof hotspot> => Boolean(hotspot)),
    };
  }));

  const { data: progress, error: progressError } = await adminSupabase
    .from("enrollment_textbooks").select("last_page_id, last_page_number")
    .eq("enrollment_id", enrollmentId).eq("textbook_id", textbookId)
    .in("status", ["assigned", "in_use"]).is("ended_at", null)
    .order("assigned_at", { ascending: false }).limit(1).maybeSingle();

  if (progressError) console.error("[TALKLY TEXTBOOK] progress load failed", progressError.message);

  const savedPageIndexById = progress?.last_page_id != null
    ? pages.findIndex((page) => page.id === progress.last_page_id) : -1;
  const savedPageIndexByNumber = progress?.last_page_number != null
    ? pages.findIndex((page) => page.pageNumber === progress.last_page_number) : -1;
  const initialPageIndex = savedPageIndexById >= 0
    ? savedPageIndexById : savedPageIndexByNumber >= 0 ? savedPageIndexByNumber : 0;

  return <ClassroomTextbookPanelClient
    title={textbook.title}
    pages={pages}
    textbookId={textbookId}
    sessionId={sessionId}
    enrollmentId={enrollmentId}
    initialPageIndex={initialPageIndex}
    viewerRole={viewerRole}
    testStudentMode={testStudentMode}
  />;
}
