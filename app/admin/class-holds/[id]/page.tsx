import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ClassHoldReviewForm from "./ClassHoldReviewForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ClassHoldDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const holdId = Number(id);

  if (
    !Number.isInteger(holdId) ||
    holdId <= 0
  ) {
    notFound();
  }

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
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  /*
   * 결석 신청
   */
  const {
    data: hold,
    error: holdError,
  } = await supabase
    .from("class_holds")
    .select(`
      id,
      class_session_id,
      requested_by,
      reason,
      requested_at,
      status,
      reviewed_by,
      reviewed_at,
      admin_note,
      created_at,
      updated_at
    `)
    .eq("id", holdId)
    .maybeSingle();

  if (holdError) {
    throw new Error(holdError.message);
  }

  if (!hold) {
    notFound();
  }

  /*
   * 대상 수업
   */
  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from("class_sessions")
    .select(`
      id,
      enrollment_id,
      lesson_number,
      scheduled_start,
      scheduled_end,
      status,
      meeting_provider,
      meeting_url
    `)
    .eq(
      "id",
      hold.class_session_id
    )
    .maybeSingle();

  if (sessionError) {
    throw new Error(
      sessionError.message
    );
  }

  if (!session) {
    notFound();
  }

  /*
   * 수강정보
   */
  const {
    data: enrollment,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      child_id,
      student_user_id,
      course_id,
      teacher_user_id
    `)
    .eq(
      "id",
      session.enrollment_id
    )
    .maybeSingle();

  if (enrollmentError) {
    throw new Error(
      enrollmentError.message
    );
  }

  if (!enrollment) {
    notFound();
  }

  /*
   * 학생 이름
   */
  let studentName =
    "학생 정보 없음";

  if (enrollment.child_id) {
    const { data: child } =
      await supabase
        .from("children")
        .select("name")
        .eq(
          "id",
          enrollment.child_id
        )
        .maybeSingle();

    if (child?.name) {
      studentName = child.name;
    }
  } else if (
    enrollment.student_user_id
  ) {
    const { data: student } =
      await supabase
        .from("profiles")
        .select("name")
        .eq(
          "id",
          enrollment.student_user_id
        )
        .maybeSingle();

    studentName =
      student?.name ||
      "성인 학생";
  }

  /*
   * 신청자
   */
  const {
    data: requester,
  } = await supabase
    .from("profiles")
    .select("name, role")
    .eq(
      "id",
      hold.requested_by
    )
    .maybeSingle();

  /*
   * 검토 관리자
   */
  let reviewerName = "-";

  if (hold.reviewed_by) {
    const { data: reviewer } =
      await supabase
        .from("profiles")
        .select("name")
        .eq(
          "id",
          hold.reviewed_by
        )
        .maybeSingle();

    if (reviewer?.name) {
      reviewerName =
        reviewer.name;
    }
  }

  /*
   * 과정
   */
  const { data: course } =
    await supabase
      .from("courses")
      .select("name")
      .eq(
        "id",
        enrollment.course_id
      )
      .maybeSingle();

  /*
   * 담당 강사
   */
  let teacherName = "미배정";

  if (
    enrollment.teacher_user_id
  ) {
    const { data: teacher } =
      await supabase
        .from("teacher_profiles")
        .select("display_name")
        .eq(
          "user_id",
          enrollment.teacher_user_id
        )
        .maybeSingle();

    if (teacher?.display_name) {
      teacherName =
        teacher.display_name;
    }
  }

  /*
   * 현재 신청 외의 다음 승인대기 신청
   *
   * 가장 오래 기다리고 있는 requested 신청을
   * 다음 처리 대상으로 표시합니다.
   */
  const {
    data: nextRequestedHold,
    error: nextRequestedError,
  } = await supabase
    .from("class_holds")
    .select(`
      id,
      requested_at
    `)
    .eq("status", "requested")
    .neq("id", hold.id)
    .order(
      "requested_at",
      {
        ascending: true,
      }
    )
    .limit(1)
    .maybeSingle();

  if (nextRequestedError) {
    throw new Error(
      nextRequestedError.message
    );
  }

  function getHoldStatusLabel(
    status: string
  ) {
    switch (status) {
      case "requested":
        return "승인대기";

      case "approved":
        return "승인완료";

      case "rejected":
        return "거절";

      case "cancelled":
        return "신청취소";

      default:
        return status;
    }
  }

  function getSessionStatusLabel(
    status: string
  ) {
    switch (status) {
      case "scheduled":
        return "예정";

      case "in_progress":
        return "수업중";

      case "completed":
        return "완료";

      case "absent":
        return "결석";

      case "makeup":
        return "보강";

      case "cancelled":
        return "취소";

      default:
        return status;
    }
  }

  function getRequesterRoleLabel(
    role: string | null | undefined
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

  function formatDateTime(
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
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(
      new Date(value)
    );
  }

  function getDurationMinutes(
    start: string,
    end: string
  ) {
    return Math.round(
      (new Date(end).getTime() -
        new Date(start).getTime()) /
        60000
    );
  }

  const durationMinutes =
    getDurationMinutes(
      session.scheduled_start,
      session.scheduled_end
    );

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1050px",
        margin: "0 auto",
        padding: "54px 42px 90px",
      }}
    >
      {/* 상단 이동 */}

      <Link
        href="/admin/class-holds"
        style={{
          color: "#667085",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 800,
        }}
      >
        ← 결석 신청 목록
      </Link>

      {/* 제목 */}

      <section
        style={{
          marginTop: "22px",
        }}
      >
        <div
          style={{
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
                color: "#2f6fed",
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing:
                  "0.08em",
              }}
            >
              CLASS ABSENCE REQUEST
            </div>

            <h1
              style={{
                margin: "10px 0 0",
                color: "#101828",
                fontSize: "36px",
                lineHeight: 1.2,
                letterSpacing:
                  "-0.04em",
              }}
            >
              결석 신청 상세
            </h1>

            <p
              style={{
                margin: "13px 0 0",
                color: "#667085",
                fontSize: "15px",
                lineHeight: 1.7,
              }}
            >
              <strong
                style={{
                  color: "#344054",
                }}
              >
                {studentName}
              </strong>{" "}
              학생의 결석 신청 내용을
              확인합니다.
            </p>
          </div>

          <StatusBadge
            status={hold.status}
            label={getHoldStatusLabel(
              hold.status
            )}
          />
        </div>
      </section>

      {/* 신청 기본 정보 */}

      <section
        style={{
          marginTop: "30px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "18px",
          background: "#ffffff",
          overflow: "hidden",
          boxShadow:
            "0 1px 2px rgba(16,24,40,.03)",
        }}
      >
        <div
          style={{
            padding: "21px 24px",
            borderBottom:
              "1px solid #eaecf0",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "18px",
            }}
          >
            신청 정보
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#98a2b3",
              fontSize: "12px",
            }}
          >
            회원이 제출한 결석 신청
            정보입니다.
          </p>
        </div>

        <div
          style={{
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0,1fr))",
              gap: "22px",
            }}
          >
            <InfoItem
              label="학생"
              value={studentName}
            />

            <InfoItem
              label="신청자"
              value={
                requester?.name ||
                "이름 미등록"
              }
              subValue={getRequesterRoleLabel(
                requester?.role
              )}
            />

            <InfoItem
              label="신청일"
              value={formatDateTime(
                hold.requested_at
              )}
            />

            <InfoItem
              label="처리상태"
              value={getHoldStatusLabel(
                hold.status
              )}
            />
          </div>

          <div
            style={{
              marginTop: "26px",
              padding: "20px",
              border:
                "1px solid #e4e7ec",
              borderRadius: "12px",
              background: "#f9fafb",
            }}
          >
            <div
              style={{
                color: "#667085",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              신청 사유
            </div>

            <div
              style={{
                marginTop: "11px",
                color: "#344054",
                fontSize: "14px",
                lineHeight: 1.85,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {hold.reason ||
                "사유가 입력되지 않았습니다."}
            </div>
          </div>
        </div>
      </section>

      {/* 대상 수업 */}

      <section
        style={{
          marginTop: "22px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "18px",
          background: "#ffffff",
          overflow: "hidden",
          boxShadow:
            "0 1px 2px rgba(16,24,40,.03)",
        }}
      >
        <div
          style={{
            padding: "21px 24px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            borderBottom:
              "1px solid #eaecf0",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: "#101828",
                fontSize: "18px",
              }}
            >
              대상 수업
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                color: "#98a2b3",
                fontSize: "12px",
              }}
            >
              결석 신청이 접수된
              수업입니다.
            </p>
          </div>

          <Link
            href={`/admin/enrollments/${enrollment.id}/lessons/${session.id}`}
            style={{
              minHeight: "38px",
              padding: "0 13px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent:
                "center",
              border:
                "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#344054",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            수업 상세보기 →
          </Link>
        </div>

        <div
          style={{
            padding: "24px",
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0,1fr))",
            gap: "24px 20px",
          }}
        >
          <InfoItem
            label="학생"
            value={studentName}
          />

          <InfoItem
            label="과정"
            value={
              course?.name || "-"
            }
          />

          <InfoItem
            label="담당 강사"
            value={teacherName}
          />

          <InfoItem
            label="수업 회차"
            value={`${session.lesson_number}회차`}
          />

          <InfoItem
            label="수업 시작"
            value={formatDateTime(
              session.scheduled_start
            )}
          />

          <InfoItem
            label="수업 시간"
            value={`${durationMinutes}분`}
          />

          <InfoItem
            label="현재 수업 상태"
            value={getSessionStatusLabel(
              session.status
            )}
          />
        </div>
      </section>

      {/* 관리자 검토 */}

      <section
        style={{
          marginTop: "22px",
          border:
            hold.status ===
            "requested"
              ? "1px solid #bfd0ff"
              : "1px solid #e4e7ec",
          borderRadius: "18px",
          background:
            hold.status ===
            "requested"
              ? "#fbfcff"
              : "#ffffff",
          overflow: "hidden",
          boxShadow:
            "0 1px 2px rgba(16,24,40,.03)",
        }}
      >
        <div
          style={{
            padding: "21px 24px",
            borderBottom:
              "1px solid #eaecf0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  color: "#101828",
                  fontSize: "18px",
                }}
              >
                관리자 검토
              </h2>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#98a2b3",
                  fontSize: "12px",
                }}
              >
                결석 신청을 확인하고
                처리합니다.
              </p>
            </div>

            {hold.status ===
              "requested" && (
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius:
                    "999px",
                  background:
                    "#fff7ed",
                  color: "#b54708",
                  fontSize: "11px",
                  fontWeight: 900,
                }}
              >
                처리 필요
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            padding: "24px",
          }}
        >
          {hold.status ===
          "requested" ? (
            <>
              <div
                style={{
                  marginBottom: "20px",
                  padding: "15px 16px",
                  border:
                    "1px solid #d6e4ff",
                  borderRadius: "11px",
                  background: "#f5f8ff",
                  color: "#475467",
                  fontSize: "13px",
                  lineHeight: 1.7,
                }}
              >
                아직 처리되지 않은
                결석 신청입니다. 신청
                내용을 확인한 뒤 승인
                또는 거절해주세요.
              </div>

              <ClassHoldReviewForm
                holdId={hold.id}
                sessionId={session.id}
              />
            </>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, minmax(0,1fr))",
                  gap: "20px",
                }}
              >
                <InfoItem
                  label="처리 결과"
                  value={getHoldStatusLabel(
                    hold.status
                  )}
                />

                <InfoItem
                  label="검토 관리자"
                  value={reviewerName}
                />

                <InfoItem
                  label="검토일"
                  value={formatDateTime(
                    hold.reviewed_at
                  )}
                />
              </div>

              <div
                style={{
                  marginTop: "24px",
                  padding: "20px",
                  border:
                    "1px solid #e4e7ec",
                  borderRadius: "12px",
                  background: "#f9fafb",
                }}
              >
                <div
                  style={{
                    color: "#667085",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  관리자 메모
                </div>

                <div
                  style={{
                    marginTop: "11px",
                    color: "#344054",
                    fontSize: "14px",
                    lineHeight: 1.8,
                    whiteSpace:
                      "pre-wrap",
                    wordBreak:
                      "break-word",
                  }}
                >
                  {hold.admin_note ||
                    "등록된 관리자 메모가 없습니다."}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 하단 이동 */}

      <section
        style={{
          marginTop: "22px",
          padding: "18px 20px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#f9fafb",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/admin/class-holds"
            style={{
              minHeight: "42px",
              padding: "0 15px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent:
                "center",
              border:
                "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#344054",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 800,
            }}
          >
            ← 결석 신청 목록으로
          </Link>

          {nextRequestedHold ? (
            <Link
              href={`/admin/class-holds/${nextRequestedHold.id}`}
              style={{
                minHeight: "42px",
                padding: "0 16px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent:
                  "center",
                borderRadius: "9px",
                background: "#2f6fed",
                color: "#ffffff",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 900,
              }}
            >
              다음 승인대기 신청 →
            </Link>
          ) : (
            <span
              style={{
                color: "#027a48",
                fontSize: "13px",
                fontWeight: 800,
              }}
            >
              다른 승인대기 신청이 없습니다.
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
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div
      style={{
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#98a2b3",
          fontSize: "11px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: "#101828",
          fontSize: "14px",
          fontWeight: 900,
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>

      {subValue && (
        <div
          style={{
            marginTop: "3px",
            color: "#98a2b3",
            fontSize: "11px",
          }}
        >
          {subValue}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  let background =
    "#f2f4f7";

  let color =
    "#475467";

  let border =
    "#e4e7ec";

  if (status === "requested") {
    background = "#fff7ed";
    color = "#b54708";
    border = "#fed7aa";
  }

  if (status === "approved") {
    background = "#ecfdf3";
    color = "#027a48";
    border = "#abefc6";
  }

  if (status === "rejected") {
    background = "#fef3f2";
    color = "#b42318";
    border = "#fecdca";
  }

  return (
    <span
      style={{
        minHeight: "32px",
        padding: "0 11px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${border}`,
        borderRadius: "999px",
        background,
        color,
        fontSize: "12px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}