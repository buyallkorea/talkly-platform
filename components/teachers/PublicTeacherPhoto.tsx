"use client";
import { useState } from "react";

type Props = { src: string | null; name: string; className?: string; };
export default function PublicTeacherPhoto({src, name, className = ""}: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !!src && failedSrc === src;
  return <div className={"talkly-public-teacher-photo " + className}>
    {src && !failed
      ? <img src={src} alt={name + " 강사 프로필 사진"} loading="lazy" onError={() => setFailedSrc(src)}/>
      : <span aria-label="프로필 사진 미등록">{name.trim().charAt(0).toUpperCase() || "T"}</span>}
  </div>;
}
