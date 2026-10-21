import type { Metadata } from "next";
import LegalDocument from "@/components/legal/LegalDocument";
import { privacy } from "@/components/legal/legal-content";

export const metadata: Metadata = {
  title: "개인정보처리방침 검토 초안 | TALKLY",
  description: "TALKLY 개인정보 항목, 처리 목적 및 이용자 권리 검토 초안",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return <LegalDocument kind="privacy" sections={privacy} />;
}
