"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function TeacherInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenHash = searchParams.get("token_hash");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function acceptInvitation() {
    if (!tokenHash) {
      setError("The invitation link is invalid.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/auth/teacher-invite/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token_hash: tokenHash,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to accept invitation."
        );
      }

      router.replace("/account/teacher-setup");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome to TALKLY
        </h1>

        <p className="mt-4 text-gray-600">
          You have been invited to join TALKLY as a teacher.
        </p>

        <p className="mt-2 text-sm text-gray-500">
          Accept your invitation to set up your teacher account.
        </p>

        {error && (
          <p className="mt-5 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={acceptInvitation}
          disabled={loading || !tokenHash}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Processing..." : "Accept Invitation"}
        </button>

        {!tokenHash && (
          <p className="mt-4 text-sm text-red-600">
            Missing invitation token. Please use the link in your invitation email.
          </p>
        )}
      </div>
    </main>
  );
}

export default function TeacherInvitePage() {
  return (
    <Suspense fallback={<div>Loading invitation...</div>}>
      <TeacherInviteContent />
    </Suspense>
  );
}