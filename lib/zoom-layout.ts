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
function nativeLabel(button: HTMLElement) {
  const attributes = ["aria-label", "title", "data-tooltip", "data-testid", "data-state"];
  const texts = attributes.map(attribute => button.getAttribute(attribute) || "");
  texts.push(button.textContent || "");
  const svgTitle = button.querySelector("svg title");
  texts.push(svgTitle?.textContent || "");
  return texts.filter(Boolean).join(" ").replace(/\\s+/g, " ").trim();
}
const AUDIO_BUTTON = /join.{0,18}audio|computer audio|connect audio|leave audio|^audio$|^mute$|^unmute$|microphone|^mic$|음소거|오디오|마이크/i;
const VIDEO_BUTTON = /start video|stop video|video on|video off|turn.{0,12}(?:camera|video)|camera|^video$|비디오|카메라/i;
/** Find the shared bottom Zoom toolbar even when buttons have nested labels. */
function markNativeToolbar(widget: HTMLElement) {
  if (typeof widget.querySelectorAll !== "function") return;
  const buttons = Array.from(widget.querySelectorAll<HTMLElement>('button,[role="button"]'));
  const audio = buttons.find(button => AUDIO_BUTTON.test(nativeLabel(button)));
  const video = buttons.find(button => VIDEO_BUTTON.test(nativeLabel(button)));
  if (!audio || !video) return;
  let parent = audio.parentElement;
  while (parent && parent !== widget && !parent.contains(video)) parent = parent.parentElement;
  if (!parent || parent === widget || typeof parent.getBoundingClientRect !== "function") return;
  const rect = parent.getBoundingClientRect();
  const widgetRect = widget.getBoundingClientRect();
  // Only a narrow, horizontal native toolbar may be tagged. Never tag the
  // video region, a large modal, or an overlapping media canvas.
  if (rect.height > 0 && rect.height <= 120 && rect.width >= 110 &&
      rect.top >= widgetRect.top + widgetRect.height * .48) {
    addLayoutClass(parent, "talkly-sdk-native-toolbar");
  }
}

export function markZoomLayout(root: HTMLElement) {
  const widget = root.querySelector<HTMLElement>('[role="region"][aria-label="Zoom Web SDK Widget"]');
  if (!widget) return;
  addLayoutClass(widget, "talkly-sdk-widget");
  markNativeToolbar(widget);
  // Always preserve the full Zoom-native media toolbar. No filtering of
  // Zoom-owned audio, mic, video or sharing controls is safe across SDK builds.
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
