import Link from "next/link";
import { assessmentContext, AssessmentError, progressKey, progressWindow } from "@/lib/assessments/server";
import { getTeacherEvaluationRequirements, type TeacherEvaluationSession, type ExistingTeacherEvaluation } from "@/lib/teacher-evaluations";
type Props={searchParams:Promise<{period?:string;enrollment?:string}>;administrator?:boolean};
async function loadList({administrator=false,searchParams}:Props){
 const ctx=await assessmentContext();
 if((ctx.role==='admin')!==administrator)throw new AssessmentError("Please use your own dashboard. / 권한에 맞는 메뉴를 이용해 주세요.",403);
 let interviewsQuery=ctx.db.from('level_test_interviews').select('id,status,level_test_id,level_tests(student_name)').order('id',{ascending:false}).limit(100);
 let enrollmentsQuery=ctx.db.from('enrollments').select('id,status,student_user_id,child_id,start_date,total_lessons').eq('is_test',false).order('id',{ascending:false}).limit(100);
 if(!administrator){interviewsQuery=interviewsQuery.eq('tester_user_id',ctx.user.id);enrollmentsQuery=enrollmentsQuery.eq('teacher_user_id',ctx.user.id)}
 const filter=(await searchParams).enrollment;
 if(filter && /^[1-9]\d*$/.test(filter) && Number.isSafeInteger(Number(filter))){enrollmentsQuery=enrollmentsQuery.eq('id',Number(filter));interviewsQuery=interviewsQuery.eq('id',-1)}
 const [interviews,enrollments]=await Promise.all([interviewsQuery,enrollmentsQuery]);
 if(interviews.error||enrollments.error)throw new AssessmentError("Unable to load assigned learners.",503);
 const ids1=(interviews.data??[]).map(row=>row.id),ids2=(enrollments.data??[]).map(row=>row.id);
 const [initial,monthly,sessions]=await Promise.all([
 ids1.length?ctx.db.from('teacher_assessments').select('source_id,status,revision,period_key').eq('kind','initial').in('source_id',ids1):{data:[],error:null},
 ids2.length?ctx.db.from('teacher_assessments').select('source_id,status,revision,period_key').eq('kind','monthly').in('source_id',ids2).limit(1000):{data:[],error:null},
 ids2.length?ctx.db.from('class_sessions').select('id,enrollment_id,lesson_number,scheduled_start,status').eq('is_test',false).in('enrollment_id',ids2).limit(1000):{data:[],error:null},
 ]);
 if(initial.error||monthly.error||sessions.error||(sessions.data?.length??0)>=1000||(monthly.data?.length??0)>=1000)throw new AssessmentError("Unable to load assessment storage or review schedules. / 평가서 저장소·평가 일정을 확인해 주세요.",503);
 const sessionIds=(sessions.data??[]).map(row=>row.id);
 const legacy=sessionIds.length?await ctx.db.from('evaluations').select('class_session_id,evaluation_type,period_number').in('class_session_id',sessionIds).limit(1000):{data:[],error:null};
 if(legacy.error||(legacy.data?.length??0)>=1000)throw new AssessmentError("Unable to verify existing reviews.",503);
 const childIds=(enrollments.data??[]).flatMap(row=>row.child_id?[row.child_id]:[]),studentIds=(enrollments.data??[]).flatMap(row=>row.student_user_id?[row.student_user_id]:[]);
 const [children,students]=await Promise.all([
 childIds.length?ctx.db.from('children').select('id,name').in('id',childIds):{data:[],error:null},
 studentIds.length?ctx.db.from('profiles').select('id,name').in('id',studentIds):{data:[],error:null},
 ]);
 if(children.error||students.error)throw new AssessmentError("Unable to load learner names.",503);
 const rows=[
 ...(interviews.data??[]).map(row=>({id:row.id,kind:'initial',period:'initial',name:(Array.isArray(row.level_tests)?row.level_tests[0]:row.level_tests)?.student_name??'Learner',label:'Initial diagnostic / 초기 진단',record:initial.data?.find(r=>r.source_id===row.id)})),
 ...(enrollments.data??[]).flatMap(row=>{
  const learner=row.child_id?children.data?.find(c=>c.id===row.child_id):students.data?.find(s=>s.id===row.student_user_id);
  const own=(sessions.data??[]).filter(s=>s.enrollment_id===row.id);
  const ownIds=new Set(own.map(s=>s.id));
  return getTeacherEvaluationRequirements({enrollmentId:row.id,startDate:row.start_date,totalLessons:row.total_lessons,sessions:own as TeacherEvaluationSession[],existingEvaluations:(legacy.data??[]).filter(e=>ownIds.has(e.class_session_id)) as ExistingTeacherEvaluation[]}).map(requirement=>{
   const period=progressKey(requirement),anchor=own.find(s=>s.id===requirement.sessionId);
   const day=anchor?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(anchor.scheduled_start)):row.start_date;
   const window=row.start_date&&day?progressWindow(row.start_date,requirement,day):null;
   return {id:row.id,kind:'monthly',period,name:learner?.name??'Learner',label:`${requirement.type==='final'?'Final progress review / 최종 관찰평가':`Month ${requirement.periodNumber} / ${requirement.periodNumber}차 관찰평가`} · ${window?.from??''} ~ ${window?.to??''}`,record:monthly.data?.find(r=>r.source_id===row.id&&r.period_key===period)};
  });
 }),
 ];return rows;
}
export default async function AssessmentList(props:Props) {
  const administrator=props.administrator??false;
  const base=administrator?"/admin/assessments":"/teacher/assessments";
  const dashboard=administrator?"/admin":"/teacher";
  const result=await loadList(props).then(rows=>({rows,error:null}),error=>({rows:null,error}));
  if(!result.rows) return (
    <div className="talkly-assessment-page">
      <div className="talkly-assessment-empty talkly-assessment-error">
        <h1>Assessment forms / 평가서</h1>
        <p role="alert">{result.error instanceof AssessmentError?result.error.message:"Unable to load assessment forms. / 평가서를 불러올 수 없습니다."}</p>
        <Link className="talkly-assessment-button talkly-assessment-button-secondary" href={dashboard}>{administrator?"관리자로 돌아가기":"Back to dashboard"}</Link>
      </div>
    </div>
  );
  const rows=result.rows;
  const submitted=rows.filter(row=>row.record?.status==="submitted").length;
  const drafts=rows.filter(row=>row.record?.status==="draft").length;
  const notStarted=rows.length-submitted-drafts;
  return (
    <div className="talkly-assessment-page">
      <Link href={dashboard} className="talkly-assessment-back">{administrator?"← 관리자 대시보드":"← Teacher dashboard"}</Link>
      <header className="talkly-assessment-hero">
        <div>
          <p className="talkly-assessment-eyebrow">TALKLY · {administrator?"ASSESSMENT MANAGEMENT":"TEACHER PORTAL"}</p>
          <h1>{administrator?"학습 평가 관리":"Student assessment forms"}</h1>
          <p>{administrator?"초기 진단·정규수업 관찰평가의 작성 상태를 확인하고 수정할 수 있습니다.":"Manage initial diagnostic, four-week and final student progress reviews."}</p>
        </div>
        <span className="talkly-assessment-hero-tag">{administrator?"평가서 관리":"MY REVIEWS"}</span>
      </header>
      <section className="talkly-assessment-stats" aria-label={administrator?"평가 현황":"Assessment status"}>
        <div className="talkly-assessment-stat">
          <span>{administrator?"평가 대상":"Total due"}</span>
          <strong>{rows.length}</strong>
          <small>{administrator?"초기·정기 평가 포함":"Initial & progress"}</small>
        </div>
        <div className="talkly-assessment-stat">
          <span>{administrator?"미작성":"Not started"}</span>
          <strong>{notStarted}</strong>
          <small>{administrator?"입력 대기":"Awaiting entry"}</small>
        </div>
        <div className="talkly-assessment-stat">
          <span>{administrator?"임시저장":"Drafts"}</span>
          <strong>{drafts}</strong>
          <small>{administrator?"작성 중":"In progress"}</small>
        </div>
        <div className="talkly-assessment-stat">
          <span>{administrator?"제출 완료":"Submitted"}</span>
          <strong>{submitted}</strong>
          <small>{administrator?"조회·수정 가능":"Available to review"}</small>
        </div>
      </section>
      <section className="talkly-assessment-panel" aria-labelledby="assessment-list-heading">
        <div className="talkly-assessment-panel-header">
          <div>
            <p className="talkly-assessment-kicker">{administrator?"EVALUATION RECORDS":"ASSESSMENT RECORDS"}</p>
            <h2 id="assessment-list-heading">{administrator?"평가서 목록":"My evaluations"}</h2>
            <p>{administrator?"학생별 평가 시점과 제출 여부를 확인하세요.":"Choose an assigned review to start, continue or update your assessment."}</p>
          </div>
          <span className="talkly-assessment-count">{rows.length} {administrator?"건":"reviews"}</span>
        </div>
        {rows.length>0 ? (
          <div className="talkly-assessment-table-wrap">
            <table className="talkly-assessment-table">
              <thead><tr>
                <th scope="col">{administrator?"학생":"Student"}</th>
                <th scope="col">{administrator?"평가 유형 및 기간":"Assessment / period"}</th>
                <th scope="col">{administrator?"작성 상태":"Status"}</th>
                <th scope="col">{administrator?"관리":"Action"}</th>
              </tr></thead>
              <tbody>{rows.map(row=>(
                <tr key={row.kind+"-"+row.id+"-"+row.period}>
                  <th scope="row"><span className="talkly-assessment-name">{row.name}</span><small className="talkly-assessment-id">ID #{row.id}</small></th>
                  <td><span className="talkly-assessment-type">{row.kind==="initial"?(administrator?"초기 진단":"Initial diagnostic"):(administrator?"정규수업 관찰":"Progress review")}</span><p className="talkly-assessment-period">{row.label}</p></td>
                  <td><span className={"talkly-assessment-state "+(row.record?.status==="submitted"?"is-submitted":row.record?.status==="draft"?"is-draft":"is-empty")}>{row.record?.status==="submitted"?(administrator?"제출 완료":"Submitted"):row.record?.status==="draft"?(administrator?"임시저장":"Draft"):(administrator?"미작성":"Not started")}</span>{row.record && <small className="talkly-assessment-revision">Revision {row.record.revision}</small>}</td>
                  <td><Link prefetch={false} className="talkly-assessment-button talkly-assessment-button-primary" href={base+"/"+row.kind+"/"+row.id+"?period="+row.period}>{row.record?(administrator?"확인·수정":"View / edit"):(administrator?"평가 작성":"Start review")} <span aria-hidden="true">→</span></Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="talkly-assessment-empty" role="status">
            <span className="talkly-assessment-empty-icon" aria-hidden="true">✓</span>
            <strong>{administrator?"현재 작성할 평가서가 없습니다.":"No reviews are due yet."}</strong>
            <p>{administrator?"레벨테스트 또는 정규수업의 평가 시점이 되면 이곳에 표시됩니다.":"Assigned diagnostic and scheduled progress reviews will appear here."}</p>
          </div>
        )}
      </section>
      <aside className="talkly-assessment-note">
        <div><strong>{administrator?"평가서 안내":"About these reviews"}</strong><p>{administrator?"기존 4주·최종 수업 평가 일정은 그대로 유지하며 과거 점수 평가도 보존됩니다.":"Four-week and final review timing is unchanged. Previous score-based records remain available."}</p></div>
        <Link href={administrator?"/admin/evaluations?legacy=1":"/teacher/reviews?legacy=1"}>{administrator?"이전 점수 평가 기록 보기":"View previous score records"} →</Link>
      </aside>
    </div>
  );
}
