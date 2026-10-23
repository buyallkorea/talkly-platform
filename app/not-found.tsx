import Link from "next/link";
export default function NotFound() {
  return <main className="grid min-h-[65vh] place-items-center bg-slate-50 p-6 text-slate-900"><section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8"><p className="text-sm font-bold text-blue-600">TALKLY · 404</p><h1 className="mt-3 text-2xl font-bold">페이지를 찾을 수 없습니다</h1><p className="mt-4 leading-7 text-slate-600">주소가 변경되었거나 현재 계정으로 접근할 수 없는 페이지입니다. 메뉴에서 다시 이동해 주세요.</p><Link href="/" className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white">TALKLY 홈으로</Link></section></main>;
}
