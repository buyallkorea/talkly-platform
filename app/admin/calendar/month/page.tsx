import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams: Promise<{
    month?: string;
    date?: string;
    teacher?: string;
    status?: string;
    q?: string;
  }>;
};

type ClassSession = {
  id: number;
  enrollment_id: number;
  lesson_number: number;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

type Enrollment = {
  id: number;
  child_id: number | null;
  student_user_id: string | null;
  course_id: number;
  teacher_user_id: string | null;
};

type Teacher = {
  user_id: string;
  display_name: string | null;
};

type Attendance = {
  class_session_id: number;
  status: string;
};

type Evaluation = {
  class_session_id: number;
};

function formatDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatMonthKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(value);
}

function formatMonthTitle(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
  }).format(value);
}

function formatDayNumber(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    day: "numeric",
  }).format(value);
}

function formatDateTitle(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function addMonths(value: Date, amount: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + amount);
  return date;
}

function getMonthStart(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    1
  );
}

function getMonthEnd(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth() + 1,
    1
  );
}

function getCalendarStart(monthStart: Date) {
  const day = monthStart.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(monthStart, mondayOffset);
}

function getSessionStatusLabel(status: string) {
  switch (status) {
    case "scheduled":
      return "예정";
    case "completed":
      return "완료";
    case "cancelled":
      return "취소";
    case "held":
      return "결석 승인";
    case "no_show":
      return "무단결석";
    default:
      return status;
  }
}

function getAttendanceStatusLabel(status: string) {
  switch (status) {
    case "present":
      return "출석";
    case "late":
      return "지각";
    case "absent":
      return "결석";
    case "excused":
      return "인정결석";
    case "teacher_absent":
      return "강사결석";
    default:
      return status;
  }
}

function getStatusAccent(status: string) {
  switch (status) {
    case "scheduled":
      return "rgba(96,165,250,0.9)";
    case "completed":
      return "rgba(74,222,128,0.9)";
    case "held":
      return "rgba(251,146,60,0.9)";
    case "no_show":
      return "rgba(248,113,113,0.9)";
    case "cancelled":
      return "rgba(156,163,175,0.9)";
    default:
      return "rgba(255,255,255,0.45)";
  }
}

