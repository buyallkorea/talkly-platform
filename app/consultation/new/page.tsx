import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import {
  revalidatePath,
} from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function createInquiry(
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

  const category =
    String(
      formData.get("category") ??
        "기타"
    ).trim();

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

  if (!title) {
    throw new Error(
      "문의 제목을 입력해주세요."
    );
  }

  if (!content) {
    throw new Error(
      "문의 내용을 입력해주세요."
    );
  }

  const {
    data: inquiry,
    error,
  } = await supabase
    .from("support_inquiries")
    .insert({
      user_id: user.id,
      category,
      title,
      content,
      status: "pending",
      updated_at:
        new Date().toISOString(),
    })
    .select("id")
    .single();

  if (
    error ||
    !inquiry
  ) {
    throw new Error(
      error?.message ||
        "문의 등록에 실패했습니다."
    );
  }

  revalidatePath(
    "/consultation"
  );

  redirect(
    `/consultation/${inquiry.id}`
  );
}

export default async function NewConsultationPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main
      style={{
        maxWidth: "850px",
        margin: "0 auto",
        padding: "56px 24px 90px",
      }}
    >
      <Link
        href="/consultation"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        ← 1:1 상담
      </Link>

      <h1
        style={{
          margin: "18px 0 0",
          color: "#0A1F44",
          fontSize: "34px",
        }}
      >
        새 문의 작성
      </h1>

      <p
        style={{
          margin: "10px 0 0",
          color: "#667085",
          lineHeight: 1.7,
        }}
      >
        문의 내용을 자세히 적어주시면
        확인 후 답변해드리겠습니다.
      </p>

      <form
        action={createInquiry}
        style={{
          marginTop: "28px",
          padding: "26px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
          display: "grid",
          gap: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>
            문의 유형
          </label>

          <select
            name="category"
            defaultValue="수강문의"
            style={inputStyle}
          >
            <option value="수강문의">
              수강문의
            </option>

            <option value="수업문의">
              수업문의
            </option>

            <option value="결제문의">
              결제문의
            </option>

            <option value="강사문의">
              강사문의
            </option>

            <option value="기술문의">
              기술문의
            </option>

            <option value="기타">
              기타
            </option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>
            제목 *
          </label>

          <input
            name="title"
            required
            maxLength={200}
            placeholder="문의 제목"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>
            문의 내용 *
          </label>

          <textarea
            name="content"
            required
            rows={12}
            placeholder="문의 내용을 자세히 입력해주세요."
            style={{
              ...inputStyle,
              resize: "vertical",
              lineHeight: 1.8,
            }}
          />
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: "10px",
            background: "#f8fafc",
            color: "#667085",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          1:1 상담 내용은 본인과 TALKLY 관리자만
          확인할 수 있습니다.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <Link
            href="/consultation"
            style={secondaryButtonStyle}
          >
            취소
          </Link>

          <button
            type="submit"
            style={primaryButtonStyle}
          >
            문의 등록
          </button>
        </div>
      </form>
    </main>
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