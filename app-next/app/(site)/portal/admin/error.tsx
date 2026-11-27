"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Container } from "@/components/ui/container";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin error.tsx]", error);
  }, [error]);

  return (
    <Container className="py-10">
      <div className="border border-red-500/60 bg-red-950/30 p-6">
        <p className="font-display text-xs tracking-[0.4em] text-red-300 uppercase">
          Admin action failed
        </p>
        <h1 className="font-display font-black text-2xl md:text-3xl text-white tracking-wider mt-2">
          The last action threw an error.
        </h1>
        <p className="text-muted mt-3">
          The write may or may not have been applied. Reload the admin page
          below to see the current state. Screenshot the detail and share it if
          the problem repeats.
        </p>
        <pre className="mt-4 whitespace-pre-wrap break-words text-xs text-muted bg-bg border border-white/10 p-3 overflow-auto max-h-[28rem]">
          {error.message || String(error)}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-block bg-gold text-bg px-5 py-2.5 font-display font-bold text-xs tracking-wider hover:bg-gold-hi"
          >
            Try again
          </button>
          <Link
            href="/portal/admin/fighters"
            className="inline-block border border-gold text-gold px-5 py-2.5 font-display font-bold text-xs tracking-wider hover:bg-gold hover:text-bg"
          >
            Admin fighters
          </Link>
          <Link
            href="/portal/admin/gyms"
            className="inline-block border border-gold text-gold px-5 py-2.5 font-display font-bold text-xs tracking-wider hover:bg-gold hover:text-bg"
          >
            Admin clubs
          </Link>
          <Link
            href="/portal/admin/verifications"
            className="inline-block border border-gold text-gold px-5 py-2.5 font-display font-bold text-xs tracking-wider hover:bg-gold hover:text-bg"
          >
            Verifications
          </Link>
        </div>
      </div>
    </Container>
  );
}
