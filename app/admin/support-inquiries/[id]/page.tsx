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

async function saveAnswer(
  inquiryId: number,
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

  const adminAnswer =
    String(
      formData.get(
        "admin_answer"
      ) ?? ""
    ).trim();

  if (!adminAnswer) {
    throw new Error(
      "답변 내용을 입력해주세요."
    );
  }

  const now =
    new Date().toISOString();

  const { error } =
    await supabase
      .from("support_inquiries")
      .update({
        admin_answer:
          adminAnswer,

        status:
          "answered",

        answered_by:
          user.id,

        answered_at:
          now,

        updated_at:
          now,
      })
      .eq("id", inquiryId);

  if (error) {
    throw new Error(
      error.message
    );
  }

  revalidatePath(
    "/admin/support-inquiries"
  );

  revalidatePath(
    `/admin/support-inquiries/${inquiryId}`
  );

  revalidatePath(
    `/consultation/${inquiryId}`
  );

  redirect(
    `/admin/support-inquiries/${inquiryId}?saved=1`
  );
}

export default async function AdminSupportInquiryDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } =
    await params;

  const query =
    await searchParams;

  const inquiryId =
    Number(id);

  if (
    !Number.isInteger(
      inquiryId
    ) ||
    inquiryId <= 0
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

  const { data: adminProfile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    !adminProfile ||
    adminProfile.role !== "admin"
  ) {
    redirect("/");
  }

  const {
    data: inquiry,
    error,
  } = await supabase
    .from("support_inquiries")
    .select(`
      id,
      user_id,
      category,
      title,
      content,
      status,
      admin_answer,
      answered_at,
      created_at
    `)
    .eq("id", inquiryId)
    .maybeSingle();

  if (
    error ||
    !inquiry
  ) {
    notFound();
  }

  const {
    data: memberProfile,
  } = await supabase
    .from("profiles")
    .select(`
      id,
      name,
      role
    `)
    .eq(
      "id",
      inquiry.user_id
    )
    .maybeSingle();

  const action =
    saveAnswer.bind(
      null,
      inquiryId
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
        href="/admin/support-inquiries"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        ← 1:1 문의 관리
      </Link>

      <div
        style={{
          marginTop: "18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "32px",
            }}
          >
            1:1 문의 상세
          </h1>

          <p
            style={{
              margin: "9px 0 0",
              color: "#667085",
              fontSize: "13px",
            }}
          >
            {memberProfile?.name ||
              "이름 미등록 회원"}{" "}
            ·{" "}
            {memberProfile?.role ||
              "-"}{" "}
            · {inquiry.category}
          </p>
        </div>

        <span
          style={{
            padding: "7px 10px",
            borderRadius: "999px",
            background:
              inquiry.status ===
              "answered"
                ? "#ecfdf3"
                : "#fff7ed",
            color:
              inquiry.status ===
              "answered"
                ? "#027a48"
                : "#b54708",
            fontSize: "12px",
            fontWeight: 900,
          }}
        >
          {inquiry.status ===
          "answered"
            ? "답변완료"
            : "답변대기"}
        </span>
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
          답변이 저장되었습니다.
        </div>
      )}

      <section
        style={{
          marginTop: "24px",
          padding: "26px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            color: "#667085",
            fontSize: "12px",
          }}
        >
          {new Date(
            inquiry.created_at
          ).toLocaleString(
            "ko-KR"
          )}
        </div>

        <h2
          style={{
            margin: "12px 0 0",
            color: "#101828",
            fontSize: "22px",
          }}
        >
          {inquiry.title}
        </h2>

        <div
          style={{
            marginTop: "20px",
            paddingTop: "20px",
            borderTop: "1px solid #eef1f5",
            color: "#344054",
            lineHeight: 1.9,
            whiteSpace: "pre-wrap",
          }}
        >
          {inquiry.content}
        </div>
      </section>

      <form
        action={action}
        style={{
          marginTop: "20px",
          padding: "26px",
          border: "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
        }}
      >
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            color: "#344054",
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          관리자 답변 *
        </label>

        <textarea
          name="admin_answer"
          rows={12}
          required
          defaultValue={
            inquiry.admin_answer ??
            ""
          }
          style={{
            width: "100%",
            boxSizing:
              "border-box",
            padding: "14px",
            border: "1px solid #d6deea",
            borderRadius: "10px",
            background: "#ffffff",
            color: "#101828",
            fontFamily: "inherit",
            fontSize: "14px",
            lineHeight: 1.8,
            resize: "vertical",
          }}
          placeholder="회원에게 전달할 답변을 입력하세요."
        />

        {inquiry.answered_at && (
          <p
            style={{
              margin: "10px 0 0",
              color: "#98a2b3",
              fontSize: "12px",
            }}
          >
            마지막 답변:{" "}
            {new Date(
              inquiry.answered_at
            ).toLocaleString(
              "ko-KR"
            )}
          </p>
        )}

        <div
          style={{
            marginTop: "18px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="submit"
            style={{
              minHeight: "46px",
              padding: "0 20px",
              border: "none",
              borderRadius: "10px",
              background: "#0A1F44",
              color: "#ffffff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {inquiry.status ===
            "answered"
              ? "답변 수정 저장"
              : "답변 등록"}
          </button>
        </div>
      </form>
    </main>
  );
}