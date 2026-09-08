import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type SearchParams = Promise<{
  q?: string;
  target?: string;
  course?: string;
  teacher?: string;
  status?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
};

type EnrollmentRow = {
  id: number;
  student_user_id: string | null;
  child_id: number | null;
  course_id: number;
  teacher_user_id: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  lessons_per_week: number | null;
  total_lessons: number | null;
  created_at: string;
};

type ChildRow = {
  id: number;
  name: string | null;
  grade: string | null;
  school_name: string | null;
};

type CourseRow = {
  id: number;
  name: string;
};

type TeacherRow = {
  user_id: string;
  display_name: string | null;
};

type AdultStudentNameRow = {
  id: string;
  name: string | null;
};

function getStatusMeta(status: string) {
  switch (status) {
    case "active":
      return {
        label: "수강중",
        color: "#067647",
        background: "#ecfdf3",
        border: "#abefc6",
      };

    case "pending":
      return {
        label: "대기",
        color: "#175cd3",
        background: "#eff4ff",
        border: "#b2ccff",
      };

    case "paused":
      return {
        label: "일시중지",
        color: "#93370d",
        background: "#fffaeb",
        border: "#fedf89",
      };

    case "completed":
      return {
        label: "수강완료",
        color: "#475467",
        background: "#f2f4f7",
        border: "#d0d5dd",
      };

    case "cancelled":
    case "canceled":
      return {
        label: "취소",
        color: "#b42318",
        background: "#fef3f2",
        border: "#fecdca",
      };

    default:
      return {
        label: status,
        color: "#475467",
        background: "#f2f4f7",
        border: "#d0d5dd",
      };
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function AdminEnrollmentsPage({
  searchParams,
}: PageProps) {
  const filters = await searchParams;

  const q = (filters.q ?? "").trim().toLowerCase();
  const target = filters.target ?? "";
  const courseFilter = filters.course ?? "";
  const teacherFilter = filters.teacher ?? "";
  const statusFilter = filters.status ?? "";

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

  const {
    data: enrollmentsData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(`
      id,
      student_user_id,
      child_id,
      course_id,
      teacher_user_id,
      status,
      start_date,
      end_date,
      lessons_per_week,
      total_lessons,
      created_at
    `)
    .order("created_at", {
      ascending: false,
    });

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  const enrollments =
    (enrollmentsData ?? []) as EnrollmentRow[];

  const {
    data: childrenData,
    error: childrenError,
  } = await supabase
    .from("children")
    .select(`
      id,
      name,
      grade,
      school_name
    `);

  if (childrenError) {
    throw new Error(childrenError.message);
  }

  const children =
    (childrenData ?? []) as ChildRow[];

  const {
    data: coursesData,
    error: coursesError,
  } = await supabase
    .from("courses")
    .select("id, name")
    .order("name");

  if (coursesError) {
    throw new Error(coursesError.message);
  }

  const courses =
    (coursesData ?? []) as CourseRow[];

  const {
    data: teachersData,
    error: teachersError,
  } = await supabase
    .from("teacher_profiles")
    .select(`
      user_id,
      display_name
    `)
    .order("display_name");

  if (teachersError) {
    throw new Error(teachersError.message);
  }

  const teachers =
    (teachersData ?? []) as TeacherRow[];

  const {
    data: studentProfiles,
    error: studentsError,
  } = await supabase
    .from("student_profiles")
    .select("user_id");

  if (studentsError) {
    throw new Error(studentsError.message);
  }

  const studentIds =
    studentProfiles?.map(
      (student) => student.user_id
    ) ?? [];

  let adultStudentNames: AdultStudentNameRow[] = [];

  if (studentIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", studentIds);

    if (error) {
      throw new Error(error.message);
    }

    adultStudentNames =
      (data ?? []) as AdultStudentNameRow[];
  }

  function getChild(childId: number | null) {
    if (!childId) {
      return null;
    }

    return (
      children.find(
        (item) => item.id === childId
      ) ?? null
    );
  }

  function getStudentName(
    childId: number | null,
    studentUserId: string | null
  ) {
    if (childId) {
      const child = getChild(childId);

      return (
        child?.name ||
        `자녀 #${childId}`
      );
    }

    if (studentUserId) {
      const student =
        adultStudentNames.find(
          (item) =>
            item.id === studentUserId
        );

      return (
        student?.name ||
        "성인 학생"
      );
    }

    return "학생 정보 없음";
  }

  function getCourseName(
    courseId: number
  ) {
    const course =
      courses.find(
        (item) => item.id === courseId
      );

    return (
      course?.name ||
      `과정 #${courseId}`
    );
  }

  function getTeacherName(
    teacherUserId: string | null
  ) {
    if (!teacherUserId) {
      return "미배정";
    }

    const teacher =
      teachers.find(
        (item) =>
          item.user_id ===
          teacherUserId
      );

    return (
      teacher?.display_name ||
      "이름 미등록 강사"
    );
  }

  function getTargetGroup(
    childId: number | null,
    studentUserId: string | null
  ) {
    if (!childId && studentUserId) {
      return "adult";
    }

    const child =
      getChild(childId);

    if (!child) {
      return "unknown";
    }

    const grade =
      (child.grade ?? "")
        .trim()
        .toLowerCase();

    if (!grade) {
      return "unknown";
    }

    if (
      grade.includes("영아") ||
      grade.includes("유아") ||
      grade.includes("유치") ||
      grade.includes("어린이집") ||
      grade.includes("preschool") ||
      grade.includes("kindergarten")
    ) {
      return "preschool";
    }

    if (
      grade.includes("초") ||
      grade.includes("elementary")
    ) {
      return "elementary";
    }

    if (
      grade.includes("중") ||
      grade.includes("middle")
    ) {
      return "middle";
    }

    if (
      grade.includes("고") ||
      grade.includes("high")
    ) {
      return "high";
    }

    return "unknown";
  }

  function getTargetLabel(
    targetGroup: string
  ) {
    switch (targetGroup) {
      case "preschool":
        return "영유아";
      case "elementary":
        return "초등";
      case "middle":
        return "중등";
      case "high":
        return "고등";
      case "adult":
        return "성인";
      default:
        return "미분류";
    }
  }

  function getStudentMeta(
    enrollment: EnrollmentRow
  ) {
    if (!enrollment.child_id) {
      return getTargetLabel(
        getTargetGroup(
          enrollment.child_id,
          enrollment.student_user_id
        )
      );
    }

    const child =
      getChild(enrollment.child_id);

    const parts = [
      getTargetLabel(
        getTargetGroup(
          enrollment.child_id,
          enrollment.student_user_id
        )
      ),
      child?.school_name,
      child?.grade,
    ].filter(Boolean);

    return parts.join(" · ");
  }

  const totalCount =
    enrollments.length;

  const activeCount =
    enrollments.filter(
      (item) =>
        item.status === "active"
    ).length;

  const pendingCount =
    enrollments.filter(
      (item) =>
        item.status === "pending"
    ).length;

  const pausedCount =
    enrollments.filter(
      (item) =>
        item.status === "paused"
    ).length;

  const completedCount =
    enrollments.filter(
      (item) =>
        item.status === "completed"
    ).length;

  const cancelledCount =
    enrollments.filter(
      (item) =>
        item.status === "cancelled" ||
        item.status === "canceled"
    ).length;

  const filteredEnrollments =
    enrollments.filter(
      (enrollment) => {
        const studentName =
          getStudentName(
            enrollment.child_id,
            enrollment.student_user_id
          );

        const courseName =
          getCourseName(
            enrollment.course_id
          );

        const teacherName =
          getTeacherName(
            enrollment.teacher_user_id
          );

        const targetGroup =
          getTargetGroup(
            enrollment.child_id,
            enrollment.student_user_id
          );

        if (q) {
          const searchText = [
            studentName,
            courseName,
            teacherName,
          ]
            .join(" ")
            .toLowerCase();

          if (
            !searchText.includes(q)
          ) {
            return false;
          }
        }

        if (
          target &&
          targetGroup !== target
        ) {
          return false;
        }

        if (
          courseFilter &&
          String(
            enrollment.course_id
          ) !== courseFilter
        ) {
          return false;
        }

        if (teacherFilter) {
          if (
            teacherFilter ===
            "unassigned"
          ) {
            if (
              enrollment.teacher_user_id
            ) {
              return false;
            }
          } else if (
            enrollment.teacher_user_id !==
            teacherFilter
          ) {
            return false;
          }
        }

        if (
          statusFilter &&
          enrollment.status !==
            statusFilter
        ) {
          return false;
        }

        return true;
      }
    );

  const hasFilter =
    Boolean(
      q ||
        target ||
        courseFilter ||
        teacherFilter ||
        statusFilter
    );

  return (
    <main
      style={{
        maxWidth: "1420px",
        margin: "0 auto",
        padding:
          "34px 22px 80px",
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
          <Link
            href="/admin"
            style={{
              display:
                "inline-flex",
              minHeight: "38px",
              padding: "0 13px",
              alignItems:
                "center",
              border:
                "1px solid #d0d5dd",
              borderRadius: "9px",
              background:
                "#ffffff",
              color: "#344054",
              textDecoration:
                "none",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            ← 관리자 대시보드
          </Link>

          <div
            style={{
              marginTop: "20px",
              color:
                "var(--talkly-blue)",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing:
                "0.12em",
            }}
          >
            ENROLLMENTS
          </div>

          <h1
            style={{
              margin: "6px 0 0",
              color:
                "var(--talkly-navy)",
              fontSize: "32px",
              lineHeight: 1.25,
            }}
          >
            전체 수강 관리
          </h1>

          <p
            style={{
              margin: "9px 0 0",
              color:
                "var(--text-muted)",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            실제 생성된 수강의
            학생, 과정, 담당 강사,
            수강기간 및 진행 상태를
            관리합니다.
          </p>
        </div>

        <Link
          href="/admin/enrollments/new"
          style={{
            display:
              "inline-flex",
            minHeight: "44px",
            padding: "0 16px",
            alignItems:
              "center",
            justifyContent:
              "center",
            border:
              "1px solid #175cd3",
            borderRadius: "10px",
            background:
              "#175cd3",
            color: "#ffffff",
            textDecoration:
              "none",
            fontSize: "12px",
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          + 수강 등록
        </Link>
      </div>

      <section
        style={{
          marginTop: "25px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(145px, 1fr))",
          gap: "10px",
        }}
      >
        <StatCard
          label="전체 수강"
          value={totalCount}
          href="/admin/enrollments"
          active={
            !statusFilter
          }
          tone="navy"
        />

        <StatCard
          label="수강중"
          value={activeCount}
          href="/admin/enrollments?status=active"
          active={
            statusFilter === "active"
          }
          tone="success"
        />

        <StatCard
          label="대기"
          value={pendingCount}
          href="/admin/enrollments?status=pending"
          active={
            statusFilter === "pending"
          }
          tone="blue"
        />

        <StatCard
          label="일시중지"
          value={pausedCount}
          href="/admin/enrollments?status=paused"
          active={
            statusFilter === "paused"
          }
          tone="warning"
        />

        <StatCard
          label="수강완료"
          value={completedCount}
          href="/admin/enrollments?status=completed"
          active={
            statusFilter === "completed"
          }
          tone="gray"
        />

        <StatCard
          label="취소"
          value={cancelledCount}
          href="/admin/enrollments?status=cancelled"
          active={
            statusFilter === "cancelled"
          }
          tone="danger"
        />
      </section>

      <form
        method="GET"
        style={{
          marginTop: "18px",
          padding: "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "14px",
          background: "#ffffff",
          boxShadow:
            "0 8px 24px rgba(16,24,40,0.035)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(220px, 2fr) repeat(4, minmax(130px, 1fr))",
            gap: "9px",
          }}
        >
          <input
            name="q"
            defaultValue={
              filters.q ?? ""
            }
            placeholder="학생명, 과정, 강사 검색"
            style={fieldStyle}
          />

          <select
            name="target"
            defaultValue={target}
            style={fieldStyle}
          >
            <option value="">
              전체 대상
            </option>
            <option value="preschool">
              영유아
            </option>
            <option value="elementary">
              초등
            </option>
            <option value="middle">
              중등
            </option>
            <option value="high">
              고등
            </option>
            <option value="adult">
              성인
            </option>
            <option value="unknown">
              미분류
            </option>
          </select>

          <select
            name="course"
            defaultValue={
              courseFilter
            }
            style={fieldStyle}
          >
            <option value="">
              전체 과정
            </option>

            {courses.map(
              (course) => (
                <option
                  key={course.id}
                  value={course.id}
                >
                  {course.name}
                </option>
              )
            )}
          </select>

          <select
            name="teacher"
            defaultValue={
              teacherFilter
            }
            style={fieldStyle}
          >
            <option value="">
              전체 강사
            </option>

            <option value="unassigned">
              미배정
            </option>

            {teachers.map(
              (teacher) => (
                <option
                  key={
                    teacher.user_id
                  }
                  value={
                    teacher.user_id
                  }
                >
                  {teacher.display_name ||
                    "이름 미등록 강사"}
                </option>
              )
            )}
          </select>

          <select
            name="status"
            defaultValue={
              statusFilter
            }
            style={fieldStyle}
          >
            <option value="">
              전체 상태
            </option>
            <option value="pending">
              대기
            </option>
            <option value="active">
              수강중
            </option>
            <option value="paused">
              일시중지
            </option>
            <option value="completed">
              수강완료
            </option>
            <option value="cancelled">
              취소
            </option>
          </select>
        </div>

        <div
          style={{
            marginTop: "12px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              color: "#667085",
              fontSize: "11px",
            }}
          >
            {hasFilter
              ? `검색 결과 ${filteredEnrollments.length}건`
              : `전체 ${totalCount}건`}
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            {hasFilter && (
              <Link
                href="/admin/enrollments"
                style={{
                  display:
                    "inline-flex",
                  minHeight: "40px",
                  padding:
                    "0 14px",
                  alignItems:
                    "center",
                  border:
                    "1px solid #d0d5dd",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  color:
                    "#475467",
                  textDecoration:
                    "none",
                  fontSize:
                    "11px",
                  fontWeight: 800,
                }}
              >
                초기화
              </Link>
            )}

            <button
              type="submit"
              style={{
                minHeight: "40px",
                padding:
                  "0 16px",
                border: 0,
                borderRadius:
                  "8px",
                background:
                  "#0A1F44",
                color: "#ffffff",
                fontFamily:
                  "inherit",
                fontSize:
                  "11px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              검색
            </button>
          </div>
        </div>
      </form>

      <section
        style={{
          marginTop: "18px",
          border:
            "1px solid #e4e7ec",
          borderRadius: "16px",
          background: "#ffffff",
          overflow: "hidden",
          boxShadow:
            "0 8px 26px rgba(16,24,40,0.04)",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom:
              "1px solid #eaecf0",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: "12px",
            flexWrap: "wrap",
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
              수강 목록
            </h2>

            <div
              style={{
                marginTop: "4px",
                color: "#98a2b3",
                fontSize: "10px",
              }}
            >
              실제 생성된 enrollment
              기준
            </div>
          </div>

          <div
            style={{
              color: "#667085",
              fontSize: "10px",
            }}
          >
            현재 표시{" "}
            <strong
              style={{
                color: "#344054",
              }}
            >
              {filteredEnrollments.length}
            </strong>
            건
          </div>
        </div>

        {filteredEnrollments.length === 0 ? (
          <div
            style={{
              padding: "58px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: "#344054",
                fontSize: "13px",
                fontWeight: 800,
              }}
            >
              {hasFilter
                ? "검색 조건에 해당하는 수강정보가 없습니다."
                : "아직 등록된 수강정보가 없습니다."}
            </div>

            <div
              style={{
                marginTop: "5px",
                color: "#98a2b3",
                fontSize: "10px",
              }}
            >
              새로운 수강은 결제 완료 후
              실제 수강으로 전환됩니다.
            </div>
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <div
              style={{
                minWidth: "1000px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1.45fr 1.15fr 1.05fr .8fr 1.15fr .75fr .8fr 82px",
                  gap: "12px",
                  minHeight: "46px",
                  alignItems: "center",
                  padding: "0 18px",
                  background: "#f9fafb",
                  borderBottom:
                    "1px solid #eaecf0",
                  color: "#667085",
                  fontSize: "10px",
                  fontWeight: 900,
                }}
              >
                <div>학생</div>
                <div>과정</div>
                <div>담당 강사</div>
                <div>수업</div>
                <div>수강기간</div>
                <div>총 수업</div>
                <div>상태</div>
                <div>관리</div>
              </div>

              {filteredEnrollments.map(
                (enrollment) => {
                  const statusMeta =
                    getStatusMeta(
                      enrollment.status
                    );

                  const studentName =
                    getStudentName(
                      enrollment.child_id,
                      enrollment.student_user_id
                    );

                  const studentMeta =
                    getStudentMeta(
                      enrollment
                    );

                  const courseName =
                    getCourseName(
                      enrollment.course_id
                    );

                  const teacherName =
                    getTeacherName(
                      enrollment.teacher_user_id
                    );

                  return (
                    <div
                      key={enrollment.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "1.45fr 1.15fr 1.05fr .8fr 1.15fr .75fr .8fr 82px",
                        gap: "12px",
                        minHeight: "84px",
                        alignItems:
                          "center",
                        padding: "0 18px",
                        borderBottom:
                          "1px solid #f0f2f5",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#101828",
                            fontSize: "12px",
                            fontWeight: 900,
                          }}
                        >
                          {studentName}
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "#98a2b3",
                            fontSize: "9px",
                            lineHeight: 1.45,
                          }}
                        >
                          {studentMeta || "미분류"}
                        </div>

                        <div
                          style={{
                            marginTop: "3px",
                            color: "#c0c5cc",
                            fontSize: "8px",
                          }}
                        >
                          enrollment #{enrollment.id} · 등록 {formatCreatedAt(enrollment.created_at)}
                        </div>
                      </div>

                      <div
                        style={{
                          color: "#344054",
                          fontSize: "11px",
                          fontWeight: 800,
                          lineHeight: 1.5,
                        }}
                      >
                        {courseName}
                      </div>

                      <div>
                        <div
                          style={{
                            color:
                              enrollment.teacher_user_id
                                ? "#344054"
                                : "#98a2b3",
                            fontSize: "11px",
                            fontWeight:
                              enrollment.teacher_user_id
                                ? 800
                                : 600,
                          }}
                        >
                          {teacherName}
                        </div>
                      </div>

                      <div>
                        <MiniBadge>
                          주{" "}
                          {enrollment.lessons_per_week ??
                            "-"}
                          회
                        </MiniBadge>
                      </div>

                      <div
                        style={{
                          color: "#475467",
                          fontSize: "10px",
                          lineHeight: 1.55,
                        }}
                      >
                        <strong
                          style={{
                            color: "#344054",
                          }}
                        >
                          {formatDate(
                            enrollment.start_date
                          )}
                        </strong>
                        <br />
                        ~{" "}
                        {formatDate(
                          enrollment.end_date
                        )}
                      </div>

                      <div>
                        <div
                          style={{
                            color: "#344054",
                            fontSize: "12px",
                            fontWeight: 900,
                          }}
                        >
                          {enrollment.total_lessons ??
                            "-"}
                          회
                        </div>

                        <div
                          style={{
                            marginTop: "3px",
                            color: "#98a2b3",
                            fontSize: "9px",
                          }}
                        >
                          총 예정
                        </div>
                      </div>

                      <div>
                        <span
                          style={{
                            display:
                              "inline-flex",
                            minHeight: "28px",
                            padding: "0 9px",
                            alignItems:
                              "center",
                            border:
                              `1px solid ${statusMeta.border}`,
                            borderRadius:
                              "999px",
                            background:
                              statusMeta.background,
                            color:
                              statusMeta.color,
                            fontSize: "10px",
                            fontWeight: 900,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div>
                        <Link
                          href={`/admin/enrollments/${enrollment.id}`}
                          style={{
                            display:
                              "inline-flex",
                            minHeight: "34px",
                            padding: "0 11px",
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
                            color: "#344054",
                            textDecoration:
                              "none",
                            fontSize: "10px",
                            fontWeight: 900,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          상세
                        </Link>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {filteredEnrollments.length > 0 && (
          <div
            style={{
              padding: "13px 18px",
              borderTop:
                "1px solid #eaecf0",
              background: "#fcfcfd",
              color: "#667085",
              fontSize: "10px",
              lineHeight: 1.6,
            }}
          >
            현재 화면은 enrollments의
            확정 수강정보를 기준으로
            표시합니다. 실제 수업 진행횟수와
            요일·시간은 다음 단계에서
            class_sessions 및 class_schedules와
            연결하여 확장합니다.
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  href,
  active,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  active: boolean;
  tone:
    | "navy"
    | "success"
    | "blue"
    | "warning"
    | "gray"
    | "danger";
}) {
  const palette =
    tone === "success"
      ? {
          accent: "#067647",
          soft: "#ecfdf3",
          border: "#abefc6",
        }
      : tone === "blue"
      ? {
          accent: "#175cd3",
          soft: "#eff4ff",
          border: "#b2ccff",
        }
      : tone === "warning"
      ? {
          accent: "#93370d",
          soft: "#fffaeb",
          border: "#fedf89",
        }
      : tone === "danger"
      ? {
          accent: "#b42318",
          soft: "#fef3f2",
          border: "#fecdca",
        }
      : tone === "gray"
      ? {
          accent: "#475467",
          soft: "#f2f4f7",
          border: "#d0d5dd",
        }
      : {
          accent: "#0A1F44",
          soft: "#f5f8ff",
          border: "#c7d7fe",
        };

  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "17px",
        border:
          `1px solid ${
            active
              ? palette.accent
              : palette.border
          }`,
        borderRadius: "13px",
        background:
          active
            ? palette.soft
            : "#ffffff",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <div
        style={{
          color: "#667085",
          fontSize: "10px",
          fontWeight: 800,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          color: palette.accent,
          fontSize: "27px",
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </Link>
  );
}

function MiniBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display:
          "inline-flex",
        minHeight: "25px",
        padding: "0 8px",
        alignItems:
          "center",
        border:
          "1px solid #e4e7ec",
        borderRadius: "6px",
        background: "#f9fafb",
        color: "#475467",
        fontSize: "9px",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "42px",
  boxSizing: "border-box",
  padding: "0 11px",
  border:
    "1px solid #d0d5dd",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#101828",
  fontFamily: "inherit",
  fontSize: "11px",
  outline: "none",
};