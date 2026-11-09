"use client";
import { useEffect, useState } from "react";

type Props = { src: string | null; name: string; className?: string; };
export default function PublicTeacherPhoto({src, name, className = ""}: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className={"talkly-public-teacher-photo " + className}>
    {src && !failed
      ? <img src={src} alt={name + " 강사 프로필 사진"} loading="lazy" onError={() => setFailed(true)}/>
      : <span aria-label="프로필 사진 미등록">{name.trim().charAt(0).toUpperCase() || "T"}</span>}
  </div>;
}
