import Link from "next/link";

/** Projects | Follow-ups, at the top of the Response Report. Follow-ups are admins' notes to strategists. */
export default function ResponseReportTabs({ active, openFollowups }: { active: "projects" | "followups"; openFollowups: number }) {
  const tab = (key: "projects" | "followups", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active === key ? "bg-bip-card text-bip-text shadow-sm" : "text-bip-muted hover:text-bip-text"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="inline-flex gap-1 rounded-lg border border-bip-border bg-bip-fill p-1">
      {tab("projects", "/response-report", "Projects")}
      {tab("followups", "/response-report?tab=followups", openFollowups ? `Follow-ups (${openFollowups} open)` : "Follow-ups")}
    </nav>
  );
}
