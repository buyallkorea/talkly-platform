import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTeacherProfile } from "@/lib/public-teachers";
import { requireTeacherDirectoryMember } from "@/lib/teacher-directory-access";
import PublicTeacherPhoto from "@/components/teachers/PublicTeacherPhoto";
import PublicTeacherHeader from "@/components/teachers/PublicTeacherHeader";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  // Member-only content must not leak private profile fields into metadata.
  return { title: "강사 상세 소개 · 회원 전용 | TALKLY", robots: { index: false, follow: false } };
}

export default async function TeacherProfilePage({params}: Props) {
  const {id} = await params;
  await requireTeacherDirectoryMember("/teachers/" + encodeURIComponent(id));
  const teacher = await getPublicTeacherProfile(id);
  if (!teacher) notFound();
  return <div className="talkly-public-teachers-page">
    <PublicTeacherHeader />
    <main className="talkly-public-teachers-container">
      <nav className="talkly-public-teachers-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link><span aria-hidden="true">/</span>
        <Link href="/teachers">강사진 소개</Link><span aria-hidden="true">/</span>
        <span>{teacher.display_name}</span>
      </nav>
      <div className="talkly-public-teacher-profile">
        <section className="talkly-public-teacher-profile-hero">
          <div className="talkly-public-teacher-profile-portrait">
            <PublicTeacherPhoto src={teacher.profile_image_url} name={teacher.display_name} className="is-detail"/>
          </div>
          <div className="talkly-public-teacher-profile-intro">
            <span className="talkly-public-teachers-eyebrow">TEACHER INTRODUCTION</span>
            <h1>{teacher.display_name} 강사 소개</h1>
            {teacher.bio
              ? <p className="talkly-public-teacher-introduction">{teacher.bio}</p>
              : <p className="talkly-public-teacher-introduction is-empty">강사 소개글을 준비 중입니다.</p>}
          </div>
        </section>

        <div className="talkly-public-teacher-profile-sections">
          <section className="talkly-public-teacher-info-card">
            <span className="talkly-public-teacher-card-kicker">EXPERIENCE</span>
            <h2>강의 경력</h2>
            {teacher.years_experience !== null
              ? <p className="talkly-public-teacher-experience">{teacher.years_experience}년</p>
              : <p className="talkly-public-teacher-prose is-empty">정보 준비 중</p>}
          </section>
          <section className="talkly-public-teacher-info-card">
            <span className="talkly-public-teacher-card-kicker">EDUCATION</span>
            <h2>학력</h2>
            <p className={"talkly-public-teacher-prose" + (!teacher.education ? " is-empty" : "")}>{teacher.education || "정보 준비 중"}</p>
          </section>
          <section className="talkly-public-teacher-info-card">
            <span className="talkly-public-teacher-card-kicker">CERTIFICATIONS</span>
            <h2>자격 및 인증</h2>
            <p className={"talkly-public-teacher-prose" + (!teacher.certifications ? " is-empty" : "")}>{teacher.certifications || "정보 준비 중"}</p>
          </section>
        </div>
        <div className="talkly-public-teacher-cta">
          <div><h2>TALKLY와 함께 영어를 시작해 보세요.</h2><p>학습 목표에 맞는 수업을 안내해 드립니다.</p></div>
          <Link href="/level-test">레벨테스트 신청 →</Link>
        </div>
      </div>
    </main>
  </div>;
}
