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

  const {
    data: adminProfile,
  } = await supabase
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

  revalidatePath(
    "/consultation"
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

  const {
    data: adminProfile,
    error: adminProfileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    adminProfileError ||
    !adminProfile ||
    adminProfile.role !== "admin"
  ) {
    redirect("/");
  }

  /*
   * 현재 문의
   */
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
      answered_by,
      answered_at,
      created_at,
      updated_at
    `)
    .eq("id", inquiryId)
    .maybeSingle();

  if (
    error ||
    !inquiry
  ) {
    notFound();
  }

  /*
   * 문의자 정보
   */
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

  /*
   * 다음 미답변 문의
   *
   * 현재 문의보다 오래된/새로운 것에 관계없이
   * 가장 오래 기다린 pending 문의를 찾습니다.
   */
  const {
    data: nextPendingInquiry,
  } = await supabase
    .from("support_inquiries")
    .select(`
      id,
      created_at
    `)
    .eq(
      "status",
      "pending"
    )
    .neq(
      "id",
      inquiryId
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    )
    .limit(1)
    .maybeSingle();

  const action =
    saveAnswer.bind(
      null,
      inquiryId
    );

  const answered =
    inquiry.status ===
    "answered";

  const roleLabel =
    getRoleLabel(
      memberProfile?.role ??
        null
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
        href="/admin/support-inquiries"
        style={{
          color: "#667085",
          textDecoration:
            "none",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        ← 1:1 문의 관리
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
              color:
                "#2f6fed",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing:
                "0.04em",
            }}
          >
            SUPPORT INQUIRY
          </div>

          <h1
            style={{
              margin:
                "14px 0 0",
              color:
                "#101828",
              fontSize:
                "34px",
              lineHeight: 1.2,
              letterSpacing:
                "-0.035em",
            }}
          >
            1:1 문의 상세
          </h1>

          <p
            style={{
              margin:
                "10px 0 0",
              color:
                "#667085",
              fontSize:
                "13px",
              lineHeight: 1.7,
            }}
          >
            회원 문의 내용을
            확인하고 답변을
            등록합니다.
          </p>
        </div>

        <StatusBadge
          status={
            inquiry.status
          }
        />
      </div>

      {query.saved === "1" && (
        <div
          style={{
            marginTop: "22px",
            padding:
              "15px 16px",
            border:
              "1px solid #abefc6",
            borderRadius:
              "11px",
            background:
              "#ecfdf3",
            color:
              "#027a48",
            fontSize:
              "13px",
            fontWeight:
              800,
          }}
        >
          답변이 저장되었습니다.
        </div>
      )}

      {/* 문의자 정보 */}

      <section
        style={{
          marginTop: "24px",
          padding:
            "22px 24px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "15px",
          background:
            "#ffffff",
        }}
      >
        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0,1fr))",
            gap: "18px",
          }}
        >
          <InfoItem
            label="문의자"
            value={
              memberProfile?.name ||
              "이름 미등록 회원"
            }
          />

          <InfoItem
            label="회원 구분"
            value={
              roleLabel
            }
          />

          <InfoItem
            label="문의 유형"
            value={
              inquiry.category
            }
          />

          <InfoItem
            label="접수일"
            value={new Date(
              inquiry.created_at
            ).toLocaleDateString(
              "ko-KR"
            )}
          />
        </div>
      </section>

      {/* 문의 내용 */}

      <section
        style={{
          marginTop: "20px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "16px",
          background:
            "#ffffff",
          overflow:
            "hidden",
          boxShadow:
            "0 8px 24px rgba(10,31,68,.035)",
        }}
      >
        <div
          style={{
            padding:
              "25px 26px",
            borderBottom:
              "1px solid #eef1f5",
          }}
        >
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: "9px",
              flexWrap:
                "wrap",
            }}
          >
            <CategoryBadge
              category={
                inquiry.category
              }
            />

            <span
              style={{
                color:
                  "#98a2b3",
                fontSize:
                  "12px",
              }}
            >
              {new Date(
                inquiry.created_at
              ).toLocaleString(
                "ko-KR"
              )}
            </span>
          </div>

          <h2
            style={{
              margin:
                "15px 0 0",
              color:
                "#101828",
              fontSize:
                "24px",
              lineHeight: 1.45,
              letterSpacing:
                "-0.025em",
            }}
          >
            {inquiry.title}
          </h2>
        </div>

        <div
          style={{
            padding:
              "28px 26px 32px",
          }}
        >
          <div
            style={{
              color:
                "#667085",
              fontSize:
                "12px",
              fontWeight:
                800,
            }}
          >
            문의 내용
          </div>

          <div
            style={{
              marginTop:
                "14px",
              color:
                "#344054",
              fontSize:
                "15px",
              lineHeight: 1.9,
              whiteSpace:
                "pre-wrap",
              wordBreak:
                "break-word",
            }}
          >
            {inquiry.content}
          </div>
        </div>
      </section>

      {/* 관리자 답변 */}

      <form
        action={action}
        style={{
          marginTop: "20px",
          padding: "26px",
          border:
            answered
              ? "1px solid #abefc6"
              : "1px solid #e4e7ec",
          borderRadius:
            "16px",
          background:
            answered
              ? "#fbfffc"
              : "#ffffff",
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: "14px",
            flexWrap:
              "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color:
                  "#101828",
                fontSize:
                  "20px",
              }}
            >
              관리자 답변
            </h2>

            <p
              style={{
                margin:
                  "7px 0 0",
                color:
                  "#98a2b3",
                fontSize:
                  "12px",
                lineHeight:
                  1.6,
              }}
            >
              답변을 저장하면
              회원의 1:1 상담
              상세 화면에 즉시
              표시됩니다.
            </p>
          </div>

          {answered && (
            <span
              style={{
                padding:
                  "6px 9px",
                borderRadius:
                  "999px",
                background:
                  "#ecfdf3",
                color:
                  "#027a48",
                fontSize:
                  "11px",
                fontWeight:
                  900,
              }}
            >
              답변완료
            </span>
          )}
        </div>

        <textarea
          name="admin_answer"
          rows={13}
          required
          defaultValue={
            inquiry.admin_answer ??
            ""
          }
          placeholder="회원에게 전달할 답변을 입력하세요."
          style={{
            marginTop:
              "20px",
            width: "100%",
            minHeight:
              "300px",
            boxSizing:
              "border-box",
            padding:
              "14px",
            border:
              "1px solid #d6deea",
            borderRadius:
              "10px",
            background:
              "#ffffff",
            color:
              "#101828",
            fontFamily:
              "inherit",
            fontSize:
              "14px",
            lineHeight: 1.85,
            resize:
              "vertical",
            outline:
              "none",
          }}
        />

        {inquiry.answered_at && (
          <div
            style={{
              marginTop:
                "10px",
              color:
                "#98a2b3",
              fontSize:
                "11px",
            }}
          >
            마지막 답변 저장:{" "}
            {new Date(
              inquiry.answered_at
            ).toLocaleString(
              "ko-KR"
            )}
          </div>
        )}

        <div
          style={{
            marginTop:
              "20px",
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "12px",
            flexWrap:
              "wrap",
          }}
        >
          <Link
            href="/admin/support-inquiries"
            style={
              secondaryButtonStyle
            }
          >
            ← 문의 목록으로
          </Link>

          <button
            type="submit"
            style={
              primaryButtonStyle
            }
          >
            {answered
              ? "답변 수정 저장"
              : "답변 등록"}
          </button>
        </div>
      </form>

      {/* 다음 문의 이동 */}

      <section
        style={{
          marginTop: "22px",
          padding:
            "18px 20px",
          border:
            "1px solid #e4e7ec",
          borderRadius:
            "14px",
          background:
            "#f8fafc",
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "14px",
            flexWrap:
              "wrap",
          }}
        >
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
              다음 문의 처리
            </div>

            <div
              style={{
                marginTop:
                  "5px",
                color:
                  "#667085",
                fontSize:
                  "12px",
                lineHeight:
                  1.6,
              }}
            >
              답변을 마친 뒤
              다음 미답변 문의로
              바로 이동할 수 있습니다.
            </div>
          </div>

          {nextPendingInquiry ? (
            <Link
              href={`/admin/support-inquiries/${nextPendingInquiry.id}`}
              style={{
                minHeight:
                  "44px",
                padding:
                  "0 17px",
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                borderRadius:
                  "9px",
                background:
                  "#2f6fed",
                color:
                  "#ffffff",
                textDecoration:
                  "none",
                fontSize:
                  "13px",
                fontWeight:
                  900,
              }}
            >
              다음 미답변 문의 →
            </Link>
          ) : (
            <span
              style={{
                color:
                  "#027a48",
                fontSize:
                  "13px",
                fontWeight:
                  800,
              }}
            >
              대기 중인 다른 문의가 없습니다.
            </span>
          )}
        </div>
      </section>
    </main>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          color:
            "#98a2b3",
          fontSize:
            "11px",
          fontWeight:
            700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "6px",
          color:
            "#101828",
          fontSize:
            "14px",
          fontWeight:
            900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CategoryBadge({
  category,
}: {
  category: string;
}) {
  return (
    <span
      style={{
        display:
          "inline-flex",
        alignItems:
          "center",
        minHeight:
          "28px",
        padding:
          "0 9px",
        borderRadius:
          "999px",
        background:
          "#eef4ff",
        color:
          "#2f6fed",
        fontSize:
          "11px",
        fontWeight:
          900,
      }}
    >
      {category}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const answered =
    status ===
    "answered";

  return (
    <span
      style={{
        display:
          "inline-flex",
        alignItems:
          "center",
        minHeight:
          "30px",
        padding:
          "0 10px",
        borderRadius:
          "999px",
        background:
          answered
            ? "#ecfdf3"
            : "#fff7ed",
        color:
          answered
            ? "#027a48"
            : "#b54708",
        fontSize:
          "11px",
        fontWeight:
          900,
      }}
    >
      {answered
        ? "답변완료"
        : "답변대기"}
    </span>
  );
}

function getRoleLabel(
  role: string | null
) {
  switch (role) {
    case "parent":
      return "학부모";

    case "student":
      return "학생";

    case "teacher":
      return "강사";

    case "admin":
      return "관리자";

    default:
      return "회원";
  }
}

const primaryButtonStyle = {
  minHeight: "48px",
  padding: "0 22px",
  border: "none",
  borderRadius:
    "10px",
  background:
    "#0A1F44",
  color:
    "#ffffff",
  fontSize:
    "14px",
  fontWeight:
    900,
  cursor:
    "pointer",
  boxShadow:
    "0 8px 20px rgba(10,31,68,.14)",
};

const secondaryButtonStyle = {
  minHeight: "46px",
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
  background:
    "#ffffff",
  color:
    "#344054",
  textDecoration:
    "none",
  fontSize:
    "13px",
  fontWeight:
    800,
};