import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTeacherProfile } from "@/lib/public-teachers";
import PublicTeacherPhoto from "@/components/teachers/PublicTeacherPhoto";
import PublicTeacherHeader from "@/components/teachers/PublicTeacherHeader";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {id} = await params;
  const teacher = await getPublicTeacherProfile(id);
  if (!teacher) return { title: "강사 소개 | TALKLY", robots: { index: false } };
  return {
    title: teacher.display_name + " 강사 소개 | TALKLY",
    description: teacher.bio ? teacher.bio.replace(/\s+/g, " ").slice(0, 150) : teacher.display_name + " 강사의 TALKLY 소개 페이지입니다.",
  };
}

export default async function TeacherProfilePage({params}: Props) {
  const {id} = await params;
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
            <span className="talkly-public-teachers-eyebrow">MEET OUR TEACHER</span>
            <h1>{teacher.display_name}</h1>
            {teacher.nationality && <p className="talkly-public-teacher-nationality">{teacher.nationality}</p>}
            <p>학생 한 명 한 명의 성장을 함께하는 TALKLY 강사입니다.</p>
            {teacher.specialties.length > 0 && <div aria-label="지도 전문 분야" className="talkly-public-teacher-specialties">
              {teacher.specialties.map((skill,i) => <span key={skill + "-" + i}>{skill}</span>)}
            </div>}
            <Link href="/teachers" className="talkly-public-teacher-all-link">← 전체 강사진 보기</Link>
          </div>
        </section>

        <div className="talkly-public-teacher-profile-sections">
          {teacher.bio && <section className="talkly-public-teacher-info-card">
            <span className="talkly-public-teacher-card-kicker">ABOUT</span>
            <h2>강사 소개</h2>
            <p className="talkly-public-teacher-prose">{teacher.bio}</p>
          </section>}
          {teacher.years_experience !== null && <section className="talkly-public-teacher-info-card">
            <span className="talkly-public-teacher-card-kicker">EXPERIENCE</span>
            <h2>강의 경력</h2>
            <p className="talkly-public-teacher-experience">{teacher.years_experience}년</p>
          </section>}
          {teacher.education && <section className="talkly-public-teacher-info-card">
            <span className="talkly-public-teacher-card-kicker">EDUCATION</span>
            <h2>학력</h2>
            <p className="talkly-public-teacher-prose">{teacher.education}</p>
          </section>}
          {teacher.certifications && <section className="talkly-public-teacher-info-card">
            <span className="talkly-public-teacher-card-kicker">CERTIFICATIONS</span>
            <h2>자격 및 인증</h2>
            <p className="talkly-public-teacher-prose">{teacher.certifications}</p>
          </section>}
        </div>
        <div className="talkly-public-teacher-cta">
          <div><h2>TALKLY와 함께 영어를 시작해 보세요.</h2><p>학습 목표에 맞는 수업을 안내해 드립니다.</p></div>
          <Link href="/level-test">레벨테스트 신청 →</Link>
        </div>
      </div>
    </main>
  </div>;
}
