import type { AiSceneId } from "@/lib/talkly-ai/scenes";

type FaceId = "lively-male" | "lively-female" | "intellectual-male" |
  "intellectual-female" | "calm-male" | "calm-female";
type Identity = {
  skin: string; shade: string; hair: string; light: string; eye: string; lip: string;
  eyebrow: number; width: number; hairType: "swept" | "bun" | "side" | "long" | "curly" | "bob";
  mole?: boolean; freckles?: boolean;
};
const IDENTITIES: Record<FaceId, Identity> = {
  "lively-male": { skin: "#e8af8c", shade: "#c88467", hair: "#533529", light: "#82513b", eye: "#443f3a", lip:"#a75f61", eyebrow: 1.5, width: 79, hairType: "swept" },
  "lively-female": { skin: "#f3c5a9", shade: "#cb977a", hair: "#a45439", light: "#ca8060", eye: "#4e4541", lip:"#bd777e", eyebrow: 1.2, width: 72, hairType: "bun", freckles: true },
  "intellectual-male": { skin: "#d4a17f", shade: "#b6815f", hair: "#302b31", light: "#4b454b", eye: "#28282e", lip:"#985f62", eyebrow: 2.5, width: 83, hairType: "side" },
  "intellectual-female": { skin: "#e4b291", shade: "#ba8468", hair: "#302931", light: "#594354", eye: "#40383a", lip:"#a96d72", eyebrow: 2, width: 75, hairType: "long", mole: true },
  "calm-male": { skin: "#e8b99b", shade: "#be8568", hair: "#675142", light: "#98705a", eye: "#463a34", lip:"#ac7771", eyebrow: 1.5, width: 81, hairType: "curly" },
  "calm-female": { skin: "#f1c0a9", shade: "#c98f7e", hair: "#674038", light: "#90604c", eye: "#483e42", lip:"#bc767e", eyebrow: 1.3, width: 76, hairType: "bob" },
};
function isFaceId(value: string): value is FaceId {
  return Object.prototype.hasOwnProperty.call(IDENTITIES, value);
}
export const TUTOR_FACE_IDS = Object.keys(IDENTITIES) as FaceId[];
export function fixedTutorIdentity(id: string): Identity {
  return IDENTITIES[isFaceId(id) ? id : "lively-female"];
}

function Hair({ identity: i }: { identity: Identity }) {
  const base = i.hair;
  if (i.hairType === "bun")
    return <g fill={base}>
      <ellipse cx="262" cy="103" rx="39" ry="48"/>
      <path d="M108 146Q90 20 178 23Q275 18 265 145L250 154Q242 99 215 92Q177 116 109 145Z"/>
      <path d="M108 148Q102 92 134 59Q150 36 172 30Q136 89 126 152Z"/>
      <path d="M251 147Q269 73 227 43Q264 74 264 154Z"/>
    </g>;
  if (i.hairType === "long")
    return <g fill={base}>
      <path d="M104 137Q92 38 180 25Q267 22 271 139L284 344Q264 366 241 339L236 174Q202 120 121 168L119 330Q94 344 88 322Z"/>
      <path d="M113 137Q96 37 165 34Q240 19 260 119Q234 88 201 75Q164 130 112 151Z"/>
      <path d="M106 227Q89 276 105 322" stroke={i.light} strokeWidth="7" fill="none" strokeLinecap="round"/>
    </g>;
  if (i.hairType === "bob")
    return <g fill={base}>
      <path d="M98 137Q99 40 179 29Q276 28 273 145L266 266Q242 292 218 262L220 194Q183 134 133 188L127 273Q101 290 89 264Z"/>
      <path d="M106 137Q106 36 173 34Q237 29 262 100Q217 97 181 80Q150 137 106 153Z"/>
      <path d="M94 251Q110 281 143 264" fill="none" stroke={i.light} strokeWidth="12" strokeLinecap="round"/>
    </g>;
  if (i.hairType === "curly")
    return <g fill={base}>
      <path d="M105 148Q86 74 131 45Q179 8 228 37Q277 65 262 151Q247 116 235 104Q181 111 118 160Z"/>
      {[[117,77],[141,47],[170,36],[200,38],[233,56],[251,87]].map(([cx,cy],j)=>
        <ellipse key={j} cx={cx} cy={cy} rx="30" ry="28" fill={j%2?i.light:base}/>)}
      <path d="M104 133Q104 92 125 72M233 68Q259 93 255 143" stroke={base} strokeWidth="21" fill="none" strokeLinecap="round"/>
    </g>;
  if (i.hairType === "side")
    return <g fill={base}>
      <path d="M101 143Q87 47 154 30Q244 4 267 100L263 145L245 155Q248 110 226 90Q180 107 124 155Z"/>
      <path d="M106 106Q112 46 192 29Q250 23 255 81Q229 62 197 69Q145 126 106 129Z"/>
      <path d="M115 101Q167 60 218 54" stroke={i.light} strokeWidth="12" fill="none" strokeLinecap="round"/>
    </g>;
  return <g fill={base}>
    <path d="M102 149Q89 52 152 27Q232 2 266 92L257 154L237 135Q228 89 212 86Q156 116 123 162Z"/>
    <path d="M108 111Q110 49 168 28Q221 4 244 58Q232 75 208 79Q168 61 108 132Z"/>
    <path d="M128 78Q167 42 196 46" stroke={i.light} strokeWidth="14" fill="none" strokeLinecap="round"/>
  </g>;
}

