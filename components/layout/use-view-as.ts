"use client";

import { useRouter } from "next/navigation";
import { VIEW_AS_COOKIE } from "@/lib/auth/effective-role";

/**
 * Returns a toggle that flips an admin between their own view and the
 * strategist view. Both sidebars render their own button for this — they are
 * styled too differently to share one — but the cookie handling lives here so
 * the two can't drift apart.
 */
export function useViewAs(previewing: boolean) {
  const router = useRouter();

  return function toggleViewAs() {
    if (previewing) {
      document.cookie = `${VIEW_AS_COOKIE}=; path=/; max-age=0`;
    } else {
      document.cookie = `${VIEW_AS_COOKIE}=strategist; path=/; max-age=86400`;
    }
    router.refresh();
  };
}
