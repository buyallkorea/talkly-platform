"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Test students may prepare Zoom/textbooks before class. Refresh server-owned
// attendance/whiteboard/chat permissions when the teacher starts, without rejoining Zoom.
export default function TestStudentStartWatcher({ sessionId }: { sessionId: number }) {
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    async function check() {
      if (refreshing || document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/classroom/session-status?sessionId=${sessionId}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (response.ok && result.session?.effectiveStatus === "in_progress" && !controller.signal.aborted) {
          refreshing = true; router.refresh();
        }
      } catch { /* Next scheduled check retries transient network errors. */ }
    }
    void check();
    const timer = window.setInterval(check, 2000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [router, sessionId]);
  return null;
}
