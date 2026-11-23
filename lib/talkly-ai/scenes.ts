import type { Turn } from "./config";

export const AI_SCENES = [
  { id: "home", label: "일상 대화", english: "Everyday Conversation", icon: "⌂", outfit: "편안한 니트" },
  { id: "cafe", label: "카페·음식", english: "At a Cafe", icon: "☕", outfit: "캐주얼 셔츠" },
  { id: "office", label: "직장·비즈니스", english: "At Work", icon: "▦", outfit: "정장 재킷" },
  { id: "airport", label: "여행·공항", english: "Travel & Airport", icon: "✈", outfit: "외출용 재킷" },
  { id: "restaurant", label: "레스토랑", english: "At a Restaurant", icon: "♨", outfit: "세미포멀" },
  { id: "park", label: "취미·주말", english: "Weekend & Hobbies", icon: "♧", outfit: "캐주얼 후드" },
] as const;
export type AiSceneId = (typeof AI_SCENES)[number]["id"];
export type SceneChoice = AiSceneId | "auto";
const sceneIds: AiSceneId[] = AI_SCENES.map(s => s.id);
export const isAiSceneId = (value: string): value is AiSceneId =>
  sceneIds.some(id => id === value);

const keywords: Record<AiSceneId, RegExp> = {
  home: /(?:\bhome\b|\bliving room\b|집에서|집안에서|집에 있는)/i,
  cafe: /(?:\bcoffee shop\b|\bcaf[eé]\b|\bbarista\b|커피숍|카페에서)/i,
  office: /(?:\boffice\b|\bjob interview\b|\bmeeting at work\b|회사에서|사무실|면접을)/i,
  airport: /(?:\bairport\b|\bflight\b|\bboarding\b|공항에서|비행기|입국심사)/i,
  restaurant: /(?:\brestaurant\b|\bwaiter\b|\bmenu at dinner\b|레스토랑|식당에서)/i,
  park: /(?:\bpark\b|\bhiking\b|\bwalking outdoors\b|공원에서|등산|산책하고)/i,
};
const changeIntent = /(?:let(?:'s| us) (?:practice|pretend|roleplay|talk|go)|imagine (?:we|you)|act as|role.?play|pretend (?:we|you)|we are at|we're at|i am at|i'm at|상황극|역할극|연습하자|연습하고|주제로|바꿔줘|가보자|놀러가|얘기하자)/i;

/** A low-cost, purely local hint (never a model call). User messages alone
 * can change the room; the tutor's own suggestions cannot drive it.
 * Ordinary mentions of an airport or coffee do not force a scene switch. */
export function inferAiScene(turns: Turn[]): AiSceneId | null {
  const recent = turns.filter(t => t.role === "user").slice(-4);
  for (let i = recent.length - 1; i >= 0; i--) {
    const text = recent[i].text.slice(0, 650);
    if (!changeIntent.test(text)) continue;
    const match = AI_SCENES.find(scene => keywords[scene.id].test(text));
    if (match) return match.id;
  }
  return null;
}
