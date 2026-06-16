function norm(s: string | null | undefined) {
  return (s ?? "").trim();
}

export function websiteLabel(url: string | null | undefined) {
  const t = norm(url);
  if (!t) return "—";
  try {
    const u = t.includes("://") ? new URL(t) : new URL(`https://${t}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return t.length > 32 ? `${t.slice(0, 29)}…` : t;
  }
}
