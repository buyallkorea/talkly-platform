import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type LevelTestRow = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
  parent_user_id: string | null;

  status: string;
  target_group: string | null;
  grade: string | null;

  ai_status: string;
  ai_suggested_level: string | null;
  ai_confidence: number | null;

  interview_required: boolean;
  interview_status: string | null;
  teacher_suggested_level: string | null;

  final_level: string | null;

  created_at: string;
};

type ChildRow = {
  id: number;
  name: string;
  grade: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getStatusLabel(status: string) {
  switch (status) {
    case "requested":
      return "신청";

    case "ai_in_progress":
      return "AI 테스트 진행 중";

    case "ai_completed":
      return "AI 테스트 완료";

    case "admin_review":
      return "관리자 검토";

    case "interview_required":
      return "원어민 테스트 필요";

    case "interview_scheduled":
      return "원어민 테스트 예정";

    case "interview_completed":
      return "원어민 테스트 완료";

    case "completed":
      return "최종 완료";

    default:
      return status;
  }
}

function getAiStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "대기";

    case "in_progress":
      return "진행 중";

    case "completed":
      return "완료";

    default:
      return status;
  }
}

function getInterviewStatusLabel(
  status: string | null
) {
  if (!status) {
    return "필요";
  }

  switch (status) {
    case "scheduling":
      return "일정 협의 중";

    case "scheduled":
      return "예정";

    case "in_progress":
      return "진행 중";

    case "completed":
      return "완료";

    case "cancelled":
      return "취소";

    case "no_show":
      return "불참";

    default:
      return status;
  }
}

