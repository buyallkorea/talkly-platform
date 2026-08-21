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

  /*
   * 수강정보
   */
  const {
    data: enrollments,
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

  /*
   * 자녀
   */
  const {
    data: children,
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

  /*
   * 과정
   */
  const {
    data: courses,
    error: coursesError,
  } = await supabase
    .from("courses")
    .select("id, name")
    .order("name");

  if (coursesError) {
    throw new Error(coursesError.message);
  }

  /*
   * 강사
   */
  const {
    data: teachers,
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

  /*
   * 성인 학생
   */
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

  let adultStudentNames: {
    id: string;
    name: string | null;
  }[] = [];

  if (studentIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", studentIds);

    if (error) {
      throw new Error(error.message);
    }

    adultStudentNames = data ?? [];
  }

  /*
   * 조회용 함수
   */
  function getChild(childId: number | null) {
    if (!childId) {
      return null;
    }

    return (
      children?.find(
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
    const course = courses?.find(
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

    const teacher = teachers?.find(
      (item) =>
        item.user_id ===
        teacherUserId
    );

    return (
      teacher?.display_name ||
      "이름 미등록 강사"
    );
  }

  function getStatusLabel(
    status: string
  ) {
    switch (status) {
      case "pending":
        return "대기";

      case "active":
        return "수강중";

      case "completed":
        return "수강완료";

      case "cancelled":
        return "취소";

      case "paused":
        return "일시중지";

      default:
        return status;
    }
  }

  /*
   * 자녀 학년을 관리용 대상 그룹으로 변환
   *
   * 현재 DB를 변경하지 않고 기존 grade를 이용합니다.
   */
  function getTargetGroup(
    childId: number | null,
    studentUserId: string | null
  ) {
    /*
     * 자녀가 없는 학생 수강은
     * 현재 구조상 성인 학생으로 봅니다.
     */
    if (!childId && studentUserId) {
      return "adult";
    }

    const child = getChild(childId);

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

    /*
     * 영유아 / 유치원
     */
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

    /*
     * 초등
     */
    if (
      grade.includes("초") ||
      grade.includes("elementary")
    ) {
      return "elementary";
    }

    /*
     * 중등
     */
    if (
      grade.includes("중") ||
      grade.includes("middle")
    ) {
      return "middle";
    }

    /*
     * 고등
     */
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

  /*
   * 통계
   *
   * 검색 결과가 아니라 전체 수강을 기준으로 표시합니다.
   */
  const totalCount =
    enrollments?.length ?? 0;

  const activeCount =
    enrollments?.filter(
      (item) =>
        item.status === "active"
    ).length ?? 0;

  const pendingCount =
    enrollments?.filter(
      (item) =>
        item.status === "pending"
    ).length ?? 0;

  const pausedCount =
    enrollments?.filter(
      (item) =>
        item.status === "paused"
    ).length ?? 0;

  const completedCount =
    enrollments?.filter(
      (item) =>
        item.status === "completed"
    ).length ?? 0;

  const cancelledCount =
    enrollments?.filter(
      (item) =>
        item.status === "cancelled"
    ).length ?? 0;

  /*
   * 검색 / 필터
   */
  const filteredEnrollments =
    (enrollments ?? []).filter(
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

        /*
         * 통합 검색
         */
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

        /*
         * 대상
         */
        if (
          target &&
          targetGroup !== target
        ) {
          return false;
        }

        /*
         * 과정
         */
        if (
          courseFilter &&
          String(
            enrollment.course_id
          ) !== courseFilter
        ) {
          return false;
        }

        /*
         * 강사
         */
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

        /*
         * 상태
         */
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
        padding: "40px",
        maxWidth: "1180px",
        margin: "0 auto",
      }}
    >
      {/* 제목 */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: "20px",
          marginBottom: "28px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "34px",
              letterSpacing:
                "-0.03em",
            }}
          >
            전체 수강 관리
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              opacity: 0.6,
            }}
          >
            학생과 자녀의 수강,
            담당 강사 및 진행 상태를
            관리합니다.
          </p>
        </div>

        <Link
          href="/admin/enrollments/new"
          style={{
            padding: "13px 18px",
            border:
              "1px solid rgba(15,39,76,.15)",
            borderRadius: "10px",
            textDecoration: "none",
            fontWeight: 800,
            whiteSpace: "nowrap",
            color: "inherit",
            background: "#ffffff",
          }}
        >
          + 수강 등록
        </Link>
      </div>

      {/* 통계 */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(140px,1fr))",
          gap: "12px",
          marginBottom: "22px",
        }}
      >
        <StatCard
          label="전체 수강"
          value={totalCount}
        />

        <StatCard
          label="수강중"
          value={activeCount}
        />

        <StatCard
          label="대기"
          value={pendingCount}
        />

        <StatCard
          label="일시중지"
          value={pausedCount}
        />

        <StatCard
          label="수강완료"
          value={completedCount}
        />

        <StatCard
          label="취소"
          value={cancelledCount}
        />
      </div>

      {/* 검색 */}

      <form
        method="GET"
        style={{
          padding: "20px",
          border:
            "1px solid rgba(15,39,76,.12)",
          borderRadius: "14px",
          background: "#ffffff",
          marginBottom: "22px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(220px,2fr) repeat(4,minmax(130px,1fr))",
            gap: "10px",
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

            {(courses ?? []).map(
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

            {(teachers ?? []).map(
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
              fontSize: "13px",
              opacity: 0.55,
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
                  minHeight: "42px",
                  padding: "0 16px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent:
                    "center",
                  border:
                    "1px solid rgba(15,39,76,.15)",
                  borderRadius: "9px",
                  textDecoration:
                    "none",
                  color: "inherit",
                  fontWeight: 700,
                  background:
                    "#ffffff",
                }}
              >
                초기화
              </Link>
            )}

            <button
              type="submit"
              style={{
                minHeight: "42px",
                padding: "0 20px",
                border: 0,
                borderRadius: "9px",
                background:
                  "#0b2855",
                color: "#ffffff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              검색
            </button>
          </div>
        </div>
      </form>

      {/* 목록 */}

      {filteredEnrollments.length ===
      0 ? (
        <div
          style={{
            padding: "50px 30px",
            border:
              "1px solid rgba(15,39,76,.12)",
            borderRadius: "14px",
            background: "#ffffff",
            textAlign: "center",
          }}
        >
          {hasFilter
            ? "검색 조건에 해당하는 수강정보가 없습니다."
            : "아직 등록된 수강정보가 없습니다."}
        </div>
      ) : (
        <div
          style={{
            border:
              "1px solid rgba(15,39,76,.12)",
            borderRadius: "14px",
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          {/* 헤더 */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.25fr .75fr 1.2fr 1fr .75fr 1.25fr .8fr 70px",
              gap: "12px",
              padding: "15px 18px",
              fontSize: "12px",
              fontWeight: 800,
              opacity: 0.55,
              borderBottom:
                "1px solid rgba(15,39,76,.1)",
            }}
          >
            <div>학생</div>
            <div>대상</div>
            <div>과정</div>
            <div>담당 강사</div>
            <div>수업</div>
            <div>수강기간</div>
            <div>상태</div>
            <div />
          </div>

          {filteredEnrollments.map(
            (enrollment) => {
              const targetGroup =
                getTargetGroup(
                  enrollment.child_id,
                  enrollment.student_user_id
                );

              return (
                <div
                  key={enrollment.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1.25fr .75fr 1.2fr 1fr .75fr 1.25fr .8fr 70px",
                    gap: "12px",
                    padding:
                      "18px",
                    alignItems:
                      "center",
                    borderBottom:
                      "1px solid rgba(15,39,76,.08)",
                  }}
                >
                  <div
                    style={{
                      fontWeight:
                        800,
                    }}
                  >
                    {getStudentName(
                      enrollment.child_id,
                      enrollment.student_user_id
                    )}
                  </div>

                  <div>
                    <TargetBadge
                      label={getTargetLabel(
                        targetGroup
                      )}
                    />
                  </div>

                  <div>
                    {getCourseName(
                      enrollment.course_id
                    )}
                  </div>

                  <div>
                    {getTeacherName(
                      enrollment.teacher_user_id
                    )}
                  </div>

                  <div>
                    주{" "}
                    {enrollment.lessons_per_week ??
                      "-"}
                    회
                  </div>

                  <div
                    style={{
                      fontSize:
                        "13px",
                    }}
                  >
                    {enrollment.start_date ||
                      "-"}
                    <br />
                    ~{" "}
                    {enrollment.end_date ||
                      "-"}
                  </div>

                  <div>
                    <StatusBadge
                      status={
                        enrollment.status
                      }
                      label={getStatusLabel(
                        enrollment.status
                      )}
                    />
                  </div>

                  <div>
                    <Link
                      href={`/admin/enrollments/${enrollment.id}`}
                      style={{
                        textDecoration:
                          "none",
                        color:
                          "#0b2855",
                        fontWeight:
                          800,
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      상세 →
                    </Link>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding: "18px 20px",
        minHeight: "88px",
        border:
          "1px solid rgba(15,39,76,.12)",
        borderRadius: "13px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          opacity: 0.55,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "27px",
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TargetBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "27px",
        padding: "0 9px",
        borderRadius: "999px",
        background:
          "rgba(47,111,237,.10)",
        color: "#2f6fed",
        fontSize: "12px",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
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
    "rgba(15,39,76,.08)";
  let color = "#526071";

  if (status === "active") {
    background =
      "rgba(24,160,88,.10)";
    color = "#16854c";
  }

  if (status === "pending") {
    background =
      "rgba(47,111,237,.10)";
    color = "#2f6fed";
  }

  if (status === "paused") {
    background =
      "rgba(221,143,0,.12)";
    color = "#a66b00";
  }

  if (status === "cancelled") {
    background =
      "rgba(217,48,37,.10)";
    color = "#c2382f";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "27px",
        padding: "0 9px",
        borderRadius: "999px",
        background,
        color,
        fontSize: "12px",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

const fieldStyle = {
  width: "100%",
  minHeight: "44px",
  boxSizing:
    "border-box" as const,
  padding: "0 12px",
  border:
    "1px solid rgba(15,39,76,.15)",
  borderRadius: "9px",
  background: "#ffffff",
  color: "inherit",
  fontFamily: "inherit",
};