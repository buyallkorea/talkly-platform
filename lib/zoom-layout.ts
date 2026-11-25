/** Layout adapter for pinned Meeting SDK 6.2.0. Adds classes only; leaves
 * React ownership, media canvases, controls and participant state intact. */
function addLayoutClass(element: HTMLElement, name: string) {
  if (!element.classList.contains(name)) element.classList.add(name);
}
/**
 * Only decorate the actual Zoom-owned audio/video toolbar, never hide its
 * controls. The Meeting SDK 6.2.0 exposes no stable public API for replacing
 * this toolbar. Restrict styling to the smallest visible shared ancestor of
 * its audio/video buttons; if Zoom changes its markup, leave it untouched.
 */
function markNativeToolbar(widget: HTMLElement) {
  // Some test/fallback wrappers only implement querySelector; never alter their layout.
  if (typeof widget.querySelectorAll !== "function") return;
  const buttons = Array.from(widget.querySelectorAll<HTMLElement>('button,[role="button"]'));
  const label = (button: HTMLElement) =>
    (button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "").trim();
  const audio = buttons.find(button =>
    /^(join audio(?: by computer)?|join (?:with )?computer audio|connect audio|mute|unmute|음소거|음소거 해제|오디오 연결|오디오 참가|컴퓨터 오디오로 참가)$/i.test(label(button)));
  const video = buttons.find(button =>
    /^(start video|stop video|비디오 시작|비디오 중지|비디오 정지)$/i.test(label(button)));
  if (!audio || !video) return;
  let parent = audio.parentElement;
  while (parent && parent !== widget && !parent.contains(video)) parent = parent.parentElement;
  if (!parent || parent === widget) return;
  if (typeof parent.getBoundingClientRect !== "function") return;
  const rect = parent.getBoundingClientRect();
  // Never tag the whole video/share panel or a popup by accident.
  if (rect.height > 0 && rect.height <= 96 && rect.width >= 110) {
    addLayoutClass(parent, "talkly-sdk-native-toolbar");
  }
}
export function markZoomLayout(root: HTMLElement) {
  const widget = root.querySelector<HTMLElement>('[role="region"][aria-label="Zoom Web SDK Widget"]');
  if (!widget) return;
  addLayoutClass(widget, "talkly-sdk-widget");
  markNativeToolbar(widget);
  for (let parent = widget.parentElement; parent && parent !== root; parent = parent.parentElement) addLayoutClass(parent, "talkly-sdk-container");
  const canvas = widget.querySelector('canvas[aria-label="Screen share"]');
  const panel = canvas?.closest<HTMLElement>('[role="tabpanel"]');
  const row = panel?.firstElementChild;
  if (!(row instanceof HTMLElement) || !canvas || !row.contains(canvas)) return;
  let share = canvas.parentElement;
  while (share && share.parentElement !== row) share = share.parentElement;
  const video = row.lastElementChild;
  if (!share || !(video instanceof HTMLElement) || share === video) return;
  addLayoutClass(panel!, "talkly-sdk-panel");
  addLayoutClass(row, "talkly-sdk-row");
  addLayoutClass(share, "talkly-sdk-share");
  addLayoutClass(video, "talkly-sdk-cameras");
  for (const child of Array.from(row.children)) if (child !== share && child !== video) addLayoutClass(child as HTMLElement, "talkly-sdk-divider");
}
export function zoomLayoutSize(width: number, height: number, split: boolean) {
  return { width: Math.max(240, Math.floor(width)), height: Math.max(180, Math.floor(height - 100)) };
}
