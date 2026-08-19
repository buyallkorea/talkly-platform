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
  } = await supabase.auth.getUser();

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

  const signedPages = await Promise.all(
    pageRows.map(async (page) => {
      const {
        data: signedPage,
        error: signedPageError,
      } = await adminSupabase.storage
        .from("textbook-pages")
        .createSignedUrl(
          page.page_image_url,
          60 * 60
        );

      if (
        signedPageError ||
        !signedPage?.signedUrl
      ) {
        throw new Error(
          `${page.page_number}페이지 이미지를 불러오지 못했습니다.`
        );
      }

      const pageHotspots = (
        (hotspotRows ?? []) as HotspotRow[]
      ).filter(
        (hotspot) =>
          hotspot.page_id === page.id &&
          hotspot.type === "audio" &&
          hotspot.audio_url
      );

      const hotspots = await Promise.all(
        pageHotspots.map(
          async (hotspot) => {
            const {
              data: signedAudio,
              error: signedAudioError,
            } =
              await adminSupabase.storage
                .from("textbook-audio")
                .createSignedUrl(
                  hotspot.audio_url as string,
                  60 * 60
                );

            if (
              signedAudioError ||
              !signedAudio?.signedUrl
            ) {
              return null;
            }

            return {
              id: hotspot.id,
              label:
                hotspot.label ||
                "듣기",
              xPercent: Number(
                hotspot.x_percent
              ),
              yPercent: Number(
                hotspot.y_percent
              ),
              widthPercent: Number(
                hotspot.width_percent
              ),
              heightPercent: Number(
                hotspot.height_percent
              ),
              audioUrl:
                signedAudio.signedUrl,
            };
          }
        )
      );

      return {
        id: page.id,
        pageNumber:
          page.page_number,
        imageUrl:
          signedPage.signedUrl,
        hotspots: hotspots.filter(
          (
            hotspot
          ): hotspot is NonNullable<
            typeof hotspot
          > => Boolean(hotspot)
        ),
      };
    })
  );

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