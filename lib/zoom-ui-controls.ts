/** Meeting SDK 6.2.0 has no public connect-audio/start-share API. Activate only
 * its visible accessible toolbar control within the user's click. No private
 * media APIs; a missing/changed label returns false and leaves native UI intact. */
export type ZoomAction = "audio" | "video" | "share" | "stop-share" | "settings";
const labels: Record<ZoomAction, RegExp> = {
 audio:/^(join audio|connect audio|오디오 연결|오디오 참가|음소거 해제|unmute|mute|음소거)$/i,
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
export type ZoomAudioUser={userId?:number;audio?:string;muted?:boolean;displayName?:string;sharerOn?:boolean};
export function zoomAudioState(user: ZoomAudioUser|null|undefined) {
 return !user ? "unknown" : user.audio!=="computer" && user.audio!=="phone" ? "disconnected" : user.muted===true ? "muted" : user.muted===false ? "ready" : "unknown";
}

/** Small windows can move controls into Zoom's own More menu. */
export async function activateZoomControlWithOverflow(root: HTMLElement, action: ZoomAction): Promise<boolean> {
 if (activateZoomControl(action === "stop-share" ? root.ownerDocument.body : root, action)) return true;
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
