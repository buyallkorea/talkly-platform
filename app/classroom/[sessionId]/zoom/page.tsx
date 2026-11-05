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
    return <main style={{ minHeight: "100dvh", padding: 20, background: "#111216", color: "white" }}><h1>Zoom connection unavailable</h1><p>회의 정보를 불러오지 못했습니다. 잠시 후 강의실을 새로고침해 주세요.</p></main>;
  }
  return <main style={{ height: "100dvh", width: "100%", minWidth: 0, overflow: "hidden", background: "#111216", color: "white" }}>
    <style>{`html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }`}</style>
    <ClassroomZoomEmbed {...access} password={password} />
  </main>;
}