/** Outfit is intentionally independent of TutorFaceIdentity, so the face path
 * is byte-for-byte the same for this tutor across every scene/outfit. */
function OutfitLayer({ scene }: { scene: AiSceneId }) {
  const jacket: Record<AiSceneId, string> = {
    home: "#9b7db6", cafe: "#c0a182", office: "#344a73",
    airport: "#798fa1", restaurant: "#7a555e", park: "#748c93",
  };
  const under: Record<AiSceneId, string> = {
    home: "#e9d9f8", cafe: "#f6e8d7", office: "#e5ecf5",
    airport: "#f3eae3", restaurant: "#fff4ed", park: "#d9eff0",
  };
  return <g className="tai-avatar-outfit">
    <path d="M139 299L102 307Q50 317 38 429H326Q315 317 256 308L223 299Z" fill={jacket[scene]} />
    <path d="M149 293L180 333L208 294L218 427H141Z" fill={under[scene]}/>
    {scene === "office" || scene === "airport" ?
      <>
        <path d="M141 295L179 341L146 376L120 311Z" fill="#ffffff" opacity=".58"/>
        <path d="M220 295L184 341L219 376L247 313Z" fill="#ffffff" opacity=".38"/>
        <path d="M180 335L194 344L186 402L177 402L167 344Z" fill={scene==="office"?"#6851a9":"#956b70"}/>
      </> : scene === "cafe" || scene === "restaurant" ?
        <>
          <path d="M117 319L138 330L146 429H218L224 326L249 319L230 428H130Z" fill="#615967" opacity=".65"/>
          <path d="M170 327L169 429M191 327L192 429" stroke="#e2cabb" strokeWidth="3"/>
        </> : scene === "park" ?
        <>
          <path d="M140 306Q177 339 220 306" fill="none" stroke="#d8f3f4" strokeWidth="17"/>
          <path d="M158 334L157 373M201 334L201 373" stroke="#d8f3f4" strokeWidth="4" strokeLinecap="round"/>
        </> :
        <path d="M140 307Q180 350 220 307" stroke="#dcc6e6" strokeWidth="13" fill="none" strokeLinecap="round"/>}
    <path d="M38 429H326" stroke="#ffffff" strokeWidth="3" opacity=".3"/>
  </g>;
}
function TutorFaceIdentity({ tutorId }: { tutorId: string }) {
  const i = fixedTutorIdentity(tutorId);
  const eyeX = i.width * .36;
  return <g className="tai-avatar-head">
    <Hair identity={i}/>
    <path d="M159 264L151 310Q181 338 214 307L204 264Z" fill={i.skin}/>
    <path d="M153 279Q180 294 208 278L208 303Q177 325 153 298Z" fill={i.shade} opacity=".35"/>
    <ellipse cx={180-i.width*.92} cy="177" rx="17" ry="28" fill={i.skin}/>
    <ellipse cx={180+i.width*.92} cy="177" rx="17" ry="28" fill={i.skin}/>
    <path d={`M${180-i.width} 141Q${180-i.width-2} 67 180 57Q${180+i.width+2} 66 ${180+i.width} 141L${180+i.width-4} 225Q${180+i.width*.7} 275 180 287Q${180-i.width*.7} 273 ${180-i.width+4} 226Z`} fill={i.skin}/>
    <path d={`M${180-i.width+5} 170Q${180-i.width+5} 229 151 268Q${145-i.width*.1} 239 ${180-i.width} 184Z`} fill={i.shade} opacity=".14"/>
    <ellipse cx="152" cy="211" rx="24" ry="12" fill="#d9747c" opacity=".14"/>
    <ellipse cx="209" cy="211" rx="23" ry="12" fill="#d9747c" opacity=".14"/>
    <path d={`M${180-eyeX-21} 144Q${180-eyeX} ${137-i.eyebrow*2} ${180-eyeX+18} 144`} stroke={i.hair} strokeWidth={5+i.eyebrow} fill="none" strokeLinecap="round"/>
    <path d={`M${180+eyeX-18} 144Q${180+eyeX} ${137-i.eyebrow*2} ${180+eyeX+21} 144`} stroke={i.hair} strokeWidth={5+i.eyebrow} fill="none" strokeLinecap="round"/>
    <g className="tai-avatar-eyes">
      <ellipse cx={180-eyeX} cy="168" rx="17" ry="8.8" fill="#fffdf9"/>
      <ellipse cx={180+eyeX} cy="168" rx="17" ry="8.8" fill="#fffdf9"/>
      <ellipse cx={180-eyeX+1} cy="168" rx="7.8" ry="8.1" fill={i.eye}/>
      <ellipse cx={180+eyeX+1} cy="168" rx="7.8" ry="8.1" fill={i.eye}/>
      <ellipse cx={180-eyeX+3} cy="165" rx="2.3" ry="2.9" fill="#fff" />
      <ellipse cx={180+eyeX+3} cy="165" rx="2.3" ry="2.9" fill="#fff" />
      <path d={`M${180-eyeX-18} 164Q${180-eyeX} 151 ${180-eyeX+17} 164`} fill="none" stroke={i.hair} strokeWidth="3.2" strokeLinecap="round"/>
      <path d={`M${180+eyeX-18} 164Q${180+eyeX} 151 ${180+eyeX+17} 164`} fill="none" stroke={i.hair} strokeWidth="3.2" strokeLinecap="round"/>
    </g>
    <path d="M178 177Q175 203 170 217Q180 223 192 216" fill="none" stroke={i.shade} strokeWidth="3.6" opacity=".68" strokeLinecap="round"/>
    <ellipse cx="167" cy="215" rx="3" ry="2" fill={i.shade} opacity=".4" />
    <g className="tai-avatar-mouth">
      <path d="M152 237Q180 246 208 237Q183 260 156 246Z" fill={i.lip}/>
      <ellipse cx="180" cy="245" rx="22" ry="5" fill="#5b2f37" className="tai-avatar-lipsync"/>
      <path d="M152 238Q179 248 208 238" stroke={i.lip} strokeWidth="3.1" fill="none" strokeLinecap="round"/>
      <path d="M154 252Q181 260 204 251" fill="none" stroke={i.shade} opacity=".4" strokeWidth="2"/>
    </g>
    {i.freckles ? <g fill={i.shade} opacity=".35">
      {[142,148,155,204,211,216].map((x,n)=><circle key={n} cx={x} cy={197+n%3*2} r="1.65"/>)}
    </g> : null}
    {i.mole ? <circle cx="213" cy="223" r="2.4" fill={i.shade}/> : null}
    {i.hairType==="bun" ? <path d="M113 113Q104 143 111 177M248 110Q259 136 252 177" stroke={i.hair} strokeWidth="12" strokeLinecap="round" fill="none"/> : null}
    {i.hairType==="long" || i.hairType==="bob" ? <path d="M104 143Q100 183 110 224M256 142Q264 186 251 226" stroke={i.hair} strokeWidth="13" strokeLinecap="round" fill="none"/> : null}
  </g>;
}

export default function TutorPortrait({ tutorId, scene = "home", className = "" }: {
  tutorId: string; scene?: AiSceneId; className?: string;
}) {
  return <svg className={"tai-tutor-portrait " + className} viewBox="0 0 360 430"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" role="presentation">
    <ellipse cx="181" cy="422" rx="150" ry="11" fill="#1b1734" opacity=".15"/>
    <OutfitLayer scene={scene}/>
    <TutorFaceIdentity tutorId={tutorId}/>
  </svg>;
}
