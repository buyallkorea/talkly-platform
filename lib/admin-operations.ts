import { createAdminClient } from "@/lib/supabase-admin";

export type WorkItem = {
  key: string;
  label: string;
  count: number;
  href: string;
  detail: string;
  priority: "high" | "normal";
};
export type LessonMonitorRow = {
  id: number;
  lessonNumber: number;
  start: string;
  end: string;
  studentName: string;
  teacherName: string;
  scheduleState: "upcoming" | "in_window" | "finished" | "overdue" | "cancelled";
  dbStatus: string;
  meetingReady: boolean;
  teacherBrowserJoined: boolean;
  studentBrowserJoined: boolean;
  teacherLastSeen: string | null;
  studentLastSeen: string | null;
};
export type AdminOperationsSnapshot = {
  generatedAt: string;
  date: string;
  counts: WorkItem[];
  lessons: LessonMonitorRow[];
  lessonTotal: number;
  truncated: boolean;
  note: string;
};

type ClassSessionRow = {
  id: number; enrollment_id: number; lesson_number: number;
  scheduled_start: string; scheduled_end: string; status: string;
  meeting_url: string | null; meeting_id: string | null;
  teacher_user_id: string | null; started_at: string | null;
  ended_at: string | null; is_external_teacher: boolean;
  external_teacher_name: string | null;
};
type EnrollmentRow = {
  id: number; child_id: number | null;
  student_user_id: string | null; teacher_user_id: string | null;
};
type PresenceRow = {
  class_session_id: number; role: string;
  connection_state: string; last_seen_at: string;
};

