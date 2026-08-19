"use client";

import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

type GlobalLogoutButtonProps = {
  isLoggedIn: boolean;
};

export default function GlobalLogoutButton({
  isLoggedIn,
}: GlobalLogoutButtonProps) {
  const pathname = usePathname();

  if (!isLoggedIn || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "18px",
        right: "24px",
        zIndex: 1000,
      }}
    >
      <LogoutButton />
    </div>
  );
}