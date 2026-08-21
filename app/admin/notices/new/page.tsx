import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function createNotice(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const content = String(
    formData.get("content") ?? ""
  ).trim();

  const isPinned =
    formData.get("is_pinned") === "on";

  const isPublished =
    formData.get("is_published") === "on";

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
      is_published: isPublished,
      created_by: user.id,
      updated_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !notice) {
    throw new Error(
      error?.message ||
        "공지사항 등록에 실패했습니다."
    );
  }

  revalidatePath("/notice");
  revalidatePath("/admin/notices");

  redirect(
    `/admin/notices/${notice.id}`
  );
}

export default async function NewNoticePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

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
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: "28px",
            padding: "0 10px",
            borderRadius: "999px",
            background: "#eef4ff",
            color: "#2f6fed",
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: "0.04em",
          }}
        >
          NEW NOTICE
        </div>

        <h1
          style={{
            margin: "14px 0 0",
            color: "#101828",
            fontSize: "34px",
            lineHeight: 1.2,
            letterSpacing: "-0.035em",
          }}
        >
          새 공지 작성
        </h1>

        <p
          style={{
            margin: "10px 0 0",
            color: "#667085",
            fontSize: "15px",
            lineHeight: 1.7,
          }}
        >
          TALKLY 이용자에게 전달할 공지사항을 작성합니다.
        </p>
      </div>

      <form
        action={createNotice}
        style={{
          marginTop: "28px",
          display: "grid",
          gap: "20px",
        }}
      >
        <section
          style={{
            padding: "26px",
            border:
              "1px solid #e4e7ec",
            borderRadius: "16px",
            background: "#ffffff",
            boxShadow:
              "0 8px 24px rgba(10,31,68,.035)",
          }}
        >
          <div
            style={{
              marginBottom: "22px",
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
              제목과 본문은 사용자 공지사항 화면에 그대로 표시됩니다.
            </p>
          </div>

          <div>
            <label style={labelStyle}>
              제목 *
            </label>

            <input
              name="title"
              required
              maxLength={200}
              placeholder="예: TALKLY 9월 수업 운영 안내"
              style={inputStyle}
            />

            <div
              style={{
                marginTop: "7px",
                color: "#98a2b3",
                fontSize: "11px",
              }}
            >
              최대 200자까지 입력할 수 있습니다.
            </div>
          </div>

          <div
            style={{
              marginTop: "22px",
            }}
          >
            <label style={labelStyle}>
              내용 *
            </label>

            <textarea
              name="content"
              required
              rows={16}
              placeholder={
                "공지 내용을 입력하세요.\n\n예)\n안녕하세요. TALKLY입니다.\n9월 수업 운영 일정을 안내드립니다."
              }
              style={{
                ...inputStyle,
                minHeight: "360px",
                resize: "vertical",
                lineHeight: 1.85,
              }}
            />
          </div>
        </section>

        <section
          style={{
            padding: "24px 26px",
            border:
              "1px solid #e4e7ec",
            borderRadius: "16px",
            background: "#ffffff",
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
              lineHeight: 1.6,
            }}
          >
            중요 공지 여부와 공개 상태를 설정합니다.
          </p>

          <div
            style={{
              marginTop: "20px",
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "14px",
            }}
          >
            <Toggle
              name="is_pinned"
              title="중요공지 / 상단 고정"
              description="사용자 공지사항 목록에서 일반 공지보다 위에 표시됩니다."
            />

            <Toggle
              name="is_published"
              title="즉시 공개"
              description="체크하면 등록 즉시 사용자 공지사항에 노출됩니다."
              defaultChecked
            />
          </div>
        </section>

        <div
          style={{
            padding: "18px 20px",
            borderRadius: "13px",
            background: "#f8fafc",
            border:
              "1px solid #eef1f5",
            color: "#667085",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          비공개로 등록한 공지는 관리자만 확인할 수 있으며,
          나중에 공지사항 관리에서 공개 상태로 변경할 수 있습니다.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/admin/notices"
            style={{
              minHeight: "46px",
              padding: "0 18px",
              display:
                "inline-flex",
              alignItems: "center",
              justifyContent:
                "center",
              border:
                "1px solid #d6deea",
              borderRadius: "10px",
              background: "#ffffff",
              color: "#344054",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 800,
            }}
          >
            ← 목록으로
          </Link>

          <button
            type="submit"
            style={{
              minHeight: "48px",
              padding: "0 24px",
              border: "none",
              borderRadius: "10px",
              background: "#0A1F44",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow:
                "0 8px 20px rgba(10,31,68,.14)",
            }}
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
        padding: "18px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        border:
          "1px solid #e4e7ec",
        borderRadius: "12px",
        background: "#fbfcfe",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        style={{
          width: "18px",
          height: "18px",
          marginTop: "1px",
          accentColor: "#2f6fed",
          flexShrink: 0,
        }}
      />

      <div>
        <div
          style={{
            color: "#101828",
            fontSize: "14px",
            fontWeight: 900,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: "6px",
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
  fontWeight: 900,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  border: "1px solid #d6deea",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "14px",
  outline: "none",
};