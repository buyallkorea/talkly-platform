import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import {
  revalidatePath,
} from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function createNotice(
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

  const {
    data: notice,
    error,
  } = await supabase
    .from("notices")
    .insert({
      title,
      content,
      is_pinned: isPinned,
      is_published:
        isPublished,
      created_by: user.id,
      updated_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (
    error ||
    !notice
  ) {
    throw new Error(
      error?.message ||
        "공지사항 등록에 실패했습니다."
    );
  }

  revalidatePath("/notice");
  revalidatePath(
    "/admin/notices"
  );

  redirect(
    `/admin/notices/${notice.id}`
  );
}

export default async function NewNoticePage() {
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

      <h1
        style={{
          margin: "18px 0 0",
          color: "#101828",
          fontSize: "32px",
        }}
      >
        새 공지 작성
      </h1>

      <p
        style={{
          margin: "9px 0 0",
          color: "#667085",
        }}
      >
        TALKLY 이용자에게 공개할 공지사항을
        작성합니다.
      </p>

      <form
        action={createNotice}
        style={{
          marginTop: "28px",
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
            maxLength={200}
            style={inputStyle}
            placeholder="공지사항 제목"
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
            style={{
              ...inputStyle,
              resize: "vertical",
              lineHeight: 1.7,
            }}
            placeholder="공지 내용을 입력하세요."
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
            description="공지사항 목록 상단에 우선 표시합니다."
          />

          <Toggle
            name="is_published"
            title="즉시 공개"
            description="체크하면 사용자 공지사항에 바로 공개됩니다."
            defaultChecked
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
            취소
          </Link>

          <button
            type="submit"
            style={primaryButtonStyle}
          >
            공지 등록
          </button>
        </div>
      </form>
    </main>
  );
}

function Toggle({
  name,
  title,
  description,
  defaultChecked = false,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      style={{
        padding: "16px",
        display: "flex",
        gap: "12px",
        border: "1px solid #e4e7ec",
        borderRadius: "11px",
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

      <div>
        <div
          style={{
            color: "#101828",
            fontSize: "14px",
            fontWeight: 800,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: "5px",
            color: "#667085",
            fontSize: "12px",
            lineHeight: 1.6,
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