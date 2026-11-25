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
/**
 * Meeting SDK Component View has no supported option to replace individual
 * stock toolbar items. Decorate only clearly identified Zoom-owned controls;
 * never clone, click, or reparent SDK React elements.
 *
 * The native audio (join/mute/settings), video and share controls are retained.
 * Unknown/unlabelled controls stay visible rather than risking their removal.
 * Clicking the native audio caret still lets a participant choose a speaker.
 */
function simplifyZoomControls(widget: HTMLElement) {
  const toolbar = widget.querySelector<HTMLElement>(".talkly-sdk-native-toolbar");
  if (toolbar) {
    const all = Array.from(toolbar.querySelectorAll<HTMLElement>('button,[role="button"]'));
    const nativeLabel = (button: HTMLElement) => [
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
      button.getAttribute("data-tooltip"),
      button.textContent,
      button.querySelector("svg title")?.textContent,
    ].filter(Boolean).join(" ").trim();
    const keep = /join audio|computer audio|connect audio|leave audio|mute|unmute|microphone|mic|start video|stop video|turn (?:on|off) (?:camera|video)|camera|share screen|stop share|screen share|sharing screen|audio settings|speaker|select (?:microphone|speaker)|음소거|마이크|카메라|비디오|오디오|스피커|화면 공유|공유 중지|공유 시작/i;
    const omit = /participants?|people|chat|message|reactions?|emoji|raise hand|caption|subtitles?|closed captions?|transcript|whiteboard|record|poll|apps|settings|more|meeting info|invite|security|leave meeting|end meeting|참가자|채팅|메시지|반응|손 들기|자막|녹화|설정|더보기|초대|보안|종료|나가기/i;
    for (const button of all) {
      const label = nativeLabel(button);
      if (!label) continue; // Do not guess for unknown SDK versions.
      // Zoom native media controls must always be kept, even if they mention
      // a settings/dropdown suboption.
      if (keep.test(label)) continue;
      if (omit.test(label)) button.classList.add("talkly-zoom-optional-control");
    }
  }

  // Hide only native view-layout selectors at the top of the Zoom widget,
  // never generic speaker/audio configuration or the in-meeting toolbar.
  const viewSelector = /speaker view|gallery view|ribbon view|multi(?:-)?speaker|side.by.side|change view|switch view|view options|layout view|grid view|filmstrip|video layout|view layout|화면 분할|갤러리 보기|발언자 보기|보기 변경|화면 배치|레이아웃 변경/i;
  const widgetRect = typeof widget.getBoundingClientRect === "function" ? widget.getBoundingClientRect() : null;
  if (!widgetRect) return;
  for (const button of Array.from(widget.querySelectorAll<HTMLElement>('button,[role="button"]'))) {
    if (toolbar?.contains(button)) continue;
    const label = [button.getAttribute("aria-label"), button.getAttribute("title"), button.getAttribute("data-tooltip"), button.textContent].filter(Boolean).join(" ");
    if (!viewSelector.test(label)) continue;
    const rect = typeof button.getBoundingClientRect === "function" ? button.getBoundingClientRect() : null;
    if (rect && rect.top >= widgetRect.top - 3 && rect.top < widgetRect.top + 115) {
      button.classList.add("talkly-zoom-view-selector");
    }
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
