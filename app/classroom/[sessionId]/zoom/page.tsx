import ClassroomZoomEmbed from "../ClassroomZoomEmbed";
import { getClassroomZoomAccess } from "@/lib/classroom-zoom-access";
import { getZoomMeetingPassword } from "@/lib/zoom-meeting-password";

export default async function ZoomFramePage({ params, searchParams }: {
  params: Promise<{ sessionId: string }>; searchParams: Promise<{ testMode?: string }>;
}) {
  const { sessionId } = await params;
  const { testMode } = await searchParams;
  const access = await getClassroomZoomAccess(Number(sessionId), testMode === "student");
  let password: string;
  try { password = await getZoomMeetingPassword(access.meetingNumber); }
  catch (error) {
    console.error("[TALKLY Zoom frame] Meeting lookup failed", error);
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20, background: "#111216", color: "#ffffff" }}>
        <section role="alert" style={{ width: "100%", maxWidth: 510, padding: "28px", border: "1px solid #37445b", borderRadius: 16, background: "#1b2535", boxShadow: "0 14px 35px rgba(0,0,0,.18)" }}>
          <div style={{ color: "#a9c5f8", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>TALKLY · CLASSROOM</div>
          <h1 style={{ margin: "14px 0 8px", fontSize: 23, lineHeight: 1.4, fontWeight: 850 }}>Zoom connection unavailable</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: "#c7d4e8" }}>Could not load the meeting. Please reopen the classroom in a moment. Your lesson information has not been changed.</p>
        </section>
      </main>
    );
  }
  return <main style={{ height: "100dvh", width: "100%", minWidth: 0, overflow: "hidden", background: "#111216", color: "white" }}>
    <style>{`html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }`}</style>
    <ClassroomZoomEmbed {...access} password={password} />
  </main>;
}