export default async function AdminLevelTestsPage() {
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
    data: levelTests,
    error: levelTestsError,
  } = await supabase
    .from("level_tests")
    .select(`
      id,
      child_id,
      student_user_id,
      parent_user_id,
      status,
      target_group,
      grade,
      ai_status,
      ai_suggested_level,
      ai_confidence,
      interview_required,
      interview_status,
      teacher_suggested_level,
      final_level,
      created_at
    `)
    .order("created_at", {
      ascending: false,
    });

  if (levelTestsError) {
    throw new Error(
      `레벨테스트 목록을 불러오지 못했습니다: ${levelTestsError.message}`
    );
  }

  const rows =
    (levelTests ?? []) as LevelTestRow[];

  const childIds = Array.from(
    new Set(
      rows
        .map((row) => row.child_id)
        .filter(
          (id): id is number =>
            typeof id === "number"
        )
    )
  );

  let childrenMap = new Map<
    number,
    ChildRow
  >();

  if (childIds.length > 0) {
    const {
      data: children,
      error: childrenError,
    } = await supabase
      .from("children")
      .select("id, name, grade")
      .in("id", childIds);

    if (childrenError) {
      throw new Error(
        `학생 정보를 불러오지 못했습니다: ${childrenError.message}`
      );
    }

    childrenMap = new Map(
      ((children ?? []) as ChildRow[]).map(
        (child) => [
          child.id,
          child,
        ]
      )
    );
  }

  const totalCount = rows.length;

  const aiPendingCount = rows.filter(
    (row) =>
      row.ai_status !== "completed"
  ).length;

  const interviewRequiredCount =
    rows.filter(
      (row) =>
        row.interview_required &&
        row.interview_status !==
          "completed"
    ).length;

  const completedCount = rows.filter(
    (row) => !!row.final_level
  ).length;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "54px 42px 90px",
      }}
    >
      {/* 페이지 제목 */}
      <div>
        <div
          style={{
            color: "#2f6fed",
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          LEVEL TEST MANAGEMENT
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
          레벨테스트 관리
        </h1>

        <p
          style={{
            margin: "13px 0 0",
            color: "#667085",
            fontSize: "14px",
            lineHeight: 1.7,
          }}
        >
          AI 레벨테스트와 필요 시 진행되는
          원어민 화상 레벨테스트를 통합
          관리합니다.
        </p>
      </div>

      {/* 통계 */}
      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: "14px",
        }}
      >
        <SummaryCard
          label="전체 신청"
          value={totalCount}
          description="전체 레벨테스트 신청"
        />

        <SummaryCard
          label="AI 진행 / 대기"
          value={aiPendingCount}
          description="AI 테스트 미완료"
        />

        <SummaryCard
          label="원어민 테스트 필요"
          value={interviewRequiredCount}
          description="추가 확인 대상"
        />

        <SummaryCard
          label="최종 확정"
          value={completedCount}
          description="최종 레벨 확정 완료"
        />
      </section>

      {/* 안내 */}
      <section
        style={{
          marginTop: "22px",
          padding: "20px",
          border: "1px solid #dbe7ff",
          borderRadius: "14px",
          background: "#f5f8ff",
        }}
      >
        <div
          style={{
            color: "#2f6fed",
            fontSize: "13px",
            fontWeight: 900,
          }}
        >
          TALKLY 레벨테스트 운영 방식
        </div>

        <p
          style={{
            margin: "7px 0 0",
            color: "#667085",
            fontSize: "12px",
            lineHeight: 1.8,
          }}
        >
          AI 레벨테스트를 기본으로 진행하고,
          관리자가 결과를 검토하여 추가 확인이
          필요한 학생에게만 원어민 강사의 화상
          레벨테스트를 진행합니다. 최종 레벨은
          관리자 검토 후 확정합니다.
        </p>
      </section>

      {/* 신청 목록 */}
      <section
        style={{
          marginTop: "22px",
          border: "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "22px 24px",
            borderBottom:
              "1px solid #e4e7ec",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "19px",
            }}
          >
            레벨테스트 신청 목록
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#98a2b3",
              fontSize: "12px",
            }}
          >
            학생별 AI 테스트 진행 상태와
            추가 원어민 테스트 여부를
            확인합니다.
          </p>
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              padding: "70px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: "#344054",
                fontSize: "16px",
                fontWeight: 900,
              }}
            >
              아직 레벨테스트 신청이
              없습니다.
            </div>

            <p
              style={{
                margin: "8px 0 0",
                color: "#98a2b3",
                fontSize: "13px",
              }}
            >
              학생 또는 학부모가
              레벨테스트를 신청하면 이곳에
              표시됩니다.
            </p>
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1050px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f9fafb",
                  }}
                >
                  <TableHeader>
                    학생
                  </TableHeader>

                  <TableHeader>
                    대상
                  </TableHeader>

                  <TableHeader>
                    진행 상태
                  </TableHeader>

                  <TableHeader>
                    AI 결과
                  </TableHeader>

                  <TableHeader>
                    원어민 테스트
                  </TableHeader>

                  <TableHeader>
                    최종 레벨
                  </TableHeader>

                  <TableHeader>
                    신청일
                  </TableHeader>

                  <TableHeader align="right">
                    관리
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const child =
                    row.child_id !== null
                      ? childrenMap.get(
                          row.child_id
                        )
                      : undefined;

                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderTop:
                          "1px solid #f2f4f7",
                      }}
                    >
                      <TableCell>
                        <div
                          style={{
                            color: "#101828",
                            fontSize: "13px",
                            fontWeight: 900,
                          }}
                        >
                          {child?.name ??
                            "학생 정보 없음"}
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "#98a2b3",
                            fontSize: "11px",
                          }}
                        >
                          신청 #{row.id}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div
                          style={{
                            color: "#344054",
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          {row.target_group ??
                            "-"}
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "#98a2b3",
                            fontSize: "11px",
                          }}
                        >
                          {row.grade ??
                            child?.grade ??
                            "-"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge
                          label={getStatusLabel(
                            row.status
                          )}
                        />

                        <div
                          style={{
                            marginTop: "6px",
                            color: "#98a2b3",
                            fontSize: "11px",
                          }}
                        >
                          AI{" "}
                          {getAiStatusLabel(
                            row.ai_status
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div
                          style={{
                            color: "#344054",
                            fontSize: "13px",
                            fontWeight: 900,
                          }}
                        >
                          {row.ai_suggested_level ??
                            "-"}
                        </div>

                        {row.ai_confidence !==
                          null && (
                          <div
                            style={{
                              marginTop: "4px",
                              color: "#98a2b3",
                              fontSize: "11px",
                            }}
                          >
                            신뢰도{" "}
                            {
                              row.ai_confidence
                            }
                            %
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {row.interview_required ? (
                          <InterviewBadge
                            label={getInterviewStatusLabel(
                              row.interview_status
                            )}
                          />
                        ) : (
                          <span
                            style={{
                              color: "#98a2b3",
                              fontSize: "12px",
                            }}
                          >
                            미요청
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div
                          style={{
                            color: row.final_level
                              ? "#027a48"
                              : "#98a2b3",
                            fontSize: "13px",
                            fontWeight: 900,
                          }}
                        >
                          {row.final_level ??
                            "-"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div
                          style={{
                            color: "#667085",
                            fontSize: "12px",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {formatDate(
                            row.created_at
                          )}
                        </div>
                      </TableCell>

                      <TableCell align="right">
                        <Link
                          href={`/admin/level-tests/${row.id}`}
                          style={{
                            color: "#2f6fed",
                            textDecoration:
                              "none",
                            fontSize: "12px",
                            fontWeight: 900,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          상세 관리 →
                        </Link>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div
        style={{
          marginTop: "24px",
        }}
      >
        <Link
          href="/admin"
          style={secondaryButtonStyle}
        >
          ← 관리자 대시보드
        </Link>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div
      style={{
        padding: "20px",
        border: "1px solid #e4e7ec",
        borderRadius: "14px",
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
          marginTop: "8px",
          color: "#101828",
          fontSize: "30px",
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "8px",
          color: "#98a2b3",
          fontSize: "11px",
        }}
      >
        {description}
      </div>
    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{
        padding: "12px 16px",
        color: "#667085",
        fontSize: "10px",
        fontWeight: 900,
        textAlign: align,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        padding: "16px",
        textAlign: align,
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function StatusBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span
      style={{
        minHeight: "27px",
        padding: "0 9px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: "#eef4ff",
        color: "#2f6fed",
        fontSize: "11px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function InterviewBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span
      style={{
        minHeight: "27px",
        padding: "0 9px",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        background: "#fff7ed",
        color: "#b54708",
        fontSize: "11px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const secondaryButtonStyle = {
  minHeight: "46px",
  padding: "0 18px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d0d5dd",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#344054",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: 800,
};