export default function PageLoading({ english = false }: { english?: boolean }) {
  return <section role="status" aria-live="polite" aria-busy="true" className="mx-auto w-full max-w-6xl px-6 py-10 text-slate-700">
    <p className="mb-6 text-sm font-semibold">{english ? "Loading your workspace…" : "화면을 불러오고 있습니다…"}</p>
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">{[1, 2, 3].map(id => <div key={id} className="h-28 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />)}</div>
    <div aria-hidden="true" className="mt-6 h-52 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
  </section>;
}
