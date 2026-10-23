"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import "./messages.css";

type Thread = { id: string; subject: string; teacher_user_id: string; updated_at: string; unread: number };
type Teacher = { user_id: string; display_name: string; is_active: boolean };
type Message = { id: string; sender_role: string; body: string; created_at: string; read_at: string | null };
type Detail = { thread: { subject: string }; messages: Message[]; hasMore: boolean };
const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));

export default function MessageCenter({ role, threadId }: { role: "admin" | "teacher"; threadId?: string }) {
  const router = useRouter();
  const base = role === "admin" ? "/admin/teacher-messages" : "/teacher/messages";
  const isAdmin = role === "admin";
  const [threads, setThreads] = useState<Thread[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(threadId ? `/api/teacher-messages/${threadId}` : `/api/teacher-messages?page=${page}`, { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (signal?.aborted) return;
    if (threadId) {
      setDetail(current => {
        // Keep pages explicitly loaded by the reader while refreshing recent replies.
        const recent = new Set(data.messages.map((m: Message) => m.id));
        const older = (current?.messages ?? []).filter(m => !recent.has(m.id) && m.created_at < (data.messages[0]?.created_at ?? ""));
        return { ...data, messages: [...older, ...data.messages], hasMore: older.length ? current!.hasMore : data.hasMore };
      });
      // Mark only the incoming messages actually returned to this visible reader.
      const ids = data.messages.filter((m: Message) => m.sender_role !== role && !m.read_at).map((m: Message) => m.id);
      if (ids.length && document.visibilityState === "visible") {
        const read = await fetch(`/api/teacher-messages/${threadId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", ids }), signal });
        if (!read.ok) throw new Error("읽음 상태 저장 실패 / Could not mark messages as read.");
        window.dispatchEvent(new Event("talkly-messages-read"));
      }
    } else {
      setThreads(data.threads); setTeachers(data.teachers); setMore(data.hasMore);
    }
    setError(""); setLoading(false);
  }, [page, role, threadId]);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { if (document.visibilityState === "visible") void load(controller.signal).catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoading(false); } }); };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true); setError("");
    try {
      const response = await fetch(threadId ? `/api/teacher-messages/${threadId}` : "/api/teacher-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(threadId ? { body } : { teacherId, subject, body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBody("");
      if (!threadId) router.push(`${base}/${data.id}`);
      else await load();
    } catch (e) { setError(e instanceof Error ? e.message : "저장 실패 / Send failed."); }
    finally { setSending(false); }
  }
  async function older() {
    if (!detail?.messages.length || olderLoading) return;
    setOlderLoading(true);
    try {
      const response = await fetch(`/api/teacher-messages/${threadId}?before=${detail.messages[0].id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDetail(current => current ? { ...current, messages: [...data.messages, ...current.messages.filter(m => !data.messages.some((old: Message) => old.id === m.id))], hasMore: data.hasMore } : current);
      const ids = data.messages.filter((m: Message) => m.sender_role !== role && !m.read_at).map((m: Message) => m.id);
      if (ids.length) {
        const read = await fetch(`/api/teacher-messages/${threadId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", ids }) });
        if (!read.ok) throw new Error("읽음 상태 저장 실패 / Could not mark as read.");
        window.dispatchEvent(new Event("talkly-messages-read"));
      }
    } catch (e) { setError(e instanceof Error ? e.message : "조회 실패 / Load failed."); }
    finally { setOlderLoading(false); }
  }

  return <section className="talkly-messages">
    <header><p className="message-eyebrow">TALKLY · {isAdmin ? "TEACHER COMMUNICATION" : "ADMIN MESSAGES"}</p>
      <h1>{threadId ? detail?.thread.subject || (isAdmin ? "전달사항" : "Conversation") : isAdmin ? "강사 전달사항" : "Messages from TALKLY"}</h1>
      <p>{isAdmin ? "강사에게 전달사항을 보내고 답장을 확인합니다." : "Read messages from the administrator and reply here."}</p>
      {threadId && <Link href={base}>← {isAdmin ? "전체 전달사항" : "All messages"}</Link>}
    </header>
    {error && <p className="message-error" role="alert">{error} <button type="button" onClick={() => void load().catch(e => setError(e.message))}>{isAdmin ? "다시 시도" : "Retry"}</button></p>}
    {loading && <p role="status">{isAdmin ? "불러오는 중…" : "Loading…"}</p>}
    {!threadId && <>
      {isAdmin && <form onSubmit={send} className="message-card message-compose">
        <h2>새 전달사항 작성</h2>
        <label>받는 강사<select required value={teacherId} onChange={e => setTeacherId(e.target.value)}><option value="">강사를 선택해주세요</option>{teachers.filter(t => t.is_active).map(t => <option key={t.user_id} value={t.user_id}>{t.display_name}</option>)}</select></label>
        <label>제목<input required maxLength={120} value={subject} onChange={e => setSubject(e.target.value)} /></label>
        <label>내용<textarea required rows={5} maxLength={5000} value={body} onChange={e => setBody(e.target.value)} /></label>
        <small>작성한 내용은 선택한 강사와 관리자에게만 표시됩니다.</small>
        <button disabled={sending || !teacherId || !subject.trim() || !body.trim()}>{sending ? "전송 중…" : "전달사항 보내기"}</button>
      </form>}
      <div className="message-card"><h2>{isAdmin ? "전달 내역·답장" : "Inbox"}</h2>
        {!loading && !threads.length && <p>{isAdmin ? "아직 전달사항이 없습니다." : "No messages yet."}</p>}
        {threads.map(t => <Link className={`message-list-item ${t.unread ? "message-unread" : ""}`} key={t.id} href={`${base}/${t.id}`}><div><strong>{t.subject}</strong><small>{isAdmin ? teachers.find(teacher => teacher.user_id === t.teacher_user_id)?.display_name || "강사" : "TALKLY Admin"} · {date(t.updated_at)} KST</small></div>{t.unread > 0 && <span className="message-count">{t.unread} {isAdmin ? "미읽음" : "new"}</span>}</Link>)}
        <div className="message-pagination"><button disabled={!page} onClick={() => setPage(p => p - 1)}>{isAdmin ? "이전" : "Previous"}</button><span>{page + 1}</span><button disabled={!more} onClick={() => setPage(p => p + 1)}>{isAdmin ? "다음" : "Next"}</button></div>
      </div>
    </>}
    {threadId && detail && <>
      <div className="message-card message-conversation">
        {detail.hasMore && <button type="button" disabled={olderLoading} onClick={() => void older()}>{isAdmin ? "이전 메시지 더 보기" : "Load older messages"}</button>}
        {detail.messages.map(m => <article key={m.id} className={m.sender_role === role ? "message-bubble message-mine" : "message-bubble"}><header><strong>{m.sender_role === "admin" ? "TALKLY Admin" : "Teacher"}</strong><time dateTime={m.created_at}>{date(m.created_at)} KST</time></header><p>{m.body}</p>{m.sender_role === role && <small>{m.read_at ? isAdmin ? "읽음" : "Read by admin" : isAdmin ? "아직 읽지 않음" : "Not yet read"}</small>}</article>)}
      </div>
      <form onSubmit={send} className="message-card message-compose"><label>{isAdmin ? "답장" : "Reply"}<textarea required maxLength={5000} rows={4} value={body} onChange={e => setBody(e.target.value)} /></label><button disabled={sending || !body.trim()}>{sending ? "Sending…" : isAdmin ? "답장 보내기" : "Send reply"}</button></form>
    </>}
  </section>;
}
