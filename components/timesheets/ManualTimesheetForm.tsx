"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SLOTS_PER_DAY, TIMESHEET_ZONES, timeLabel, weeklyGroups, validMonth,
  blockMinutes, dailyMinutes, formatDuration, validateManualTimesheet,
  type ClassBlock, type ManualTimesheet, type ManualStatus,
} from "@/lib/timesheets/manual";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type Props = { month: string; teacherName: string; initial: ManualTimesheet | null; readOnly: boolean; baseUrl: string };

export default function ManualTimesheetForm({ month, teacherName, initial, readOnly, baseUrl }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<ClassBlock[]>(initial?.entries ?? []);
  const [rosterNotes, setRosterNotes] = useState(initial?.roster_notes ?? "");
  const [teacherNote, setTeacherNote] = useState(initial?.teacher_note ?? "");
  const [timeZone, setTimeZone] = useState(initial?.time_zone ?? "Asia/Seoul");
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [status, setStatus] = useState<ManualStatus>(initial?.status ?? "draft");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [blockName, setBlockName] = useState("✓");
  const [weekIndex, setWeekIndex] = useState(0);
  const guard = useRef(false);
  const weeks = useMemo(() => weeklyGroups(month), [month]);
  const currentWeek = weeks[Math.min(weekIndex, weeks.length - 1)];
  const monthlyMinutes = blockMinutes(entries);
  const entryMap = useMemo(() => new Map(entries.map(entry => [entry.day + ":" + entry.slot, entry.student])), [entries]);
  const summary = weeks.map((week, index) => {
    const days = week.days.filter((value): value is number => value !== null);
    const count = entries.filter(entry => days.includes(entry.day)).length;
    return { index, count, minutes: count * 30, from: days[0], to: days[days.length - 1] };
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function switchMonth(value: string) {
    if (!validMonth(value)) return;
    if (dirty && !window.confirm("Unsaved changes will be lost. Continue?")) return;
    router.push(baseUrl + "?month=" + encodeURIComponent(value));
  }
  function toggle(day: number, slot: number) {
    if (readOnly || busy || conflict) return;
    const key = day + ":" + slot;
    if (entryMap.has(key)) {
      setEntries(list => list.filter(item => item.day + ":" + item.slot !== key));
    } else {
      const student = blockName.trim();
      if (!student) { setNotice("Enter a student name or ✓ first."); return; }
      setEntries(list => [...list, { day, slot, student }]);
    }
    setDirty(true); setNotice("");
  }
  async function save(next: ManualStatus) {
    if (readOnly || guard.current || conflict) return;
    let clean: ReturnType<typeof validateManualTimesheet>;
    try {
      clean = validateManualTimesheet(month, { entries, rosterNotes, teacherNote, timeZone, status: next });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Please check your timesheet."); return;
    }
    guard.current = true; setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/teacher-timesheets", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, revision, ...clean }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (response.status === 409) setConflict(true);
      if (!response.ok || result?.success !== true || result.revision !== revision + 1 || result.status !== next) {
        throw Error(result?.error || "Save could not be confirmed. Your entries remain on this page.");
      }
      setRevision(result.revision); setStatus(result.status); setDirty(false);
      setNotice(next === "submitted" ? "Monthly timesheet submitted for admin review. / 관리자에게 제출되었습니다." : "Draft saved. / 임시저장 완료");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error && !["AbortError", "TimeoutError"].includes(error.name) ? error.message : "Save status unknown. Keep your entries on this page and retry.");
    } finally { setBusy(false); guard.current = false; }
  }
  return <div className="talkly-timesheet-page">
    <header className="talkly-timesheet-hero">
      <span className="talkly-timesheet-eyebrow">TALKLY · {readOnly ? "ADMIN REVIEW" : "TEACHER WORKSPACE"}</span>
      <h1>{readOnly ? "강사 수업시간 보고서" : "My Teaching Hours"}</h1>
      <p>{readOnly ? teacherName + " · 강사가 직접 작성한 수업시간 기록입니다." : "Mark completed classes in each 30-minute slot. This is a self-reported form, not your official classroom schedule."}</p>
      <div className="talkly-timesheet-hero-meta">
        <span>{teacherName}</span><span>{month}</span>
        <span className={"talkly-timesheet-badge " + (status === "submitted" ? "is-submitted" : "is-draft")}>{status === "submitted" ? (readOnly ? "제출 완료" : "Submitted") : (readOnly ? "임시저장" : "Draft")}</span>
        <span>Revision {revision}</span>
      </div>
    </header>
    <div className="talkly-timesheet-stat-grid">
      <div className="talkly-timesheet-stat"><span>{readOnly ? "총 기록시간" : "Monthly teaching hours"}</span><strong>{formatDuration(monthlyMinutes)}</strong><small>30 minutes per filled block</small></div>
      <div className="talkly-timesheet-stat"><span>{readOnly ? "기록한 수업 블록" : "Completed slots"}</span><strong>{entries.length}</strong><small>{month} · 06:00–24:00</small></div>
      <div className="talkly-timesheet-stat"><span>{readOnly ? "검토 상태" : "Reporting status"}</span><strong className="talkly-timesheet-stat-text">{status === "submitted" ? (readOnly ? "제출 완료" : "Submitted") : (readOnly ? "미제출" : "Not submitted")}</strong><small>{initial?.submitted_at ? "Submitted: " + new Date(initial.submitted_at).toLocaleDateString("en-CA") : "Administrator can see saved drafts"}</small></div>
    </div>
    <section className="talkly-timesheet-panel">
      <div className="talkly-timesheet-controls">
        <div><h2>{readOnly ? "월간 수업시간표" : "Monthly Class Tracker"}</h2><p>{readOnly ? "입력된 블록만 수업시간으로 합산됩니다." : "Type a student name or ✓, then click a time block to mark a completed class. Click again to clear."}</p></div>
        <label className="talkly-timesheet-month-label">{readOnly ? "조회 월" : "Month"}<input type="month" value={month} min="2020-01" max="2099-12" onChange={e=>switchMonth(e.target.value)} /></label>
      </div>
      {!readOnly && <div className="talkly-timesheet-entry-toolbar">
        <label htmlFor="timesheet-class-label">Student name or ✓
          <input id="timesheet-class-label" type="text" maxLength={80} placeholder="Student name or ✓" value={blockName} onChange={e=>setBlockName(e.target.value)} />
        </label>
        <label htmlFor="timesheet-zone">Time zone
          <select id="timesheet-zone" value={timeZone} onChange={e=>{setTimeZone(e.target.value);setDirty(true);}}>
            {TIMESHEET_ZONES.map(zone=><option key={zone} value={zone}>{zone}</option>)}
          </select>
        </label>
        <p>Mark only lessons actually taught. One filled cell = 30 minutes. A name or ✓ is a self-report, not proof of attendance.</p>
      </div>}
      {readOnly && <p className="talkly-timesheet-zone-summary">시간대: <strong>{timeZone}</strong> · 강사 직접 입력 · 30분/블록</p>}
      <div className="talkly-timesheet-week-nav">
        <button type="button" onClick={()=>setWeekIndex(i=>Math.max(0,i-1))} disabled={weekIndex===0} aria-label="Previous week">←</button>
        <strong>{readOnly ? "주차" : "Week"} {weekIndex+1} / {weeks.length} · {month}</strong>
        <button type="button" onClick={()=>setWeekIndex(i=>Math.min(weeks.length-1,i+1))} disabled={weekIndex===weeks.length-1} aria-label="Next week">→</button>
      </div>
      <div className="talkly-timesheet-table-scroller">
        <table className="talkly-timesheet-grid">
          <thead><tr><th scope="col">Time</th>{currentWeek.days.map((day,index)=><th key={index} scope="col">{DAY_NAMES[index]}<span>{day ?? "—"}</span></th>)}</tr></thead>
          <tbody>{Array.from({length:SLOTS_PER_DAY},(_,slot)=><tr key={slot}>
            <th scope="row">{timeLabel(slot)}</th>
            {currentWeek.days.map((day,index)=>{
              if(day===null)return <td key={index} className="is-outside">—</td>;
              const label=entryMap.get(day+":"+slot);
              return <td key={index} className={label?"is-filled":""}>
                {readOnly ? <span title={label||""} className="talkly-timesheet-readonly-slot">{label||""}</span>
                  : <button type="button" disabled={busy||conflict} onClick={()=>toggle(day,slot)}
                    aria-label={month+"-"+String(day).padStart(2,"0")+" "+timeLabel(slot)+(label?" "+label+"; clear slot":"; mark completed class")}
                    className={"talkly-timesheet-slot "+(label?"is-filled":"")}>{label||"+"}</button>}
              </td>;
            })}
          </tr>)}</tbody>
          <tfoot><tr><th>Daily total</th>{currentWeek.days.map((day,index)=><td key={index}>{day===null?"—":formatDuration(dailyMinutes(entries,day))}</td>)}</tr></tfoot>
        </table>
      </div>
    </section>
    <section className="talkly-timesheet-panel">
      <div className="talkly-timesheet-panel-heading"><h2>{readOnly ? "주간 수업시간 합계" : "Weekly Teaching Hours"}</h2><p>Each week is Monday–Sunday. Only days inside the selected month count toward monthly totals.</p></div>
      <div className="talkly-timesheet-table-scroller"><table className="talkly-timesheet-summary-table"><thead><tr><th>Week</th><th>From</th><th>To</th><th>Class blocks</th><th>Teaching hours</th></tr></thead>
        <tbody>{summary.map(w=><tr key={w.index}><td>Week {w.index+1}</td><td>{month+"-"+String(w.from).padStart(2,"0")}</td><td>{month+"-"+String(w.to).padStart(2,"0")}</td><td>{w.count}</td><td><strong>{formatDuration(w.minutes)}</strong></td></tr>)}</tbody>
        <tfoot><tr><th colSpan={3}>MONTHLY TOTAL</th><th>{entries.length}</th><th>{formatDuration(monthlyMinutes)}</th></tr></tfoot>
      </table></div>
    </section>
    <section className="talkly-timesheet-panel">
      <div className="talkly-timesheet-panel-heading"><h2>{readOnly ? "학생 명단 및 반복 시간표(강사 작성)" : "Student Roster & Recurring Schedule"}</h2><p>{readOnly ? "수업 블록과 별개로 강사가 적은 참고 내용입니다." : "Optional manual notes. Example: Anna | Mon/Wed | 09:00–09:30. This does not create or change official schedules."}</p></div>
      {readOnly?<div className="talkly-timesheet-notes">{rosterNotes||"—"}</div>:<textarea rows={5} maxLength={3000} value={rosterNotes} onChange={e=>{setRosterNotes(e.target.value);setDirty(true);}} placeholder={"Student | Days | Time\nAnna | Mon/Wed | 09:00–09:30"} />}
      <div className="talkly-timesheet-panel-heading"><h2>{readOnly ? "강사 전달사항" : "Notes for Administrator"}</h2></div>
      {readOnly?<div className="talkly-timesheet-notes">{teacherNote||"—"}</div>:<textarea rows={3} maxLength={2000} value={teacherNote} onChange={e=>{setTeacherNote(e.target.value);setDirty(true);}} placeholder="Any corrections or exceptions to review" />}
      {!readOnly && <div className="talkly-timesheet-actions">
        <button type="button" disabled={busy||conflict} onClick={()=>void save(status)} className="talkly-timesheet-button-secondary">{status==="submitted"?"Save correction / 수정 저장":"Save draft / 임시저장"}</button>
        {status==="draft"&&<button type="button" disabled={busy||conflict} onClick={()=>void save("submitted")} className="talkly-timesheet-button-primary">Submit monthly timesheet / 관리자 제출</button>}
        <button type="button" onClick={()=>window.print()} className="talkly-timesheet-button-secondary">Print / 인쇄</button>
      </div>}
      {readOnly && <div className="talkly-timesheet-actions"><button type="button" onClick={()=>window.print()} className="talkly-timesheet-button-secondary">인쇄</button></div>}
      {!readOnly&&<p role="status" aria-live="polite" className="talkly-timesheet-feedback">{busy?"Saving…":notice||(dirty?"Unsaved changes.":"Fill the time blocks and save a draft or submit.")}</p>}
      {conflict&&<p role="alert" className="talkly-timesheet-alert">A newer version exists. Copy your entries before reloading.</p>}
    </section>
    <p className="talkly-timesheet-disclaimer">{readOnly?"관리자 확인용 수기 보고서입니다.":"These are self-reported class blocks."} No automatic link to attendance, scheduled lessons, hourly rates or payment calculations. / 기존 수업 일정·출결·급여 시스템과 연동되지 않습니다.</p>
  </div>;
}
