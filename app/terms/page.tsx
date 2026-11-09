import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { terms } from "@/components/legal/legal-content";

export const metadata: Metadata = {
  title: "이용약관 검토 초안 | TALKLY",
  description: "TALKLY 수강 및 서비스 이용 기준 검토 초안",
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return <LegalDocument kind="terms" sections={terms} />;
}
