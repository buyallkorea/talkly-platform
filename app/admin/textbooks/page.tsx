import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function AdminTextbooksPage() {
  const supabase = await createClient();

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
    data: textbooks,
    error,
  } = await supabase
    .from("textbooks")
    .select(`
      id,
      title,
      description,
      original_file_url,
      original_file_type,
      page_count,
      status,
      created_at,
      updated_at
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const totalCount =
    textbooks?.length ?? 0;

  const readyCount =
    textbooks?.filter(
      (item) =>
        item.status === "ready"
    ).length ?? 0;

  const draftCount =
    textbooks?.filter(
      (item) =>
        item.status === "draft"
    ).length ?? 0;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "54px 42px 90px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#2f6fed",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing: "0.08em",
            }}
          >
            LEARNING CONTENT
          </div>

          <h1
            style={{
              margin: "10px 0 0",
              color: "#101828",
              fontSize: "36px",
              lineHeight: 1.2,
              letterSpacing: "-0.04em",
            }}
          >
            교재 관리
          </h1>

          <p
            style={{
              margin: "12px 0 0",
              color: "#667085",
              fontSize: "14px",
              lineHeight: 1.7,
            }}
          >
            TALKLY 수업에서 사용하는
            교재와 원본 콘텐츠를 관리합니다.
          </p>
        </div>

        <Link
          href="/admin/textbooks/new"
          style={{
            minHeight: "46px",
            padding: "0 18px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            background: "#0A1F44",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          + 새 교재 등록
        </Link>
      </div>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <SummaryCard
          label="전체 교재"
          value={totalCount}
        />

        <SummaryCard
          label="사용 가능"
          value={readyCount}
        />

        <SummaryCard
          label="작업 중"
          value={draftCount}
        />
      </section>

      <section
        style={{
          marginTop: "22px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        {!textbooks ||
        textbooks.length === 0 ? (
          <div
            style={{
              padding: "70px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: "#101828",
                fontSize: "17px",
                fontWeight: 900,
              }}
            >
              등록된 교재가 없습니다.
            </div>

            <p
              style={{
                margin: "8px 0 0",
                color: "#98a2b3",
                fontSize: "13px",
              }}
            >
              새로운 교재를 등록해
              TALKLY 수업에 활용할 수 있습니다.
            </p>

            <Link
              href="/admin/textbooks/new"
              style={{
                marginTop: "20px",
                minHeight: "42px",
                padding: "0 16px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "9px",
                background: "#0A1F44",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: 900,
              }}
            >
              첫 교재 등록하기
            </Link>
          </div>
        ) : (
          textbooks.map(
            (textbook, index) => (
              <div
                key={textbook.id}
                style={{
                  padding: "20px 22px",
                  borderBottom:
                    index ===
                    textbooks.length - 1
                      ? "none"
                      : "1px solid #eef1f5",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: "20px",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems:
                          "center",
                        gap: "8px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <strong
                        style={{
                          color:
                            "#101828",
                          fontSize:
                            "16px",
                        }}
                      >
                        {textbook.title}
                      </strong>

                      <StatusBadge
                        status={
                          textbook.status
                        }
                      />

                      <FileTypeBadge
                        type={
                          textbook.original_file_type
                        }
                      />
                    </div>

                    <p
                      style={{
                        margin:
                          "8px 0 0",
                        color:
                          "#667085",
                        fontSize:
                          "12px",
                        lineHeight:
                          1.6,
                      }}
                    >
                      {textbook.description ||
                        "등록된 설명이 없습니다."}
                    </p>

                    <div
                      style={{
                        marginTop:
                          "10px",
                        display:
                          "flex",
                        gap: "16px",
                        flexWrap:
                          "wrap",
                        color:
                          "#98a2b3",
                        fontSize:
                          "11px",
                      }}
                    >
                      <span>
                        페이지{" "}
                        {textbook.page_count ??
                          0}
                      </span>

                      <span>
                        등록{" "}
                        {formatDate(
                          textbook.created_at
                        )}
                      </span>

                      <span>
                        수정{" "}
                        {formatDate(
                          textbook.updated_at
                        )}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <Link
                      href={`/admin/textbooks/${textbook.id}/viewer`}
                      style={{
                        minHeight:
                          "38px",
                        padding:
                          "0 13px",
                        display:
                          "inline-flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        border:
                          "1px solid #d0d5dd",
                        borderRadius:
                          "8px",
                        background:
                          "#ffffff",
                        color:
                          "#344054",
                        textDecoration:
                          "none",
                        fontSize:
                          "12px",
                        fontWeight:
                          900,
                      }}
                    >
                      교재 보기
                    </Link>

                    <Link
                      href={`/admin/textbooks/${textbook.id}`}
                      style={{
                        minHeight:
                          "38px",
                        padding:
                          "0 13px",
                        display:
                          "inline-flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        border: "none",
                        borderRadius:
                          "8px",
                        background:
                          "#0A1F44",
                        color:
                          "#ffffff",
                        textDecoration:
                          "none",
                        fontSize:
                          "12px",
                        fontWeight:
                          900,
                      }}
                    >
                      상세 관리 →
                    </Link>
                  </div>
                </div>
              </div>
            )
          )
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        minHeight: "102px",
        padding: "18px 20px",
        border: "1px solid #e4e7ec",
        borderRadius: "13px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "10px",
          color: "#101828",
          fontSize: "29px",
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const ready =
    status === "ready";

  return (
    <span
      style={{
        minHeight: "25px",
        padding: "0 8px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: ready
          ? "#ecfdf3"
          : "#fff7ed",
        color: ready
          ? "#027a48"
          : "#b54708",
        fontSize: "10px",
        fontWeight: 900,
      }}
    >
      {ready
        ? "사용 가능"
        : status === "draft"
          ? "작업 중"
          : status}
    </span>
  );
}

function FileTypeBadge({
  type,
}: {
  type: string | null;
}) {
  const label =
    type?.toUpperCase() || "FILE";

  return (
    <span
      style={{
        minHeight: "25px",
        padding: "0 8px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: "#eef4ff",
        color: "#2f6fed",
        fontSize: "10px",
        fontWeight: 900,
      }}
    >
      {label}
    </span>
  );
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date(value));
}