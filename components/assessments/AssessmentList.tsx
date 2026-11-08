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
export default async function AssessmentList(props:Props){
 const administrator=props.administrator??false,base=administrator?'/admin/assessments':'/teacher/assessments';
 const result=await loadList(props).then(rows=>({rows,error:null}),error=>({rows:null,error}));
 if(!result.rows)return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">TALKLY · Assessment forms</h1><p role="alert" className="my-5">{result.error instanceof AssessmentError?result.error.message:'Unable to load assessment forms.'}</p><Link className="text-blue-700" href={administrator?'/admin':'/teacher'}>← Dashboard</Link></main>;
 return <main className="mx-auto max-w-6xl space-y-5 p-6"><Link href={administrator?'/admin':'/teacher'} className="text-blue-700">← Dashboard</Link>
 <h1 className="text-3xl font-bold">{administrator?'초기·학습 관찰 평가서 관리':'Initial & student progress assessment forms'}</h1>
 <p className="text-sm leading-7">{administrator?'기존 점수 입력을 문서 기반 상세 평가서로 대체했습니다.':'The document-based forms replace new score input.'} Reviews remain due every four weeks and after the final completed lesson. / 기존 4주·최종 수업 평가 시점을 유지합니다.</p>
 <p className="text-sm text-slate-600">Latest 100 assigned level tests and 100 regular enrollments. Draft / 임시저장 · Submitted / 제출.</p>
 <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Student / 학생','Form & period / 평가 기간','Saved status / 작성 상태','Action / 열기'].map(h=><th scope="col" key={h} className="border-b p-3">{h}</th>)}</tr></thead><tbody>{result.rows.map(row=><tr key={`${row.kind}-${row.id}-${row.period}`}><th scope="row" className="border-b p-3">{row.name} #{row.id}</th><td className="border-b p-3">{row.label}</td><td className="border-b p-3">{row.record?`${row.record.status} · v${row.record.revision}`:'Not started / 미작성'}</td><td className="border-b p-3"><Link prefetch={false} className="font-semibold text-blue-700" href={`${base}/${row.kind}/${row.id}?period=${row.period}`}>{row.record?'View / edit · 확인·수정':'Write · 작성'} →</Link></td></tr>)}</tbody></table></div>
 {!result.rows.length&&<p>No reviews are due yet. / 현재 평가 대상이 없습니다.</p>}
 <p><Link className="text-blue-700" href={administrator?'/admin/evaluations?legacy=1':'/teacher/reviews?legacy=1'}>Previous score-based evaluation records / 이전 점수 평가 기록 →</Link></p>
 </main>;
}
