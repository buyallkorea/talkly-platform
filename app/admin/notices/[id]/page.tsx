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
  searchParams: Promise<{
    saved?: string;
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

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const content = String(
    formData.get("content") ?? ""
  ).trim();

  const isPinned =
    formData.get("is_pinned") ===
    "on";

  const isPublished =
    formData.get(
      "is_published"
    ) === "on";

  if (!title) {
    throw new Error(
      "공지사항 제목을 입력해주세요."
    );
  }

  if (!content) {
    throw new Error(
      "공지사항 내용을 입력해주세요."
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
}: PageProps) {
  const { id } =
    await params;

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

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
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
        maxWidth: "980px",
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
          marginTop: "20px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: "18px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display:
                "inline-flex",
              alignItems:
                "center",
              minHeight: "28px",
              padding: "0 10px",
              borderRadius:
                "999px",
              background:
                "#eef4ff",
              color: "#2f6fed",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing:
                "0.04em",
            }}
          >
            NOTICE DETAIL
          </div>

          <h1
            style={{
              margin: "14px 0 0",
              color: "#101828",
              fontSize: "34px",
              lineHeight: 1.2,
              letterSpacing:
                "-0.035em",
            }}
          >
            공지사항 수정
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "#667085",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            등록{" "}
            {new Date(
              notice.created_at
            ).toLocaleString(
              "ko-KR"
            )}
            {" · "}
            조회{" "}
            {notice.view_count ??
              0}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: "9px",
            flexWrap: "wrap",
          }}
        >
          <StatusBadge
            published={
              notice.is_published
            }
          />

          {notice.is_published && (
            <Link
              href={`/notice/${notice.id}`}
              style={{
                minHeight:
                  "42px",
                padding:
                  "0 14px",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                border:
                  "1px solid #d6deea",
                borderRadius:
                  "9px",
                background:
                  "#ffffff",
                color:
                  "#344054",
                textDecoration:
                  "none",
                fontSize:
                  "12px",
                fontWeight:
                  800,
              }}
            >
              사용자 화면 보기 ↗
            </Link>
          )}
        </div>
      </div>

      {query.saved === "1" && (
        <div
          style={{
            marginTop: "22px",
            padding:
              "14px 16px",
            border:
              "1px solid #abefc6",
            borderRadius:
              "10px",
            background:
              "#ecfdf3",
            color:
              "#027a48",
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
          display: "grid",
          gap: "20px",
        }}
      >
        <section
          style={{
            padding: "26px",
            border:
              "1px solid #e4e7ec",
            borderRadius:
              "16px",
            background:
              "#ffffff",
            boxShadow:
              "0 8px 24px rgba(10,31,68,.035)",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "19px",
            }}
          >
            공지 내용
          </h2>

          <p
            style={{
              margin: "7px 0 0",
              color: "#98a2b3",
              fontSize: "12px",
            }}
          >
            제목과 본문 내용을 수정할 수 있습니다.
          </p>

          <div
            style={{
              marginTop: "22px",
            }}
          >
            <label
              style={labelStyle}
            >
              제목 *
            </label>

            <input
              name="title"
              required
              maxLength={200}
              defaultValue={
                notice.title
              }
              style={inputStyle}
            />
          </div>

          <div
            style={{
              marginTop: "22px",
            }}
          >
            <label
              style={labelStyle}
            >
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
                minHeight:
                  "360px",
                resize:
                  "vertical",
                lineHeight:
                  1.85,
              }}
            />
          </div>
        </section>

        <section
          style={{
            padding:
              "24px 26px",
            border:
              "1px solid #e4e7ec",
            borderRadius:
              "16px",
            background:
              "#ffffff",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "19px",
            }}
          >
            노출 설정
          </h2>

          <p
            style={{
              margin: "7px 0 0",
              color: "#98a2b3",
              fontSize: "12px",
            }}
          >
            중요 공지와 공개 여부를 변경할 수 있습니다.
          </p>

          <div
            style={{
              marginTop: "20px",
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0,1fr))",
              gap: "14px",
            }}
          >
            <Toggle
              name="is_pinned"
              title="중요공지 / 상단 고정"
              description="공지사항 목록 상단에 우선 표시합니다."
              defaultChecked={
                notice.is_pinned
              }
            />

            <Toggle
              name="is_published"
              title="사용자에게 공개"
              description="OFF 상태에서는 관리자 화면에서만 확인할 수 있습니다."
              defaultChecked={
                notice.is_published
              }
            />
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/admin/notices"
            style={
              secondaryButtonStyle
            }
          >
            ← 목록으로 돌아가기
          </Link>

          <button
            type="submit"
            style={
              primaryButtonStyle
            }
          >
            변경사항 저장
          </button>
        </div>
      </form>

      <section
        style={{
          marginTop: "28px",
          padding: "22px",
          border:
            "1px solid #fecdca",
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
          공지사항 삭제
        </h2>

        <p
          style={{
            margin:
              "8px 0 16px",
            color: "#667085",
            fontSize: "13px",
            lineHeight: 1.7,
          }}
        >
          삭제한 공지사항은
          복구할 수 없습니다.
          정말 필요할 때만
          삭제해주세요.
        </p>

        <form
          action={deleteAction}
        >
          <button
            type="submit"
            style={{
              minHeight:
                "42px",
              padding:
                "0 15px",
              border:
                "1px solid #fda29b",
              borderRadius:
                "9px",
              background:
                "#ffffff",
              color:
                "#b42318",
              fontWeight:
                900,
              cursor:
                "pointer",
            }}
          >
            공지사항 삭제
          </button>
        </form>
      </section>
    </main>
  );
}

function StatusBadge({
  published,
}: {
  published: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        minHeight: "30px",
        padding: "0 10px",
        alignItems: "center",
        borderRadius: "999px",
        background:
          published
            ? "#ecfdf3"
            : "#f2f4f7",
        color:
          published
            ? "#027a48"
            : "#667085",
        fontSize: "11px",
        fontWeight: 900,
      }}
    >
      {published
        ? "공개"
        : "비공개"}
    </span>
  );
}

function Toggle({
  name,
  title,
  description,
  defaultChecked,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      style={{
        padding: "18px",
        display: "flex",
        alignItems:
          "flex-start",
        gap: "12px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "12px",
        background:
          "#fbfcfe",
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
          marginTop: "1px",
          accentColor:
            "#2f6fed",
          flexShrink: 0,
        }}
      />

      <div>
        <div
          style={{
            color:
              "#101828",
            fontSize:
              "14px",
            fontWeight:
              900,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop:
              "6px",
            color:
              "#667085",
            fontSize:
              "12px",
            lineHeight:
              1.6,
          }}
        >
          {description}
        </div>
      </div>
    </label>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#344054",
  fontSize: "13px",
  fontWeight: 900,
};

const inputStyle = {
  width: "100%",
  boxSizing:
    "border-box" as const,
  padding: "13px 14px",
  border:
    "1px solid #d6deea",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
};

const primaryButtonStyle = {
  minHeight: "48px",
  padding: "0 22px",
  border: "none",
  borderRadius: "10px",
  background: "#0A1F44",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 8px 20px rgba(10,31,68,.14)",
};

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border:
    "1px solid #d6deea",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};