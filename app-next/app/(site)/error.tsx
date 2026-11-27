"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Container } from "@/components/ui/container";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[site error.tsx]", error);
  }, [error]);

  return (
    <Container className="py-16">
      <div className="border border-gold/60 bg-black/30 p-6 md:p-8 max-w-3xl mx-auto">
        <p className="font-display text-xs tracking-[0.4em] text-gold uppercase">
          Something went wrong
        </p>
        <h1 className="font-display font-black text-3xl md:text-4xl text-white tracking-wider mt-2">
          We couldn't render this page.
        </h1>
        <p className="text-muted mt-3">
          The action likely completed on the server — refresh to check. Please
          screenshot the detail below if you want to report this.
        </p>
        <pre className="mt-4 whitespace-pre-wrap break-words text-xs text-muted bg-bg border border-white/10 p-3 overflow-auto max-h-96">
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
            href="/"
            className="inline-block border border-gold text-gold px-5 py-2.5 font-display font-bold text-xs tracking-wider hover:bg-gold hover:text-bg"
          >
            Go home
          </Link>
        </div>
      </div>
    </Container>
  );
}