const KST = "Asia/Seoul";
function seoulDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}
function inCount<T extends { count: number | null; error: { message: string } | null }>(result: T) {
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

export async function loadAdminOperationsSnapshot(): Promise<AdminOperationsSnapshot> {
  const now = new Date();
  const nowMs = now.getTime();
  const date = seoulDay(now);
  const from = new Date(date + "T00:00:00+09:00");
  const until = new Date(from.getTime() + 86400_000);
  const db = createAdminClient();

  // Count-only queries avoid loading private enrollment/payment details.
  const [requests, unassigned, holds, payments, lessonsResult] = await Promise.all([
    db.from("enrollment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("enrollments").select("id", { count: "exact", head: true })
      .eq("is_test", false).eq("status", "active").is("teacher_user_id", null),
    db.from("class_holds").select("id", { count: "exact", head: true }).eq("status", "requested"),
    db.from("enrollment_payments").select("id", { count: "exact", head: true }).in("status", ["pending", "ready"]),
    db.from("class_sessions")
      .select("id,enrollment_id,lesson_number,scheduled_start,scheduled_end,status,meeting_url,meeting_id,teacher_user_id,started_at,ended_at,is_external_teacher,external_teacher_name", { count: "exact" })
      .eq("is_test", false)
      .gte("scheduled_start", from.toISOString()).lt("scheduled_start", until.toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(300),
  ]);
  const pendingRequests = inCount(requests);
  const unassignedCount = inCount(unassigned);
  const pendingHolds = inCount(holds);
  const pendingPayments = inCount(payments);
  if (lessonsResult.error) throw new Error(lessonsResult.error.message);
  const lessons = (lessonsResult.data ?? []) as ClassSessionRow[];
  const lessonTotal = lessonsResult.count ?? lessons.length;
  const ids = lessons.map(lesson => lesson.id);
  const enrollmentIds = [...new Set(lessons.map(lesson => lesson.enrollment_id))];
  const cutoff = new Date(nowMs - 90_000).toISOString();

  const [enrollmentsResult, attendanceResult, evaluationResult, presenceResult] = await Promise.all([
    enrollmentIds.length
      ? db.from("enrollments").select("id,child_id,student_user_id,teacher_user_id").in("id", enrollmentIds)
      : Promise.resolve({ data: [] as EnrollmentRow[], error: null }),
    ids.length
      ? db.from("attendance").select("class_session_id").in("class_session_id", ids)
      : Promise.resolve({ data: [] as { class_session_id: number }[], error: null }),
    ids.length
      ? db.from("evaluations").select("class_session_id").in("class_session_id", ids)
      : Promise.resolve({ data: [] as { class_session_id: number }[], error: null }),
    ids.length
      ? db.from("classroom_live_presence")
          .select("class_session_id,role,connection_state,last_seen_at")
          .in("class_session_id", ids)
          .eq("connection_state", "joined")
          .gte("last_seen_at", cutoff)
      : Promise.resolve({ data: [] as PresenceRow[], error: null }),
  ]);
  for (const r of [enrollmentsResult, attendanceResult, evaluationResult, presenceResult]) {
    if (r.error) throw new Error(r.error.message);
  }
  const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[];
  const byEnrollment = new Map(enrollments.map(r => [r.id, r]));
  const childIds = [...new Set(enrollments.map(r => r.child_id).filter((id): id is number => id !== null))];
  const studentUserIds = [...new Set(enrollments.map(r => r.student_user_id).filter((id): id is string => !!id))];
  const teacherIds = [...new Set(lessons.map(s => s.teacher_user_id ?? byEnrollment.get(s.enrollment_id)?.teacher_user_id).filter((id): id is string => !!id))];

  const [childrenResult, studentsResult, teachersResult] = await Promise.all([
    childIds.length ? db.from("children").select("id,name").in("id", childIds)
      : Promise.resolve({ data: [] as { id: number; name: string }[], error: null }),
    studentUserIds.length ? db.from("profiles").select("id,name").in("id", studentUserIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    teacherIds.length ? db.from("teacher_profiles").select("user_id,display_name").in("user_id", teacherIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string }[], error: null }),
  ]);
  for (const r of [childrenResult, studentsResult, teachersResult]) {
    if (r.error) throw new Error(r.error.message);
  }
  const childNames = new Map((childrenResult.data ?? []).map(row => [row.id, row.name]));
  const studentNames = new Map((studentsResult.data ?? []).map(row => [row.id, row.name]));
  const teacherNames = new Map((teachersResult.data ?? []).map(row => [row.user_id, row.display_name]));
  const attendanceSet = new Set((attendanceResult.data ?? []).map(row => row.class_session_id));
  const evaluationSet = new Set((evaluationResult.data ?? []).map(row => row.class_session_id));
  const active = (presenceResult.data ?? []) as PresenceRow[];
  const liveMap = new Map<number, { teacher: string | null; student: string | null }>();
  for (const row of active) {
    const p = liveMap.get(row.class_session_id) ?? { teacher: null, student: null };
    if (row.role === "teacher") {
      if (!p.teacher || row.last_seen_at > p.teacher) p.teacher = row.last_seen_at;
    } else if (row.role === "student" || row.role === "parent") {
      if (!p.student || row.last_seen_at > p.student) p.student = row.last_seen_at;
    }
    liveMap.set(row.class_session_id, p);
  }

  let missingAttendance = 0;
  let missingEvaluation = 0;
  let missingMeeting = 0;
  let upcomingThirty = 0;
  let duringWindow = 0;
  let overdue = 0;
  let noBrowserEvidence = 0;
  const monitor: LessonMonitorRow[] = lessons.map(s => {
    const enrollment = byEnrollment.get(s.enrollment_id);
    const participant = liveMap.get(s.id);
    const started = new Date(s.scheduled_start).getTime();
    const ended = new Date(s.scheduled_end).getTime();
    const canceled = ["cancelled", "canceled", "held", "not_held"].includes(s.status);
    const completed = s.status === "completed" || !!s.ended_at;
    const state: LessonMonitorRow["scheduleState"] = canceled ? "cancelled"
      : completed ? "finished"
      : nowMs < started ? "upcoming"
      : nowMs <= ended ? "in_window"
      : "overdue";
    if (state === "in_window") {
      duringWindow++;
      if (!participant?.teacher && !participant?.student) noBrowserEvidence++;
    }
    if (state === "overdue") overdue++;
    if (!canceled && !completed && started >= nowMs && started <= nowMs + 30 * 60_000) upcomingThirty++;
    if (!canceled && (state === "upcoming" || state === "in_window") && !s.meeting_url && !s.meeting_id) missingMeeting++;
    if (!canceled && nowMs > ended && !attendanceSet.has(s.id)) missingAttendance++;
    if (completed && !evaluationSet.has(s.id)) missingEvaluation++;
    const teacherId = s.teacher_user_id ?? enrollment?.teacher_user_id;
    return {
      id: s.id, lessonNumber: s.lesson_number,
      start: s.scheduled_start, end: s.scheduled_end,
      studentName: enrollment?.child_id
        ? childNames.get(enrollment.child_id) || "학생 정보 확인"
        : enrollment?.student_user_id
          ? studentNames.get(enrollment.student_user_id) || "학생 정보 확인"
          : "학생 정보 확인",
      teacherName: s.is_external_teacher ? s.external_teacher_name || "외부강사"
        : teacherId ? teacherNames.get(teacherId) || "강사 정보 확인" : "미배정",
      scheduleState: state, dbStatus: s.status, meetingReady: !!(s.meeting_url || s.meeting_id),
      teacherBrowserJoined: !!participant?.teacher, studentBrowserJoined: !!participant?.student,
      teacherLastSeen: participant?.teacher ?? null, studentLastSeen: participant?.student ?? null,
    };
  });
  const counts: WorkItem[] = [
    { key: "requests", label: "미처리 수강신청", count: pendingRequests, href: "/admin/enrollment-requests?status=pending", detail: "관리자 검토 대기", priority: "high" },
    { key: "assignment", label: "강사 미배정 수강", count: unassignedCount, href: "/admin/enrollments", detail: "활성 수강 중 배정 없음", priority: "high" },
    { key: "payments", label: "결제 대기", count: pendingPayments, href: "/admin/tuition-payments?tab=payments&status=pending", detail: "결제 준비·대기 상태 포함", priority: "normal" },
    { key: "holds", label: "결석 승인 대기", count: pendingHolds, href: "/admin/class-holds", detail: "결석 신청 검토 필요", priority: "high" },
    { key: "meeting", label: "수업 링크 미등록", count: missingMeeting, href: "/admin/live-classes", detail: "오늘 수업의 Zoom 정보 확인", priority: "high" },
    { key: "attendance", label: "출결 확인 필요", count: missingAttendance, href: "/admin/calendar", detail: "종료시간 경과 후 출결 미등록", priority: "high" },
    { key: "evaluation", label: "평가 작성 대기", count: missingEvaluation, href: "/admin/evaluations", detail: "완료 수업 중 평가 없음", priority: "normal" },
    { key: "soon", label: "30분 이내 시작", count: upcomingThirty, href: "/admin/live-classes", detail: "오늘 곧 시작할 수업", priority: "normal" },
    { key: "inprogress", label: "현재 수업 시간대", count: duringWindow, href: "/admin/live-classes", detail: "시간표 기준·실제 입장과 구분", priority: "normal" },
    { key: "overdue", label: "종료 상태 미정리", count: overdue, href: "/admin/live-classes", detail: "종료시간 경과·완료 처리 미확인", priority: "high" },
    { key: "presence", label: "웹 입장 신호 미확인", count: noBrowserEvidence, href: "/admin/live-classes", detail: "Zoom 앱 접속은 집계되지 않음", priority: "normal" },
  ];
  return {
    generatedAt: now.toISOString(), date,
    counts, lessons: monitor, lessonTotal,
    truncated: lessonTotal > lessons.length,
    note: "Zoom 웹 강의실에서 SDK 입장 성공 후 전송한 최근 90초 신호만 표시합니다. Zoom 앱 접속·오디오·비디오 정상 여부나 공식 출석을 증명하지 않습니다.",
  };
}
