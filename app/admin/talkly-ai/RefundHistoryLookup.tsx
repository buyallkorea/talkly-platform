"use client";
import { useState } from "react";
type Result = {
 refund: { id:string;state:string;reason:string;created_at:string };
 payment: { order_id:string;amount:number;status:string } | null;
 audit: {id:string;event_type:string;note:string;created_at:string}[];
 reviews: {id:string;from_state:string;to_state:string;created_at:string}[];
 truncated:boolean;
};
export default function RefundHistoryLookup(){
 const [kind,setKind]=useState("orderId"),[value,setValue]=useState("");
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [lastQuery,setLastQuery]=useState("");
 async function search(){
  setBusy(true);setError("");setResult(null);
  setLastQuery(value.trim());
  try {
   const query=new URLSearchParams({[kind]:value.trim()});
   const res=await fetch("/api/talkly-ai/admin/refund-history?"+query,{cache:"no-store",signal:AbortSignal.timeout(12000)});
   const data=await res.json();
   if(res.status===403)throw new Error("관리자 권한이 없어 환불 이력을 조회할 수 없습니다.");
   if(res.status===404)throw new Error("해당 번호의 환불 요청이 없습니다. 번호를 다시 확인해 주세요.");
   if(res.status===503)throw new Error("정산 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
   if(!res.ok)throw new Error(data.error||"환불 이력을 조회하지 못했습니다.");
   setResult(data);
  }catch(e){setError(e instanceof Error?e.message:"조회 오류가 발생했습니다.");}
  finally{setBusy(false);}
 }
 const date=(v:string)=>new Date(v).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});
 return <section>
  <h2>과거 환불 요청 정확 조회</h2>
  <p>최근 100건에 없는 주문도 주문번호 또는 환불 접수번호로 조회합니다. 조회만 하며 환불을 실행하지 않습니다.</p>
  <label htmlFor="refund-lookup-kind">조회 기준</label>
  <select id="refund-lookup-kind" value={kind} onChange={e=>setKind(e.target.value)}>
   <option value="orderId">주문번호</option><option value="requestId">환불 접수번호</option>
  </select>
  <label htmlFor="refund-lookup-value">검색할 번호</label>
  <input id="refund-lookup-value" value={value} onChange={e=>setValue(e.target.value)} placeholder="전체 번호를 입력해 주세요"/>
  <button disabled={busy||!value.trim()} onClick={search}>{busy?"조회 중…":"정확 조회"}</button>
  {error&&<p role="alert">{error} {lastQuery&&"조회값: "+lastQuery}</p>}
  {result&&<div>
   <h3>{result.payment?.order_id??result.refund.id}</h3>
   <p>요청 상태: {result.refund.state} · 결제 상태: {result.payment?.status??"확인 필요"} · 금액: {result.payment?.amount?.toLocaleString()??"확인 필요"}원</p>
   <h4>정산 감사 이력</h4>
   {result.audit.length?<ul>{result.audit.map(v=><li key={v.id}>{date(v.created_at)} · {v.event_type} · {v.note}</li>)}</ul>:<p>기록 없음</p>}
   <h4>검토 상태 변경 이력</h4>
   {result.reviews.length?<ul>{result.reviews.map(v=><li key={v.id}>{date(v.created_at)} · {v.from_state} → {v.to_state}</li>)}</ul>:<p>기록 없음</p>}
   {result.truncated&&<p>각 이력은 최대 500건까지 표시됩니다. 전체 이력이 아닐 수 있습니다.</p>}
  </div>}
 </section>;
}
