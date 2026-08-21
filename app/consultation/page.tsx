import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function ConsultationPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: inquiries,
    error,
  } = await supabase
    .from("support_inquiries")
    .select(`
      id,
      category,
      title,
      status,
      answered_at,
      created_at
    `)
    .eq("user_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  const safeInquiries =
    error ? [] : inquiries ?? [];

  const totalCount =
    safeInquiries.length;

  const pendingCount =
    safeInquiries.filter(
      (item) =>
        item.status === "pending"
    ).length;

  const answeredCount =
    safeInquiries.filter(
      (item) =>
        item.status === "answered"
    ).length;

  return (
    <main
      style={{
        minHeight:
          "calc(100vh - 80px)",
        background:
          "linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)",
        padding:
          "64px 24px 96px",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#667085",
            textDecoration:
              "none",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          ← TALKLY 홈
        </Link>

        <div
          style={{
            marginTop: "22px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: "20px",
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
                minHeight: "30px",
                padding:
                  "0 11px",
                borderRadius:
                  "999px",
                background:
                  "#edf4ff",
                color:
                  "#2f6fed",
                fontSize:
                  "12px",
                fontWeight:
                  900,
                letterSpacing:
                  "0.02em",
              }}
            >
              CUSTOMER SUPPORT
            </div>

            <h1
              style={{
                margin:
                  "16px 0 0",
                color:
                  "#0A1F44",
                fontSize:
                  "42px",
                lineHeight:
                  1.2,
                letterSpacing:
                  "-0.04em",
              }}
            >
              1:1 상담
            </h1>

            <p
              style={{
                margin:
                  "13px 0 0",
                maxWidth:
                  "640px",
                color:
                  "#667085",
                fontSize:
                  "16px",
                lineHeight:
                  1.8,
              }}
            >
              수강, 수업, 결제 및 TALKLY
              이용과 관련한 문의를 남겨주세요.
              등록한 문의와 관리자 답변은 본인만
              확인할 수 있습니다.
            </p>
          </div>

          <Link
            href="/consultation/new"
            style={{
              minHeight:
                "48px",
              padding:
                "0 20px",
              display:
                "inline-flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              borderRadius:
                "10px",
              background:
                "#0A1F44",
              color:
                "#ffffff",
              textDecoration:
                "none",
              fontSize:
                "14px",
              fontWeight:
                900,
              boxShadow:
                "0 8px 20px rgba(10,31,68,.14)",
            }}
          >
            + 새 문의 작성
          </Link>
        </div>

        <section
          style={{
            marginTop:
              "30px",
            display:
              "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          <SummaryCard
            label="전체 문의"
            value={totalCount}
          />

          <SummaryCard
            label="답변대기"
            value={pendingCount}
            accent="waiting"
          />

          <SummaryCard
            label="답변완료"
            value={answeredCount}
            accent="answered"
          />
        </section>

        <section
          style={{
            marginTop: "22px",
            border:
              "1px solid #e4e7ec",
            borderRadius:
              "18px",
            background:
              "#ffffff",
            overflow:
              "hidden",
            boxShadow:
              "0 10px 30px rgba(10,31,68,.05)",
          }}
        >
          {safeInquiries.length ===
          0 ? (
            <div
              style={{
                padding:
                  "80px 24px",
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  width: "58px",
                  height:
                    "58px",
                  margin:
                    "0 auto",
                  borderRadius:
                    "50%",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  background:
                    "#f2f6fc",
                  color:
                    "#7890b7",
                  fontSize:
                    "24px",
                  fontWeight:
                    900,
                }}
              >
                ?
              </div>

              <h2
                style={{
                  margin:
                    "18px 0 0",
                  color:
                    "#101828",
                  fontSize:
                    "18px",
                }}
              >
                아직 등록한 1:1 문의가
                없습니다.
              </h2>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  color:
                    "#98a2b3",
                  fontSize:
                    "13px",
                  lineHeight:
                    1.7,
                }}
              >
                궁금한 점이 있다면 새 문의를
                작성해주세요.
              </p>

              <Link
                href="/consultation/new"
                style={{
                  marginTop:
                    "20px",
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
                문의 작성하기
              </Link>
            </div>
          ) : (
            <>
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "110px minmax(0,1fr) 110px 130px",
                  gap: "14px",
                  padding:
                    "15px 20px",
                  background:
                    "#f8fafc",
                  borderBottom:
                    "1px solid #eef1f5",
                  color:
                    "#667085",
                  fontSize:
                    "12px",
                  fontWeight:
                    800,
                }}
              >
                <div>문의유형</div>
                <div>제목</div>
                <div>상태</div>
                <div
                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  등록일
                </div>
              </div>

              {safeInquiries.map(
                (
                  item,
                  index
                ) => (
                  <Link
                    key={
                      item.id
                    }
                    href={`/consultation/${item.id}`}
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "110px minmax(0,1fr) 110px 130px",
                      gap: "14px",
                      alignItems:
                        "center",
                      padding:
                        "20px",
                      borderBottom:
                        index ===
                        safeInquiries.length -
                          1
                          ? "none"
                          : "1px solid #eef1f5",
                      color:
                        "inherit",
                      textDecoration:
                        "none",
                    }}
                  >
                    <div>
                      <CategoryBadge
                        category={
                          item.category
                        }
                      />
                    </div>

                    <div
                      style={{
                        minWidth:
                          0,
                      }}
                    >
                      <strong
                        style={{
                          display:
                            "block",
                          color:
                            "#101828",
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                          fontSize:
                            "14px",
                        }}
                      >
                        {
                          item.title
                        }
                      </strong>

                      {item.status ===
                        "answered" &&
                        item.answered_at && (
                          <div
                            style={{
                              marginTop:
                                "5px",
                              color:
                                "#98a2b3",
                              fontSize:
                                "11px",
                            }}
                          >
                            답변{" "}
                            {new Date(
                              item.answered_at
                            ).toLocaleDateString(
                              "ko-KR"
                            )}
                          </div>
                        )}
                    </div>

                    <StatusBadge
                      status={
                        item.status
                      }
                    />

                    <div
                      style={{
                        color:
                          "#98a2b3",
                        fontSize:
                          "12px",
                        textAlign:
                          "right",
                      }}
                    >
                      {new Date(
                        item.created_at
                      ).toLocaleDateString(
                        "ko-KR"
                      )}
                    </div>
                  </Link>
                )
              )}
            </>
          )}
        </section>

        <div
          style={{
            marginTop: "20px",
            padding:
              "16px 18px",
            borderRadius:
              "12px",
            background:
              "#f8fafc",
            color:
              "#667085",
            fontSize:
              "12px",
            lineHeight:
              1.75,
          }}
        >
          1:1 상담 내용은 작성자 본인과
          TALKLY 관리자만 확인할 수 있습니다.
          개인정보나 결제정보 전체를 문의 내용에
          직접 입력하지 않는 것을 권장합니다.
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?:
    | "waiting"
    | "answered";
}) {
  let valueColor =
    "#101828";

  if (
    accent === "waiting"
  ) {
    valueColor =
      "#b54708";
  }

  if (
    accent === "answered"
  ) {
    valueColor =
      "#027a48";
  }

  return (
    <div
      style={{
        minHeight:
          "112px",
        padding: "20px",
        border:
          "1px solid #e4e7ec",
        borderRadius:
          "14px",
        background:
          "#ffffff",
      }}
    >
      <div
        style={{
          color:
            "#667085",
          fontSize:
            "13px",
          fontWeight:
            700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "13px",
          color:
            valueColor,
          fontSize:
            "31px",
          lineHeight: 1,
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
        whiteSpace:
          "nowrap",
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
        minHeight:
          "29px",
        padding:
          "0 10px",
        alignItems:
          "center",
        justifyContent:
          "center",
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
        whiteSpace:
          "nowrap",
      }}
    >
      {answered
        ? "답변완료"
        : "답변대기"}
    </span>
  );
}