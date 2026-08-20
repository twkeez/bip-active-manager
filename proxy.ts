import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getAppMode, isAllowedInTeamMode } from "@/lib/auth/app-mode";

// Renamed from middleware.ts: Next 16 deprecated the `middleware` file
// convention in favour of `proxy`. Same behaviour, new name.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // On the team deployment, anything outside the Clients section and its tools
  // is blocked here rather than hidden in the nav — see lib/auth/app-mode.ts.
  if (getAppMode() === "team" && !isAllowedInTeamMode(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.redirect(new URL("/dashboard/clients", request.url));
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
