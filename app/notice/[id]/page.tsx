import Link from "next/link";
import {
  notFound,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NoticeDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const noticeId = Number(id);

  if (
    !Number.isInteger(
      noticeId
    ) ||
    noticeId <= 0
  ) {
    notFound();
  }

  const supabase =
    await createClient();

  const {
    data: notice,
    error,
  } = await supabase
    .from("notices")
    .select(`
      id,
      title,
      content,
      is_pinned,
      is_published,
      view_count,
      created_at,
      updated_at
    `)
    .eq("id", noticeId)
    .eq(
      "is_published",
      true
    )
    .maybeSingle();

  if (
    error ||
    !notice
  ) {
    notFound();
  }

  /*
   * 조회수 증가
   *
   * 조회수 실패는
   * 페이지 표시를 막지 않습니다.
   */
  await supabase
    .from("notices")
    .update({
      view_count:
        Number(
          notice.view_count ??
            0
        ) + 1,
    })
    .eq("id", noticeId);

  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding:
          "56px 24px 90px",
      }}
    >
      <Link
        href="/notice"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        ← 공지사항
      </Link>

      <article
        style={{
          marginTop: "24px",
          padding: "32px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "18px",
          background: "#ffffff",
        }}
      >
        {notice.is_pinned && (
          <div
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              minHeight: "28px",
              padding:
                "0 10px",
              borderRadius:
                "999px",
              background:
                "#eef4ff",
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
            }}
          >
            중요 공지
          </div>
        )}

        <h1
          style={{
            margin:
              notice.is_pinned
                ? "16px 0 0"
                : 0,
            fontSize: "32px",
            lineHeight: 1.35,
            letterSpacing:
              "-0.03em",
            color: "#0A1F44",
          }}
        >
          {notice.title}
        </h1>

        <div
          style={{
            marginTop: "18px",
            paddingBottom:
              "20px",
            borderBottom:
              "1px solid #eef1f5",
            display: "flex",
            gap: "18px",
            flexWrap: "wrap",
            color: "#98a2b3",
            fontSize: "12px",
          }}
        >
          <span>
            {new Date(
              notice.created_at
            ).toLocaleString(
              "ko-KR"
            )}
          </span>

          <span>
            조회{" "}
            {Number(
              notice.view_count ??
                0
            ) + 1}
          </span>
        </div>

        <div
          style={{
            marginTop: "28px",
            color: "#344054",
            fontSize: "15px",
            lineHeight: 1.9,
            whiteSpace:
              "pre-wrap",
            wordBreak:
              "break-word",
          }}
        >
          {notice.content}
        </div>
      </article>

      <div
        style={{
          marginTop: "22px",
          display: "flex",
          justifyContent:
            "center",
        }}
      >
        <Link
          href="/notice"
          style={{
            minHeight: "44px",
            padding: "0 18px",
            display:
              "inline-flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            border:
              "1px solid #d6deea",
            borderRadius:
              "10px",
            color: "#101828",
            background:
              "#ffffff",
            textDecoration:
              "none",
            fontWeight: 800,
            fontSize: "14px",
          }}
        >
          목록으로
        </Link>
      </div>
    </main>
  );
}