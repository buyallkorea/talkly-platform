/** Meeting SDK 6.2.0 has no public connect-audio/start-share API. Activate only
 * its visible accessible toolbar control within the user's click. No private
 * media APIs; a missing/changed label returns false and leaves native UI intact. */
export type ZoomAction = "join-audio" | "audio" | "video" | "share" | "stop-share" | "settings";
const labels: Record<ZoomAction, RegExp> = {
 "join-audio":/^(?:join audio(?: by computer)?|join (?:with )?computer audio|connect(?: computer)? audio|오디오 연결|오디오 참가|컴퓨터 오디오(?:로)? (?:참가|연결)|컴퓨터 오디오로 참가)(?:\s*\([^)]*\))?$/i,
 audio:/^(join audio(?: by computer)?|join (?:with )?computer audio|connect audio|오디오 연결|오디오 참가|컴퓨터 오디오로 참가|음소거 해제|unmute|mute|음소거)$/i,
 video:/^(start video|stop video|비디오 시작|비디오 중지|비디오 정지)$/i,
 "stop-share":/^(stop share|stop sharing|공유 중지)$/i,
 share:/^(share screen|화면 공유)$/i,
 settings:/^(settings|설정|audio settings|오디오 설정)$/i,
};
export function activateZoomControl(root: HTMLElement, action: ZoomAction): boolean {
 for(const button of root.querySelectorAll<HTMLButtonElement>('button,[role="button"]')) {
  const name=button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent?.trim() || "";
  if(!labels[action].test(name.replace(/[.…]+$/, "").trim()) || button.disabled || button.getAttribute("aria-disabled")==="true" || !button.getClientRects().length) continue;
  button.focus();button.click();return true;
 }
 return false;
}
export type ZoomAudioUser={
 userId?:number; audio?:string; muted?:boolean; bVideoOn?:boolean;
 displayName?:string; sharerOn?:boolean;
 /** Official Meeting SDK connection status: 0=not connected, 1=connecting,
  * 2=connected, 3=connection failed. */
 audioStatus?:number; audioConnectionStatus?:number;
};
export type ZoomAudioState = "unknown" | "disconnected" | "connecting" | "failed" | "muted" | "ready";
export function zoomAudioState(user: ZoomAudioUser|null|undefined): ZoomAudioState {
 if (!user) return "unknown";
 const status = typeof user.audioStatus === "number"
   ? user.audioStatus : user.audioConnectionStatus;
 // The audio type alone is NOT proof of an established connection.
 if (status === 3) return "failed";
 if (status === 1) return "connecting";
 if (status === 0) return "disconnected";
 if (user.audio !== "computer" && user.audio !== "phone") {
   return user.audio === "" ? "disconnected" : "unknown";
 }
 return user.muted === true ? "muted" : user.muted === false ? "ready" : "unknown";
}

/** Zoom may render its join-computer-audio confirmation outside the
 * component root inside a dialog portal. Only match explicit, visible
 * buttons; never click a generic OK/confirm or unrelated page control. */
function activateZoomAudioDialog(root: HTMLElement): boolean {
 for (const button of root.ownerDocument.querySelectorAll<HTMLElement>(
   '[role="dialog"] button, [role="dialog"] [role="button"]'
 )) {
   const name = button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent?.trim() || "";
   if (!labels["join-audio"].test(name.replace(/[.…]+$/, "").trim()) ||
       button.getAttribute("aria-disabled") === "true" ||
       (button as HTMLButtonElement).disabled === true ||
       !button.getClientRects().length) continue;
   button.focus(); button.click(); return true;
 }
 return false;
}

/** Small windows can move controls into Zoom's own More menu. */
export async function activateZoomControlWithOverflow(root: HTMLElement, action: ZoomAction): Promise<boolean> {
 if (activateZoomControl(action === "stop-share" ? root.ownerDocument.body : root, action)) return true;
 if (action === "join-audio" && activateZoomAudioDialog(root)) return true;
 const more = Array.from(root.querySelectorAll<HTMLButtonElement>('button,[role="button"]')).find(button => /^(more|더\s?보기)$/i.test(button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent?.trim() || "") && !button.disabled && button.getClientRects().length);
 if (!more) return false;
 more.click();
 for (let attempt=0; attempt<3; attempt++) {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (!root.isConnected) return false;
  const menuItems = root.ownerDocument.querySelectorAll<HTMLElement>('[role="menuitem"]');
  for (const item of menuItems) {
   const name = item.getAttribute("aria-label") || item.textContent?.trim() || "";
   if (labels[action].test(name.replace(/[.…]+$/, "").trim()) && item.getAttribute("aria-disabled") !== "true" && item.getClientRects().length) { item.focus(); item.click(); return true; }
  }
 }
 return false;
}
