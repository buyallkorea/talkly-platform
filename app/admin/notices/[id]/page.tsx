import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import {
  revalidatePath,
} from "next/cache";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function updateNotice(
  noticeId: number,
  formData: FormData
) {
  "use server";

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  const title =
    String(
      formData.get("title") ??
        ""
    ).trim();

  const content =
    String(
      formData.get("content") ??
        ""
    ).trim();

  const isPinned =
    formData.get("is_pinned") ===
    "on";

  const isPublished =
    formData.get(
      "is_published"
    ) === "on";

  if (!title || !content) {
    throw new Error(
      "제목과 내용을 입력해주세요."
    );
  }

  const { error } =
    await supabase
      .from("notices")
      .update({
        title,
        content,
        is_pinned: isPinned,
        is_published:
          isPublished,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", noticeId);

  if (error) {
    throw new Error(
      error.message
    );
  }

  revalidatePath("/notice");
  revalidatePath(
    `/notice/${noticeId}`
  );
  revalidatePath(
    "/admin/notices"
  );
  revalidatePath(
    `/admin/notices/${noticeId}`
  );

  redirect(
    `/admin/notices/${noticeId}?saved=1`
  );
}

async function deleteNotice(
  noticeId: number
) {
  "use server";

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

  const { error } =
    await supabase
      .from("notices")
      .delete()
      .eq("id", noticeId);

  if (error) {
    throw new Error(
      error.message
    );
  }

  revalidatePath("/notice");
  revalidatePath(
    "/admin/notices"
  );

  redirect(
    "/admin/notices"
  );
}

export default async function AdminNoticeDetailPage({
  params,
  searchParams,
}: PageProps & {
  searchParams: Promise<{
    saved?: string;
  }>;
}) {
  const { id } = await params;
  const query =
    await searchParams;

  const noticeId =
    Number(id);

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
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    !profile ||
    profile.role !== "admin"
  ) {
    redirect("/");
  }

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
    .maybeSingle();

  if (
    error ||
    !notice
  ) {
    notFound();
  }

  const updateAction =
    updateNotice.bind(
      null,
      noticeId
    );

  const deleteAction =
    deleteNotice.bind(
      null,
      noticeId
    );

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "950px",
        margin: "0 auto",
      }}
    >
      <Link
        href="/admin/notices"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        ← 공지사항 관리
      </Link>

      <div
        style={{
          marginTop: "18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "18px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              color: "#101828",
            }}
          >
            공지사항 수정
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              color: "#667085",
              fontSize: "13px",
            }}
          >
            조회 {notice.view_count ?? 0} ·{" "}
            {new Date(
              notice.created_at
            ).toLocaleString(
              "ko-KR"
            )}
          </p>
        </div>

        {notice.is_published && (
          <Link
            href={`/notice/${notice.id}`}
            style={{
              minHeight: "40px",
              padding: "0 13px",
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid #d6deea",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#101828",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            사용자 화면 보기 →
          </Link>
        )}
      </div>

      {query.saved === "1" && (
        <div
          style={{
            marginTop: "20px",
            padding: "13px 15px",
            border: "1px solid #abefc6",
            borderRadius: "10px",
            background: "#ecfdf3",
            color: "#027a48",
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          공지사항이 저장되었습니다.
        </div>
      )}

      <form
        action={updateAction}
        style={{
          marginTop: "24px",
          padding: "26px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
          display: "grid",
          gap: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>
            제목 *
          </label>

          <input
            name="title"
            required
            defaultValue={
              notice.title
            }
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>
            내용 *
          </label>

          <textarea
            name="content"
            required
            rows={16}
            defaultValue={
              notice.content
            }
            style={{
              ...inputStyle,
              resize: "vertical",
              lineHeight: 1.7,
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          <Toggle
            name="is_pinned"
            title="중요공지 / 상단 고정"
            defaultChecked={
              notice.is_pinned
            }
          />

          <Toggle
            name="is_published"
            title="사용자에게 공개"
            defaultChecked={
              notice.is_published
            }
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <Link
            href="/admin/notices"
            style={secondaryButtonStyle}
          >
            목록
          </Link>

          <button
            type="submit"
            style={primaryButtonStyle}
          >
            변경사항 저장
          </button>
        </div>
      </form>

      <section
        style={{
          marginTop: "20px",
          padding: "22px",
          border: "1px solid #fecdca",
          borderRadius: "14px",
          background: "#fffafa",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#b42318",
            fontSize: "17px",
          }}
        >
          공지 삭제
        </h2>

        <p
          style={{
            margin: "8px 0 16px",
            color: "#667085",
            fontSize: "13px",
          }}
        >
          삭제한 공지사항은 복구할 수 없습니다.
        </p>

        <form action={deleteAction}>
          <button
            type="submit"
            style={{
              minHeight: "40px",
              padding: "0 14px",
              border: "1px solid #fda29b",
              borderRadius: "8px",
              background: "#ffffff",
              color: "#b42318",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            공지사항 삭제
          </button>
        </form>
      </section>
    </main>
  );
}

function Toggle({
  name,
  title,
  defaultChecked,
}: {
  name: string;
  title: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      style={{
        padding: "15px",
        display: "flex",
        alignItems: "center",
        gap: "11px",
        border: "1px solid #e4e7ec",
        borderRadius: "10px",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={
          defaultChecked
        }
        style={{
          width: "18px",
          height: "18px",
          accentColor: "#2f6fed",
        }}
      />

      <strong
        style={{
          color: "#101828",
          fontSize: "13px",
        }}
      >
        {title}
      </strong>
    </label>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: 800,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "12px 14px",
  border: "1px solid #d6deea",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
};

const primaryButtonStyle = {
  minHeight: "46px",
  padding: "0 20px",
  border: "none",
  borderRadius: "10px",
  background: "#0A1F44",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 20px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d6deea",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#101828",
  textDecoration: "none",
  fontWeight: 800,
};