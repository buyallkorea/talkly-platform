"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminOperationsSnapshot, LessonMonitorRow, WorkItem } from "@/lib/admin-operations";

type Mode = "summary" | "live";
const fmtTime = (iso: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(iso));
const fmtRefresh = (iso: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
}).format(new Date(iso));
const stateLabel: Record<LessonMonitorRow["scheduleState"], string> = {
  upcoming: "시작 전", in_window: "현재 수업 시간", overdue: "종료 상태 확인",
  finished: "완료", cancelled: "취소·휴강",
};
const filters = [
  { key: "active", title: "현재 수업 시간" },
  { key: "upcoming", title: "시작 예정" },
  { key: "overdue", title: "상태 확인" },
  { key: "all", title: "오늘 전체" },
] as const;
type Filter = (typeof filters)[number]["key"];

function TaskLink({ item }: { item: WorkItem }) {
  return <Link href={item.href} className={"talkly-operations-task " + (item.count > 0 && item.priority === "high" ? "is-priority" : "")}>
    <span><strong>{item.label}</strong><small>{item.detail}</small></span>
    <span className="talkly-operations-count">{item.count.toLocaleString("ko-KR")}건</span>
  </Link>;
}
function Status({ seen, time, who }: { seen: boolean; time: string | null; who: string }) {
  return <span className={"talkly-operations-presence " + (seen ? "is-seen" : "is-unknown")}
    title={seen && time ? who + " 웹 Zoom 입장 신호: " + fmtRefresh(time) : who + "의 웹 Zoom 입장 신호 없음. Zoom 앱 참여 여부는 확인할 수 없습니다."}>
    {seen ? "웹 입장 신호 확인" : "웹 접속 미확인"}
  </span>;
}
export default function AdminOperationsPanel({ mode }: { mode: Mode }) {
  const [snapshot, setSnapshot] = useState<AdminOperationsSnapshot | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/admin/operations", { cache: "no-store", credentials: "same-origin", signal });
      const json = await res.json() as AdminOperationsSnapshot & { error?: string };
      if (!res.ok) throw new Error(json.error || "운영 정보를 불러오지 못했습니다.");
      if (!signal?.aborted) {
        setSnapshot(json);
        setError("");
      }
    } catch (caught) {
      if (!signal?.aborted) setError(caught instanceof Error ? caught.message : "운영 정보 확인 실패");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(controller.signal);
    }, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(controller.signal);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (mode === "summary") {
    const important = snapshot?.counts.filter(item => item.count > 0).sort((a,b) =>
      (a.priority === "high" ? -1 : 0) - (b.priority === "high" ? -1 : 0)) ?? [];
    return <section className="talkly-operations-summary" aria-label="오늘 처리할 업무">
      <header className="talkly-operations-title">
        <div><span>TODAY'S PRIORITIES</span><h2>오늘 처리할 업무</h2>
          <p>신규 신청, 미배정, 결제 대기, 수업 문제를 한눈에 확인합니다.</p></div>
        <Link href="/admin/live-classes">수업 운영 현황 보기 →</Link>
      </header>
      {error && <p role="alert" className="talkly-operations-error">{error} · 마지막 정상 조회값이 있으면 유지됩니다.</p>}
      {loading && !snapshot ? <p className="talkly-operations-loading">업무 현황 확인 중…</p> :
        snapshot && important.length ? <div className="talkly-operations-tasks">
          {important.slice(0,9).map(item => <TaskLink item={item} key={item.key}/>)}
        </div> : snapshot ? <p className="talkly-operations-empty">현재 집계된 처리 대기 항목이 없습니다.</p> : null}
      {snapshot && <p className="talkly-operations-stamp">{snapshot.date} 기준 · {fmtRefresh(snapshot.generatedAt)} 확인 · 20초 간격 자동 갱신</p>}
    </section>;
  }

  const list = snapshot?.lessons.filter(item =>
    filter === "all" || filter === "active" && item.scheduleState === "in_window" ||
    filter === "upcoming" && item.scheduleState === "upcoming" ||
    filter === "overdue" && item.scheduleState === "overdue") ?? [];
  const activeCount = snapshot?.lessons.filter(s => s.scheduleState === "in_window").length ?? 0;
  const joinedCount = snapshot?.lessons.filter(s => s.scheduleState === "in_window" && (s.teacherBrowserJoined || s.studentBrowserJoined)).length ?? 0;
  return <section className="talkly-operations-live">
    <header className="talkly-operations-title">
      <div><span>CLASSROOM OPERATIONS</span><h2>실시간 수업 운영 현황</h2>
        <p>오늘의 수업 일정과 TALKLY 웹 강의실 접속 신호를 확인합니다.</p></div>
      <button type="button" className="talkly-operations-refresh" onClick={() => void load()} disabled={loading && !snapshot}>지금 새로고침</button>
    </header>
    {error && <p className="talkly-operations-error" role="alert">{error}</p>}
    <div className="talkly-operations-stats">
      <div><span>오늘 전체 수업</span><strong>{snapshot?.lessonTotal ?? "—"}</strong></div>
      <div><span>현재 수업 시간대</span><strong>{activeCount}</strong></div>
      <div><span>웹 입장 신호 있는 수업</span><strong>{joinedCount}</strong></div>
      <div><span>시스템 조회 시각</span><strong className="talkly-operations-clock">{snapshot ? fmtRefresh(snapshot.generatedAt) : "—"}</strong></div>
    </div>
    <div className="talkly-operations-filter" role="group" aria-label="수업 목록 필터">
      {filters.map(item => <button key={item.key} type="button" aria-pressed={item.key === filter} onClick={() => setFilter(item.key)}>{item.title}</button>)}
    </div>
    <div className="talkly-operations-table-wrap">
      <table className="talkly-operations-table">
        <thead><tr><th>시간</th><th>학생 / 강사</th><th>시간표 상태</th><th>강사 웹 접속</th><th>학생측 웹 접속</th><th>수업</th></tr></thead>
        <tbody>
          {list.map(item => <tr key={item.id}>
            <td><strong>{fmtTime(item.start)} ~ {fmtTime(item.end)}</strong><small>#{item.id} · {item.lessonNumber}회</small></td>
            <td><strong>{item.studentName}</strong><small>강사: {item.teacherName}</small></td>
            <td><span className={"talkly-operations-stage is-" + item.scheduleState}>{stateLabel[item.scheduleState]}</span>
              {!item.meetingReady && <small className="talkly-operations-alert">Zoom 링크 확인 필요</small>}</td>
            <td><Status who="강사" seen={item.teacherBrowserJoined} time={item.teacherLastSeen}/></td>
            <td><Status who="학생측" seen={item.studentBrowserJoined} time={item.studentLastSeen}/></td>
            <td><Link href={"/classroom/" + item.id}>강의실 보기</Link><Link href="/admin/calendar">일정 관리</Link></td>
          </tr>)}
          {!list.length && <tr><td colSpan={6} className="talkly-operations-nodata">
            {!snapshot ? "운영 정보 조회 중…" : "선택한 구분에 해당하는 수업이 없습니다."}</td></tr>}
        </tbody>
      </table>
    </div>
    {snapshot?.truncated && <p className="talkly-operations-error">오늘 수업이 300건을 넘어 일부만 표시됩니다. 수업 캘린더에서 전체 일정을 확인하세요.</p>}
    <p className="talkly-operations-caveat">{snapshot?.note ?? "입장 신호는 Zoom 웹 강의실 접속만 기록하며 Zoom 앱 접속은 확인되지 않습니다."} 수업 입장 신호 없음은 접속 장애나 결석을 뜻하지 않습니다.</p>
    <p className="talkly-operations-stamp">{snapshot ? fmtRefresh(snapshot.generatedAt) + " 조회 완료" : ""} · 화면을 켜두면 20초마다 자동 갱신됩니다. <Link href="/admin/calendar">수업 캘린더로 이동</Link></p>
  </section>;
}
