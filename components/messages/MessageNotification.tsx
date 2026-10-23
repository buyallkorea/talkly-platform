"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function MessageNotification({ role }: { role: "admin" | "teacher" }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/teacher-messages?count=1", { cache: "no-store", signal: controller.signal });
        if (response.ok) setUnread((await response.json()).unread);
      } catch { /* Keep the last count; the inbox exposes loading errors. */ }
    }
    void load();
    const timer = window.setInterval(load, 20000);
    window.addEventListener("talkly-messages-read", load);
    document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("talkly-messages-read", load); document.removeEventListener("visibilitychange", load); };
  }, []);
  return <Link href={role === "admin" ? "/admin/teacher-messages" : "/teacher/messages"} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 10, background: unread ? "#eff6ff" : "white", color: "#1e3a8a", fontSize: 14, fontWeight: 700 }} aria-label={`${role === "admin" ? "강사 메시지" : "Messages"}: ${unread} unread`}>
    {role === "admin" ? "강사 메시지" : "Messages"}
    {unread > 0 && <span role="status" style={{ background: "#2563eb", color: "white", padding: "2px 7px", borderRadius: 20 }}>{unread > 99 ? "99+" : unread}</span>}
  </Link>;
}
