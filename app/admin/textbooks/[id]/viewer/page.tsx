import Link from "next/link";
import { signStoragePaths } from "@/lib/storage-signing";
import { getCurrentUser } from "@/lib/server-user";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TextbookViewerClient from "./TextbookViewerClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TextbookViewerPage({
  params,
}: PageProps) {
  const { id } = await params;
  const textbookId = Number(id);

  if (!Number.isInteger(textbookId) || textbookId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const { data: textbook, error: textbookError } =
    await supabase
      .from("textbooks")
      .select("id, title, page_count, status")
      .eq("id", textbookId)
      .maybeSingle();

  if (textbookError) {
    throw new Error(textbookError.message);
  }

  if (!textbook) {
    notFound();
  }

  const { data: pages, error: pagesError } =
    await supabase
      .from("textbook_pages")
      .select("id, page_number, page_image_url")
      .eq("textbook_id", textbookId)
      .order("page_number", { ascending: true });

  if (pagesError) {
    throw new Error(pagesError.message);
  }

  if (!pages || pages.length === 0) {
    return (
      <section className="talkly-card" aria-labelledby="textbook-empty-title" style={{ maxWidth: 840, margin: "12px auto", padding: "30px", background: "#ffffff" }}>
        <span className="talkly-badge talkly-badge-blue">TALKLY · 교재 관리</span>
        <h1 id="textbook-empty-title" className="talkly-dashboard-title" style={{ marginTop: 16, fontSize: 27, overflowWrap: "anywhere" }}>{textbook.title}</h1>
        <div style={{ marginTop: 22, padding: "22px", borderRadius: 12, border: "1px dashed #cbd9ef", background: "#f6f9ff" }}>
          <h2 style={{ margin: 0, color: "#0a1f44", fontWeight: 850, fontSize: 18 }}>교재 페이지 준비 중</h2>
          <p style={{ margin: "8px 0 0", color: "#667085", fontSize: 14, lineHeight: 1.8 }}>아직 생성된 교재 페이지가 없습니다. 페이지를 등록한 후 이 화면에서 확인할 수 있습니다.</p>
        </div>
        <Link className="talkly-button talkly-button-primary" href={"/admin/textbooks/" + textbook.id} style={{ marginTop: 22 }}>교재 상세로 돌아가기 →</Link>
      </section>
    );
  }

  const urls = await signStoragePaths(supabase, "textbook-pages", pages.map(page => page.page_image_url));
  const signedPages = pages.map(page => {
    const imageUrl = urls.get(page.page_image_url);
    if (!imageUrl) throw new Error(`${page.page_number}페이지 이미지를 불러오지 못했습니다.`);
    return { id: page.id, pageNumber: page.page_number, imageUrl };
  });

  return (
    <TextbookViewerClient
      textbookId={textbook.id}
      title={textbook.title}
      status={textbook.status}
      pages={signedPages}
    />
  );
}