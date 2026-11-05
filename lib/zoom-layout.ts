/** Layout adapter for pinned Meeting SDK 6.2.0. Adds classes only; leaves
 * React ownership, media canvases, controls and participant state intact. */
function addLayoutClass(element: HTMLElement, name: string) {
  if (!element.classList.contains(name)) element.classList.add(name);
}
export function markZoomLayout(root: HTMLElement) {
  const widget = root.querySelector<HTMLElement>('[role="region"][aria-label="Zoom Web SDK Widget"]');
  if (!widget) return;
  addLayoutClass(widget, "talkly-sdk-widget");
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
  return { width: Math.max(240, Math.floor(split ? Math.min(320, Math.max(240, width * .26923)) : width)), height: Math.max(180, Math.floor(height - 100)) };
}
