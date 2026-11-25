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
const SHARE_BUTTON = /share screen|screen share|stop share|sharing screen|공유/i;
const OPTIONAL_BUTTON = /participants?|attendees?|people|chat|message|reactions?|emoji|raise hand|captions?|subtitles?|transcript|whiteboard|recording?|polls?|apps|meeting info|invite|security|more|settings|leave meeting|end meeting|참가자|채팅|메시지|반응|손 들기|자막|녹화|설정|더보기|초대|보안|나가기|종료/i;
const VIEW_BUTTON = /speaker view|gallery view|ribbon view|multi.{0,3}speaker|side.by.side|change view|switch view|view options|layout view|grid view|filmstrip|video layout|view layout|화면 분할|갤러리 보기|발언자 보기|보기 변경|화면 배치|레이아웃 변경/i;

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

/** Hide only optional Zoom-owned buttons; preserve SDK event handlers. */
function simplifyZoomControls(widget: HTMLElement) {
  const toolbar = widget.querySelector<HTMLElement>(".talkly-sdk-native-toolbar");
  const all = Array.from(widget.querySelectorAll<HTMLElement>('button,[role="button"]'));
  const widgetRect = widget.getBoundingClientRect();
  const lowerBoundary = widgetRect.top + widgetRect.height * .65;

  for (const button of all) {
    const label = nativeLabel(button);
    const rect = button.getBoundingClientRect();
    if (!label || rect.height <= 0 || rect.width <= 0) continue;
    const isToolbar = Boolean(toolbar?.contains(button)) ||
      (rect.top > lowerBoundary && rect.height <= 65);
    if (isToolbar) {
      // Keep original Zoom join-audio/microphone, camera/video and sharing.
      if (AUDIO_BUTTON.test(label) || VIDEO_BUTTON.test(label) || SHARE_BUTTON.test(label)) continue;
      if (OPTIONAL_BUTTON.test(label)) addLayoutClass(button, "talkly-zoom-optional-control");
    }
    if (VIEW_BUTTON.test(label) &&
      rect.top >= widgetRect.top - 3 && rect.top < widgetRect.top + 100 &&
      !isToolbar) addLayoutClass(button, "talkly-zoom-view-selector");
  }

  // Zoom 6.x sometimes renders the upper layout-mode toolbar as unlabeled
  // icon buttons. Hide a verified cluster of 3+ small, adjacent icons in the
  // upper right, never solitary controls or native media buttons.
  const topRightIcons = all.filter(button => {
    const rect = button.getBoundingClientRect();
    const label = nativeLabel(button);
    return rect.height > 14 && rect.height <= 46 && rect.width > 14 && rect.width <= 52 &&
      rect.top >= widgetRect.top - 3 && rect.top <= widgetRect.top + 83 &&
      rect.left > widgetRect.left + widgetRect.width * .48 &&
      !AUDIO_BUTTON.test(label) && !VIDEO_BUTTON.test(label) && !SHARE_BUTTON.test(label) &&
      !/leave|exit|나가기|종료|fullscreen|전체 화면/i.test(label);
  });
  if (topRightIcons.length >= 3) {
    for (const button of topRightIcons) addLayoutClass(button, "talkly-zoom-view-selector");
  }
}

export function markZoomLayout(root: HTMLElement) {
  const widget = root.querySelector<HTMLElement>('[role="region"][aria-label="Zoom Web SDK Widget"]');
  if (!widget) return;
  addLayoutClass(widget, "talkly-sdk-widget");
  markNativeToolbar(widget);
  simplifyZoomControls(widget);
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
