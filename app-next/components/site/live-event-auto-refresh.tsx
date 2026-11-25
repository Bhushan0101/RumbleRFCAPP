"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * While the event is Live, re-request the page every 10 seconds so admin-saved
 * results show up without requiring the user to refresh. Lightweight — relies
 * on Next's revalidatePath invalidation already triggered by `recordBoutResult`.
 */
export function LiveEventAutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
