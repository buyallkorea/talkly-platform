import type { Metadata } from "next";
import Link from "next/link";
import { listPublicTeachers } from "@/lib/public-teachers";
import { requireTeacherDirectoryMember } from "@/lib/teacher-directory-access";
import PublicTeacherPhoto from "@/components/teachers/PublicTeacherPhoto";
import PublicTeacherHeader from "@/components/teachers/PublicTeacherHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "TALKLY 강사진 소개 · 회원 전용",
  description: "TALKLY 회원을 위한 강사진 소개 페이지입니다.",
  robots: { index: false, follow: false },
};

export default async function TeacherDirectoryPage() {
  await requireTeacherDirectoryMember("/teachers");
  const teachers = await listPublicTeachers();
  return <div className="talkly-public-teachers-page">
    <PublicTeacherHeader />
    <main className="talkly-public-teachers-container">
      <nav className="talkly-public-teachers-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link><span aria-hidden="true">/</span><span>강사진 소개</span>
      </nav>
      <section className="talkly-public-teachers-hero">
        <span className="talkly-public-teachers-eyebrow">OUR TEACHERS</span>
        <h1>TALKLY 강사진 소개</h1>
        <p>학생의 수준과 학습 목표에 맞는 수업을 함께하는 강사들을 소개합니다. 강사를 선택하면 상세 프로필을 확인할 수 있습니다.</p>
      </section>
      {teachers.length ? <section aria-label="공개 강사진" className="talkly-public-teachers-grid">
        {teachers.map(teacher => <Link href={"/teachers/" + teacher.user_id}
          className="talkly-public-teachers-card" key={teacher.user_id}
          aria-label={teacher.display_name + " 강사 상세 소개 보기"}>
          <PublicTeacherPhoto src={teacher.profile_image_url} name={teacher.display_name}/>
          <div className="talkly-public-teachers-card-info">
            <h2>{teacher.display_name}</h2>
            {teacher.nationality && <p>{teacher.nationality}</p>}
            <span>강사 소개 보기 <span aria-hidden="true">→</span></span>
          </div>
        </Link>)}
      </section> : <section className="talkly-public-teachers-empty" role="status">
        <h2>소개할 강사진을 준비 중입니다.</h2>
        <p>관리자가 공개를 허용한 강사의 프로필이 이곳에 표시됩니다.</p>
      </section>}
      <aside className="talkly-public-teachers-cta">
        <div><h2>나에게 맞는 수업을 시작해 보세요.</h2><p>TALKLY 레벨테스트를 통해 학습 방향을 확인할 수 있습니다.</p></div>
        <Link href="/level-test">레벨테스트 안내 →</Link>
      </aside>
    </main>
  </div>;
}