export default async function AdminMonthCalendarPage({
  searchParams,
}: PageProps) {
  const {
    month,
    date,
    teacher = "all",
    status = "all",
    q = "",
  } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    redirect("/");
  }

  const now = new Date();

  const selectedMonth = month
    ? new Date(`${month}-01T00:00:00+09:00`)
    : getMonthStart(now);

  const monthStart = getMonthStart(selectedMonth);
  const monthEnd = getMonthEnd(selectedMonth);

  const calendarStart = getCalendarStart(monthStart);
  const calendarEnd = addDays(calendarStart, 42);

  const selectedDateKey =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : formatDateKey(now);

  const [
    sessionsResult,
    teachersResult,
  ] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(`
        id,
        enrollment_id,
        lesson_number,
        scheduled_start,
        scheduled_end,
        status
      `)
      .gte("scheduled_start", calendarStart.toISOString())
      .lt("scheduled_start", calendarEnd.toISOString())
      .order("scheduled_start", { ascending: true }),

    supabase
      .from("teacher_profiles")
      .select("user_id, display_name")
      .order("display_name", { ascending: true }),
  ]);

  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message);
  }

  if (teachersResult.error) {
    throw new Error(teachersResult.error.message);
  }

  const sessions =
    (sessionsResult.data ?? []) as ClassSession[];

  const teachers =
    (teachersResult.data ?? []) as Teacher[];

  const enrollmentIds = Array.from(
    new Set(
      sessions.map(
        (session) => session.enrollment_id
      )
    )
  );

  let enrollments: Enrollment[] = [];

  if (enrollmentIds.length > 0) {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        child_id,
        student_user_id,
        course_id,
        teacher_user_id
      `)
      .in("id", enrollmentIds);

    if (error) {
      throw new Error(error.message);
    }

    enrollments = (data ?? []) as Enrollment[];
  }

  const childIds = Array.from(
    new Set(
      enrollments
        .map((item) => item.child_id)
        .filter(
          (value): value is number =>
            value !== null
        )
    )
  );

  const studentIds = Array.from(
    new Set(
      enrollments
        .map(
          (item) =>
            item.student_user_id
        )
        .filter(
          (value): value is string =>
            Boolean(value)
        )
    )
  );

  const courseIds = Array.from(
    new Set(
      enrollments.map(
        (item) => item.course_id
      )
    )
  );

  const sessionIds = sessions.map(
    (session) => session.id
  );

  const [
    childrenResult,
    studentsResult,
    coursesResult,
    attendanceResult,
    evaluationsResult,
  ] = await Promise.all([
    childIds.length > 0
      ? supabase
          .from("children")
          .select("id, name")
          .in("id", childIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, name")
          .in("id", studentIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    courseIds.length > 0
      ? supabase
          .from("courses")
          .select("id, name")
          .in("id", courseIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    sessionIds.length > 0
      ? supabase
          .from("attendance")
          .select(`
            class_session_id,
            status
          `)
          .in(
            "class_session_id",
            sessionIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),

    sessionIds.length > 0
      ? supabase
          .from("evaluations")
          .select("class_session_id")
          .in(
            "class_session_id",
            sessionIds
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  const lookupError =
    childrenResult.error ||
    studentsResult.error ||
    coursesResult.error ||
    attendanceResult.error ||
    evaluationsResult.error;

  if (lookupError) {
    throw new Error(
      lookupError.message
    );
  }

  const enrollmentMap = new Map(
    enrollments.map((item) => [
      item.id,
      item,
    ])
  );

  const childMap = new Map(
    (childrenResult.data ?? []).map(
      (item) => [
        item.id,
        item.name,
      ]
    )
  );

  const studentMap = new Map(
    (studentsResult.data ?? []).map(
      (item) => [
        item.id,
        item.name || "성인 학생",
      ]
    )
  );

  const courseMap = new Map(
    (coursesResult.data ?? []).map(
      (item) => [
        item.id,
        item.name,
      ]
    )
  );

  const teacherMap = new Map(
    teachers.map((item) => [
      item.user_id,
      item.display_name ||
        "이름 미등록 강사",
    ])
  );

  const attendanceMap = new Map(
    (
      (attendanceResult.data ??
        []) as Attendance[]
    ).map((item) => [
      item.class_session_id,
      item.status,
    ])
  );

  const evaluationSet = new Set(
    (
      (evaluationsResult.data ??
        []) as Evaluation[]
    ).map(
      (item) =>
        item.class_session_id
    )
  );

  function getStudentName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(enrollmentId);

    if (!enrollment) {
      return "학생 정보 없음";
    }

    if (enrollment.child_id) {
      return (
        childMap.get(
          enrollment.child_id
        ) || "자녀 정보 없음"
      );
    }

    if (enrollment.student_user_id) {
      return (
        studentMap.get(
          enrollment.student_user_id
        ) || "성인 학생"
      );
    }

    return "학생 정보 없음";
  }

  function getCourseName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(enrollmentId);

    if (!enrollment) {
      return "-";
    }

    return (
      courseMap.get(
        enrollment.course_id
      ) || "-"
    );
  }

  function getTeacherName(
    enrollmentId: number
  ) {
    const enrollment =
      enrollmentMap.get(enrollmentId);

    if (
      !enrollment?.teacher_user_id
    ) {
      return "미배정";
    }

    return (
      teacherMap.get(
        enrollment.teacher_user_id
      ) || "미배정"
    );
  }

  const normalizedQuery =
    q.trim().toLowerCase();

  const filteredSessions =
    sessions.filter((session) => {
      const enrollment =
        enrollmentMap.get(
          session.enrollment_id
        );

      const matchesSearch =
        !normalizedQuery ||
        [
          getStudentName(
            session.enrollment_id
          ),
          getTeacherName(
            session.enrollment_id
          ),
          getCourseName(
            session.enrollment_id
          ),
        ].some((value) =>
          value
            .toLowerCase()
            .includes(
              normalizedQuery
            )
        );

      const matchesTeacher =
        teacher === "all" ||
        enrollment?.teacher_user_id ===
          teacher;

      const matchesStatus =
        status === "all" ||
        session.status === status;

      return (
        matchesSearch &&
        matchesTeacher &&
        matchesStatus
      );
    });

  const monthSessions =
    filteredSessions.filter(
      (session) => {
        const start = new Date(
          session.scheduled_start
        );

        return (
          start >= monthStart &&
          start < monthEnd
        );
      }
    );

  const sessionsByDate = new Map<
    string,
    ClassSession[]
  >();

  for (
    let index = 0;
    index < 42;
    index += 1
  ) {
    const day = addDays(
      calendarStart,
      index
    );

    sessionsByDate.set(
      formatDateKey(day),
      []
    );
  }

  for (const session of filteredSessions) {
    const key = formatDateKey(
      new Date(
        session.scheduled_start
      )
    );

    const list =
      sessionsByDate.get(key) ?? [];

    list.push(session);

    sessionsByDate.set(key, list);
  }

  const calendarDays =
    Array.from(
      { length: 42 },
      (_, index) =>
        addDays(
          calendarStart,
          index
        )
    );

  const selectedDate =
    new Date(
      `${selectedDateKey}T00:00:00+09:00`
    );

  const selectedDateSessions =
    (
      sessionsByDate.get(
        selectedDateKey
      ) ?? []
    ).sort(
      (a, b) =>
        new Date(
          a.scheduled_start
        ).getTime() -
        new Date(
          b.scheduled_start
        ).getTime()
    );

  const previousMonth =
    formatMonthKey(
      addMonths(monthStart, -1)
    );

  const nextMonth =
    formatMonthKey(
      addMonths(monthStart, 1)
    );

  const currentMonth =
    formatMonthKey(now);

  const scheduledCount =
    monthSessions.filter(
      (session) =>
        session.status ===
        "scheduled"
    ).length;

  const completedCount =
    monthSessions.filter(
      (session) =>
        session.status ===
        "completed"
    ).length;

  const heldCount =
    monthSessions.filter(
      (session) =>
        session.status === "held"
    ).length;

  const absentCount =
    monthSessions.filter(
      (session) =>
        session.status ===
        "no_show"
    ).length;

  const cancelledCount =
    monthSessions.filter(
      (session) =>
        session.status ===
        "cancelled"
    ).length;

  function buildMonthUrl(
    targetMonth: string,
    targetDate?: string
  ) {
    const params = new URLSearchParams();

    params.set("month", targetMonth);

    if (targetDate) {
      params.set("date", targetDate);
    }

    if (q) {
      params.set("q", q);
    }

    if (teacher !== "all") {
      params.set(
        "teacher",
        teacher
      );
    }

    if (status !== "all") {
      params.set(
        "status",
        status
      );
    }

    return `/admin/calendar/month?${params.toString()}`;
  }

  const missingAttendanceCount = monthSessions.filter(
    (session) =>
      session.status === "completed" &&
      !attendanceMap.has(session.id)
  ).length;

  const missingEvaluationCount = monthSessions.filter(
    (session) =>
      session.status === "completed" &&
      !evaluationSet.has(session.id)
  ).length;

  return (
    <main style={{ width:"100%", maxWidth:"1500px", margin:"0 auto", padding:"52px 40px 90px" }}>
      <section style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"20px", flexWrap:"wrap" }}>
        <div>
          <div style={{ color:"#2f6fed", fontSize:"12px", fontWeight:900, letterSpacing:"0.08em" }}>MONTHLY CLASS OPERATION</div>
          <h1 style={{ margin:"10px 0 0", color:"#101828", fontSize:"36px", lineHeight:1.2, letterSpacing:"-0.04em" }}>월간 수업 캘린더</h1>
          <p style={{ margin:"13px 0 0", color:"#667085", fontSize:"15px", lineHeight:1.7 }}>월 전체 수업 일정과 날짜별 운영 현황을 한눈에 확인합니다.</p>
        </div>
        <div style={{ minHeight:"44px", padding:"0 16px", display:"inline-flex", alignItems:"center", border:"1px solid #d0d5dd", borderRadius:"10px", background:"#fff", color:"#344054", fontSize:"13px", fontWeight:900 }}>
          {formatMonthTitle(monthStart)}
        </div>
      </section>

      <section style={{ marginTop:"26px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          <Link href="/admin/calendar" style={tabStyle}>오늘</Link>
          <Link href="/admin/calendar/week" style={tabStyle}>주간</Link>
          <Link href={buildMonthUrl(formatMonthKey(monthStart), selectedDateKey)} style={{...tabStyle, background:"#0A1F44", color:"#fff", borderColor:"#0A1F44"}}>월간</Link>
        </div>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          <Link href={buildMonthUrl(previousMonth)} style={secondaryButtonStyle}>← 이전 달</Link>
          <Link href={buildMonthUrl(currentMonth, formatDateKey(now))} style={secondaryButtonStyle}>이번 달</Link>
          <Link href={buildMonthUrl(nextMonth)} style={secondaryButtonStyle}>다음 달 →</Link>
        </div>
      </section>

      <section style={{ marginTop:"24px", display:"grid", gridTemplateColumns:"repeat(6, minmax(0, 1fr))", gap:"12px" }}>
        <SummaryCard label="이번 달 전체" value={monthSessions.length} />
        <SummaryCard label="예정" value={scheduledCount} />
        <SummaryCard label="완료" value={completedCount} />
        <SummaryCard label="결석 승인" value={heldCount} />
        <SummaryCard label="무단결석" value={absentCount} />
        <SummaryCard label="취소" value={cancelledCount} />
      </section>

      <section style={{ marginTop:"12px", display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:"12px" }}>
        <AlertCard label="출결 미처리" value={missingAttendanceCount} warning={missingAttendanceCount > 0} />
        <AlertCard label="평가 미작성" value={missingEvaluationCount} warning={missingEvaluationCount > 0} />
      </section>

      <form method="get" style={{ marginTop:"22px", padding:"18px", display:"grid", gridTemplateColumns:"minmax(240px,1fr) 200px 180px auto auto", gap:"10px", border:"1px solid #e4e7ec", borderRadius:"14px", background:"#fff" }}>
        <input type="hidden" name="month" value={formatMonthKey(monthStart)} />
        <input type="hidden" name="date" value={selectedDateKey} />
        <input type="search" name="q" defaultValue={q} placeholder="학생명, 강사명, 과정 검색" style={fieldStyle} />
        <select name="teacher" defaultValue={teacher} style={fieldStyle}>
          <option value="all">전체 강사</option>
          {teachers.map((item)=><option key={item.user_id} value={item.user_id}>{item.display_name || "이름 미등록 강사"}</option>)}
        </select>
        <select name="status" defaultValue={status} style={fieldStyle}>
          <option value="all">전체 상태</option><option value="scheduled">예정</option><option value="completed">완료</option><option value="held">결석 승인</option><option value="no_show">무단결석</option><option value="cancelled">취소</option>
        </select>
        <button type="submit" style={{ minHeight:"44px", padding:"0 18px", border:"none", borderRadius:"9px", background:"#0A1F44", color:"#fff", fontWeight:900, cursor:"pointer" }}>검색</button>
        <Link href={`/admin/calendar/month?month=${formatMonthKey(monthStart)}&date=${selectedDateKey}`} style={{...secondaryButtonStyle,minHeight:"44px"}}>초기화</Link>
      </form>

      <section style={{ marginTop:"20px", display:"grid", gridTemplateColumns:"minmax(0,1.9fr) minmax(300px,.7fr)", gap:"18px", alignItems:"start" }}>
        <div style={{ overflowX:"auto", border:"1px solid #e4e7ec", borderRadius:"15px", background:"#fff" }}>
          <div style={{ minWidth:"910px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(130px,1fr))", borderBottom:"1px solid #e4e7ec", background:"#f9fafb" }}>
              {["월","화","수","목","금","토","일"].map(label=><div key={label} style={{ padding:"12px", textAlign:"center", color:"#667085", fontSize:"12px", fontWeight:900, borderRight:"1px solid #eef1f5" }}>{label}</div>)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(130px,1fr))" }}>
              {calendarDays.map((dayItem)=>{
                const key=formatDateKey(dayItem);
                const daySessions=sessionsByDate.get(key) ?? [];
                const inCurrentMonth=dayItem.getMonth()===monthStart.getMonth();
                const isToday=key===formatDateKey(now);
                const isSelected=key===selectedDateKey;
                return (
                  <Link key={key} href={buildMonthUrl(formatMonthKey(monthStart),key)} style={{ minHeight:"150px", padding:"10px", borderRight:"1px solid #eef1f5", borderBottom:"1px solid #eef1f5", color:"inherit", textDecoration:"none", background:isSelected?"#eef4ff":isToday?"#f8faff":"#fff", opacity:inCurrentMonth?1:.42, boxSizing:"border-box" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px" }}>
                      <strong style={{ color:isSelected||isToday?"#2f6fed":"#344054", fontSize:"13px" }}>{formatDayNumber(dayItem)}</strong>
                      {daySessions.length>0 && <span style={{ padding:"3px 6px", borderRadius:"999px", background:"#f2f4f7", color:"#667085", fontSize:"10px", fontWeight:900 }}>{daySessions.length}건</span>}
                    </div>
                    <div style={{ marginTop:"9px", display:"flex", flexDirection:"column", gap:"5px" }}>
                      {daySessions.slice(0,3).map(session=>(
                        <div key={session.id} style={{ display:"grid", gridTemplateColumns:"4px minmax(0,1fr)", gap:"6px", alignItems:"stretch", fontSize:"10px" }}>
                          <span style={{ width:"4px", minHeight:"28px", borderRadius:"999px", background:getStatusAccent(session.status) }} />
                          <div style={{ minWidth:0 }}>
                            <div style={{ color:"#101828", fontWeight:900, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{formatTime(session.scheduled_start)} {getStudentName(session.enrollment_id)}</div>
                            <div style={{ marginTop:"2px", color:"#98a2b3", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{getTeacherName(session.enrollment_id)}</div>
                          </div>
                        </div>
                      ))}
                      {daySessions.length>3 && <div style={{ color:"#667085", fontSize:"10px", fontWeight:800 }}>+{daySessions.length-3}건 더 보기</div>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <aside style={{ padding:"20px", border:"1px solid #e4e7ec", borderRadius:"15px", background:"#fff", position:"sticky", top:"96px" }}>
          <div style={{ color:"#2f6fed", fontSize:"11px", fontWeight:900, letterSpacing:".06em" }}>SELECTED DATE</div>
          <h2 style={{ margin:"8px 0 0", color:"#101828", fontSize:"21px", letterSpacing:"-0.03em" }}>{formatDateTitle(selectedDate)}</h2>
          <p style={{ margin:"8px 0 0", color:"#98a2b3", fontSize:"12px" }}>선택한 날짜의 수업 목록입니다.</p>
          {selectedDateSessions.length===0 ? (
            <div style={{ marginTop:"18px", padding:"28px 18px", border:"1px dashed #d0d5dd", borderRadius:"10px", textAlign:"center", color:"#98a2b3", fontSize:"12px" }}>등록된 수업이 없습니다.</div>
          ) : (
            <div style={{ marginTop:"18px", display:"flex", flexDirection:"column", gap:"10px" }}>
              {selectedDateSessions.map(session=>{
                const attendanceStatus=attendanceMap.get(session.id);
                const hasEvaluation=evaluationSet.has(session.id);
                return (
                  <Link key={session.id} href={`/admin/enrollments/${session.enrollment_id}/lessons/${session.id}`} style={{ display:"block", padding:"14px", border:"1px solid #e4e7ec", borderRadius:"11px", color:"inherit", textDecoration:"none" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px" }}>
                      <strong style={{ color:"#101828", fontSize:"13px" }}>{formatTime(session.scheduled_start)}</strong>
                      <StatusBadge status={session.status} />
                    </div>
                    <div style={{ marginTop:"9px", color:"#101828", fontSize:"14px", fontWeight:900 }}>{getStudentName(session.enrollment_id)}</div>
                    <div style={{ marginTop:"4px", color:"#667085", fontSize:"11px" }}>{getTeacherName(session.enrollment_id)} · {getCourseName(session.enrollment_id)}</div>
                    <div style={{ marginTop:"10px", paddingTop:"9px", borderTop:"1px solid #eef1f5", display:"flex", justifyContent:"space-between", gap:"8px", flexWrap:"wrap" }}>
                      <SmallState label={attendanceStatus?getAttendanceStatusLabel(attendanceStatus):"출결 미등록"} warning={session.status==="completed"&&!attendanceStatus} />
                      <SmallState label={hasEvaluation?"평가 완료":"평가 미작성"} warning={session.status==="completed"&&!hasEvaluation} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function SummaryCard({label,value}:{label:string;value:number}) {
  return <div style={{ minHeight:"105px", padding:"18px", border:"1px solid #e4e7ec", borderRadius:"13px", background:"#fff" }}><div style={{ color:"#667085", fontSize:"12px", fontWeight:800 }}>{label}</div><div style={{ marginTop:"12px", color:"#101828", fontSize:"29px", fontWeight:900 }}>{value}</div></div>;
}
function AlertCard({label,value,warning}:{label:string;value:number;warning:boolean}) {
  return <div style={{ padding:"17px 19px", border:warning?"1px solid #fed7aa":"1px solid #e4e7ec", borderRadius:"13px", background:warning?"#fffaf5":"#fff", display:"flex", justifyContent:"space-between", alignItems:"center" }}><div><div style={{ color:warning?"#b54708":"#667085", fontSize:"13px", fontWeight:900 }}>{label}</div><div style={{ marginTop:"4px", color:"#98a2b3", fontSize:"11px" }}>완료 수업 기준 운영 확인 항목</div></div><div style={{ color:warning?"#b54708":"#101828", fontSize:"27px", fontWeight:900 }}>{value}</div></div>;
}
function StatusBadge({status}:{status:string}) {
  let background="#f2f4f7", color="#475467";
  if(status==="scheduled"){background="#eef4ff";color="#2f6fed";}
  else if(status==="completed"){background="#ecfdf3";color="#027a48";}
  else if(status==="held"){background="#fff7ed";color="#b54708";}
  else if(status==="no_show"||status==="cancelled"){background="#fef3f2";color="#b42318";}
  return <span style={{ minHeight:"24px", padding:"0 7px", display:"inline-flex", alignItems:"center", borderRadius:"999px", background, color, fontSize:"10px", fontWeight:900 }}>{getSessionStatusLabel(status)}</span>;
}
function SmallState({label,warning}:{label:string;warning:boolean}) {
  return <span style={{ color:warning?"#b54708":"#667085", fontSize:"10px", fontWeight:warning?900:700 }}>{label}</span>;
}
const fieldStyle={width:"100%",minWidth:0,boxSizing:"border-box" as const,minHeight:"44px",padding:"0 12px",border:"1px solid #d0d5dd",borderRadius:"9px",background:"#fff",color:"#101828",fontFamily:"inherit",fontSize:"13px",outline:"none"};
const tabStyle={minHeight:"42px",padding:"0 15px",display:"inline-flex",alignItems:"center",justifyContent:"center",border:"1px solid #d0d5dd",borderRadius:"9px",background:"#fff",color:"#344054",textDecoration:"none",fontSize:"13px",fontWeight:900};
const secondaryButtonStyle={minHeight:"42px",padding:"0 14px",display:"inline-flex",alignItems:"center",justifyContent:"center",border:"1px solid #d0d5dd",borderRadius:"9px",background:"#fff",color:"#344054",textDecoration:"none",fontSize:"12px",fontWeight:800};