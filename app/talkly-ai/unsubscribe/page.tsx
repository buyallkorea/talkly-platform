import UnsubscribeForm from "./UnsubscribeForm";
export const metadata = {
  title: "안내 수신거부 | TALKLY AI",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Unsubscribe() {
  return (
    <main className="tai tai-info">
      <h1>TALKLY AI 안내 수신거부</h1>
      <UnsubscribeForm />
    </main>
  );
}
