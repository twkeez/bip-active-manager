import type { ClientRow } from "@/lib/types/client";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isActive(value: string | null | undefined): boolean {
  const v = normalize(value);
  return v !== "" && v !== "n" && v !== "0" && v !== "no" && v !== "false";
}

function seoTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v.includes("plus") || v.includes("+")) return "seo-premium-plus";
  if (v === "p" || v.includes("premium")) return "seo-premium";
  return "seo-foundation";
}

function ppcTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v.includes("plus") || v.includes("+")) return "ppc-premium-plus";
  return "ppc-premium";
}

function ormTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v === "p" || v.includes("premium")) return "orm-premium";
  return "orm-foundation";
}

function smmTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v.includes("plus") || v.includes("+") || v === "pp") return "social-premium-plus";
  if (v === "p" || v.includes("premium")) return "social-premium";
  return "social-standard";
}

function blogTierKey(value: string | null): string | null {
  if (!isActive(value)) return null;
  const v = normalize(value);
  if (v === "p" || v.includes("premium")) return "blog-premium";
  return "blog-standard";
}

export function getClientTierKeys(client: ClientRow): string[] {
  const keys: (string | null)[] = [
    seoTierKey(client.seo),
    ppcTierKey(client.ppc),
    ormTierKey(client.orm),
    smmTierKey(client.smm),
    blogTierKey(client.blog),
  ];
  return keys.filter((k): k is string => k !== null);
}
