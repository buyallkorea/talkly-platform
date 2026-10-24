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
      <main style={{ padding: 40 }}>
        <h1>{textbook.title}</h1>
        <p>아직 생성된 교재 페이지가 없습니다.</p>
      </main>
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