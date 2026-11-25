import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/middleware";
import { getAppMode, isAllowedInTeamMode } from "@/lib/auth/app-mode";
import { decideRoleGate, nonAdminMayReach } from "@/lib/auth/role-gate";
import { readAccess } from "@/lib/auth/access";
import { isClientPortal, isPortalPath } from "@/lib/client-snapshot/portal-mode";

// Renamed from middleware.ts: Next 16 deprecated the `middleware` file
// convention in favour of `proxy`. Same behaviour, new name.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The client portal (APP_MODE=client) serves only snapshot links, with no
  // sign-in; and those links exist nowhere else. See lib/client-snapshot/portal-mode.ts.
  if (isClientPortal()) {
    if (isPortalPath(pathname)) return NextResponse.next();
    return new NextResponse("Not found", { status: 404 });
  }
  if (pathname === "/s" || pathname.startsWith("/s/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  // On the team deployment, anything outside the Clients section and its tools
  // is blocked here rather than hidden in the nav — see lib/auth/app-mode.ts.
  if (getAppMode() === "team" && !isAllowedInTeamMode(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.redirect(new URL("/dashboard/clients", request.url));
  }

  const { response, supabase, user } = await refreshSession(request);

  // Role gate (lib/auth/role-gate.ts): a signed-in non-admin reaches what the
  // team deployment serves plus the sections granted to them. Paths every role
  // may reach skip the lookup, so the extra read only happens elsewhere.
  if (user && !nonAdminMayReach(pathname)) {
    const read = await readAccess(supabase, user.id);
    // Access that can't be read is never waved through (see role-gate.ts).
    const blockedForRole =
      read.ok && decideRoleGate(pathname, read.access.role, read.access.grants) === "block";
    if (!read.ok || blockedForRole) {
      const isApi = pathname.startsWith("/api/");
      // A failed read is reported as such, never as a quiet redirect.
      const blocked = !read.ok
        ? isApi
          ? NextResponse.json({ error: "Could not check your access. Try again." }, { status: 503 })
          : new NextResponse("Could not check your access. Reload to try again.", { status: 503 })
        : isApi
          ? NextResponse.json({ error: "You don't have access to this." }, { status: 403 })
          : NextResponse.redirect(new URL("/dashboard/clients", request.url));
      // Keep any auth cookies the session refresh just set.
      for (const cookie of response.cookies.getAll()) blocked.cookies.set(cookie);
      return blocked;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
