import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

async function createInquiry(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const category = String(
    formData.get("category") ?? ""
  ).trim();

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const content = String(
    formData.get("content") ?? ""
  ).trim();

  if (!category) {
    throw new Error(
      "문의 유형을 선택해주세요."
    );
  }

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

  if (error || !inquiry) {
    throw new Error(
      error?.message ||
        "문의 등록에 실패했습니다."
    );
  }

  revalidatePath("/consultation");

  redirect(
    `/consultation/${inquiry.id}`
  );
}

export default async function NewConsultationPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main
      style={{
        minHeight:
          "calc(100vh - 80px)",
        background:
          "linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)",
        padding: "64px 24px 96px",
      }}
    >
      <div
        style={{
          maxWidth: "820px",
          margin: "0 auto",
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
          ← 1:1 상담 목록
        </Link>

        <div
          style={{
            marginTop: "22px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "30px",
              padding: "0 11px",
              borderRadius: "999px",
              background: "#edf4ff",
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing: "0.02em",
            }}
          >
            1:1 CONSULTATION
          </div>

          <h1
            style={{
              margin: "16px 0 0",
              color: "#0A1F44",
              fontSize: "40px",
              lineHeight: 1.2,
              letterSpacing: "-0.04em",
            }}
          >
            새 문의 작성
          </h1>

          <p
            style={{
              margin: "12px 0 0",
              color: "#667085",
              fontSize: "15px",
              lineHeight: 1.8,
            }}
          >
            TALKLY 이용 중 궁금한 점을 남겨주세요.
            담당자가 확인 후 답변해드립니다.
          </p>
        </div>

        <form
          action={createInquiry}
          style={{
            marginTop: "30px",
            display: "grid",
            gap: "20px",
          }}
        >
          <section
            style={{
              padding: "28px",
              border: "1px solid #e4e7ec",
              borderRadius: "18px",
              background: "#ffffff",
              boxShadow:
                "0 10px 30px rgba(10,31,68,.05)",
            }}
          >
            <div>
              <label style={labelStyle}>
                문의 유형 *
              </label>

              <select
                name="category"
                required
                defaultValue=""
                style={inputStyle}
              >
                <option value="" disabled>
                  문의 유형을 선택해주세요
                </option>

                <option value="수강">
                  수강 문의
                </option>

                <option value="수업">
                  수업 문의
                </option>

                <option value="결제">
                  결제 문의
                </option>

                <option value="강사">
                  강사 문의
                </option>

                <option value="교재">
                  교재 / 커리큘럼 문의
                </option>

                <option value="계정">
                  계정 / 로그인 문의
                </option>

                <option value="기타">
                  기타 문의
                </option>
              </select>
            </div>

            <div
              style={{
                marginTop: "22px",
              }}
            >
              <label style={labelStyle}>
                제목 *
              </label>

              <input
                type="text"
                name="title"
                required
                maxLength={200}
                placeholder="문의 제목을 입력해주세요."
                style={inputStyle}
              />

              <div
                style={{
                  marginTop: "7px",
                  color: "#98a2b3",
                  fontSize: "11px",
                }}
              >
                문의 내용을 쉽게 확인할 수 있도록
                간단한 제목을 작성해주세요.
              </div>
            </div>

            <div
              style={{
                marginTop: "22px",
              }}
            >
              <label style={labelStyle}>
                문의 내용 *
              </label>

              <textarea
                name="content"
                required
                rows={14}
                placeholder={
                  "문의하실 내용을 자세히 작성해주세요.\n\n예)\n현재 주 2회 수업을 이용하고 있는데 주 3회로 변경하고 싶습니다."
                }
                style={{
                  ...inputStyle,
                  minHeight: "300px",
                  resize: "vertical",
                  lineHeight: 1.8,
                }}
              />
            </div>
          </section>

          <section
            style={{
              padding: "18px 20px",
              border: "1px solid #d9e5f6",
              borderRadius: "13px",
              background: "#f7faff",
            }}
          >
            <div
              style={{
                color: "#0A1F44",
                fontSize: "13px",
                fontWeight: 900,
              }}
            >
              문의 작성 전 확인해주세요
            </div>

            <div
              style={{
                marginTop: "8px",
                color: "#667085",
                fontSize: "12px",
                lineHeight: 1.8,
              }}
            >
              작성한 문의는 본인과 TALKLY 관리자만
              확인할 수 있습니다. 주민등록번호,
              카드번호, 계좌 비밀번호 등 민감한 개인정보는
              문의 내용에 입력하지 마세요.
            </div>
          </section>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/consultation"
              style={secondaryButtonStyle}
            >
              ← 목록으로 돌아가기
            </Link>

            <button
              type="submit"
              style={primaryButtonStyle}
            >
              문의 등록
            </button>
          </div>
        </form>
      </div>
    </main>
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

const primaryButtonStyle = {
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
};

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d6deea",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};