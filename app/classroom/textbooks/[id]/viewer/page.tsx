import { signStoragePaths } from "@/lib/storage-signing";
import { getCurrentUser } from "@/lib/server-user";
import { notFound, redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import ClassroomTextbookViewerClient from "./ClassroomTextbookViewerClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
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

export default async function ClassroomTextbookViewerPage({
  params,
}: PageProps) {
  const { id } = await params;
  const textbookId = Number(id);

  if (!Number.isInteger(textbookId) || textbookId <= 0) {
    notFound();
  }

  // 1. TALKLY 로그인 확인
  const supabase = await createClient();

  const {
    data: { user },
  } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/");
  }

  const allowedRoles = ["admin", "teacher", "student", "parent"];

  if (!allowedRoles.includes(profile.role)) {
    redirect("/");
  }

  // 2. 교재 페이지/핫스팟은 서버에서만 service role로 조회
  //    브라우저에는 service role key가 절대 전달되지 않습니다.
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase 서버 환경변수가 설정되지 않았습니다."
    );
  }

  const adminSupabase = createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data: textbook,
    error: textbookError,
  } = await adminSupabase
    .from("textbooks")
    .select(`
      id,
      title,
      description,
      page_count,
      status
    `)
    .eq("id", textbookId)
    .maybeSingle();

  if (textbookError) {
    throw new Error(textbookError.message);
  }

  if (!textbook) {
    notFound();
  }

  const {
    data: pageRows,
    error: pagesError,
  } = await adminSupabase
    .from("textbook_pages")
    .select(`
      id,
      page_number,
      page_image_url
    `)
    .eq("textbook_id", textbookId)
    .order("page_number", {
      ascending: true,
    });

  if (pagesError) {
    throw new Error(pagesError.message);
  }

  if (!pageRows || pageRows.length === 0) {
    return (
      <main style={{ padding: 40 }}>
        <h1>{textbook.title}</h1>
        <p>아직 수업용 교재 페이지가 준비되지 않았습니다.</p>
      </main>
    );
  }

  const pageIds = pageRows.map((page) => page.id);

  const {
    data: hotspotRows,
    error: hotspotsError,
  } = await adminSupabase
    .from("textbook_hotspots")
    .select(`
      id,
      page_id,
      type,
      label,
      x_percent,
      y_percent,
      width_percent,
      height_percent,
      audio_url,
      sort_order,
      is_active
    `)
    .in("page_id", pageIds)
    .eq("is_active", true)
    .order("sort_order", {
      ascending: true,
    });

  if (hotspotsError) {
    throw new Error(hotspotsError.message);
  }

  const audioHotspots = ((hotspotRows ?? []) as HotspotRow[]).filter(h => h.type === "audio" && h.audio_url);
  const [pageUrls, audioUrls] = await Promise.all([
    signStoragePaths(adminSupabase, "textbook-pages", pageRows.map(page => page.page_image_url)),
    signStoragePaths(adminSupabase, "textbook-audio", audioHotspots.map(h => h.audio_url as string)).catch(error => {
      console.error("[TALKLY TEXTBOOK] audio signing failed", error);
      return new Map<string, string>();
    }),
  ]);
  const hotspotsByPage = new Map<number, typeof audioHotspots>();
  for (const hotspot of audioHotspots) {
    const list = hotspotsByPage.get(hotspot.page_id) ?? [];
    list.push(hotspot); hotspotsByPage.set(hotspot.page_id, list);
  }
  const signedPages = pageRows.map(page => {
    const imageUrl = pageUrls.get(page.page_image_url);
    if (!imageUrl) throw new Error(`${page.page_number}페이지 이미지를 불러오지 못했습니다.`);
    return {
      id: page.id, pageNumber: page.page_number, imageUrl,
      hotspots: (hotspotsByPage.get(page.id) ?? []).flatMap(h => {
        const audioUrl = audioUrls.get(h.audio_url as string);
        return audioUrl ? [{ id: h.id, label: h.label || "듣기", xPercent: Number(h.x_percent), yPercent: Number(h.y_percent), widthPercent: Number(h.width_percent), heightPercent: Number(h.height_percent), audioUrl }] : [];
      }),
    };
  });

  return (
    <ClassroomTextbookViewerClient
      textbookId={textbook.id}
      title={textbook.title}
      pages={signedPages}
      viewerRole={profile.role}
      viewerName={
        profile.name || ""
      }
    />
  );
}