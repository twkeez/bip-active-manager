import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardCheck,
  Compass,
  FileText,
  Flame,
  Globe,
  ListTodo,
  MapPinned,
  Megaphone,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from "lucide-react";

export type AppModule = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
  iconClass: string;
  featured?: boolean;
};

export type ModuleGroup = {
  id: string;
  label: string;
  borderClass: string;
  labelClass: string;
  moduleIds: string[];
};

export const APP_MODULES: AppModule[] = [
  {
    id: "clients",
    label: "Clients",
    description: "Account list, workspaces, reporting, and channel diagnostics.",
    href: "/dashboard/clients",
    icon: Building2,
    accent: "border-indigo-500/30 hover:border-indigo-400/50",
    iconClass: "text-indigo-400",
    featured: true,
  },
  {
    id: "vet-onboarding",
    label: "Vet Onboarding Plan",
    description: "AI-generated 30/60/90 marketing onboarding plans for new veterinary clients.",
    href: "/vet-onboarding",
    icon: Stethoscope,
    accent: "border-teal-500/30 hover:border-teal-400/50",
    iconClass: "text-teal-400",
  },
  {
    id: "strategy-mapper",
    label: "Onboarding Research and Strategy Mapper",
    description:
      "Local competitive audit, service-specific strategy, and soft-upsell opportunities for sales proposals.",
    href: "/onboarding-strategy-mapper",
    icon: Compass,
    accent: "border-cyan-500/30 hover:border-cyan-400/50",
    iconClass: "text-cyan-400",
  },
  {
    id: "sales-lab",
    label: "Sales Lab",
    description: "Prospect audits, AI site analysis, and pitch prep.",
    href: "/sales-lab",
    icon: Sparkles,
    accent: "border-violet-500/30 hover:border-violet-400/50",
    iconClass: "text-violet-400",
  },
  {
    id: "global-ads",
    label: "Global Ads Center",
    description: "Cross-account Google Ads optimization radar and batch repair queue.",
    href: "/global-ads-optimization",
    icon: Megaphone,
    accent: "border-orange-500/30 hover:border-orange-400/50",
    iconClass: "text-orange-400",
  },
  {
    id: "ppc-defense",
    label: "PPC Defense",
    description: "Landing page quality deficits and runaway budget hog detection.",
    href: "/ppc-defense",
    icon: Flame,
    accent: "border-amber-500/30 hover:border-amber-400/50",
    iconClass: "text-amber-400",
  },
  {
    id: "conversion-integrity",
    label: "Conversion Radar",
    description: "Cross-account conversion tracking integrity and pixel anomaly detection.",
    href: "/conversion-integrity",
    icon: ShieldAlert,
    accent: "border-rose-500/30 hover:border-rose-400/50",
    iconClass: "text-rose-400",
  },
  {
    id: "seo-ops",
    label: "SEO Ops",
    description: "Weekly and monthly SEO strategist checklist across SEO clients.",
    href: "/seo-ops",
    icon: ClipboardCheck,
    accent: "border-emerald-500/30 hover:border-emerald-400/50",
    iconClass: "text-emerald-400",
  },
  {
    id: "site-audit",
    label: "Site Audit",
    description: "Lighthouse and crawl-driven technical SEO inspector.",
    href: "/site-audit",
    icon: Globe,
    accent: "border-emerald-500/30 hover:border-emerald-400/50",
    iconClass: "text-emerald-400",
  },
  {
    id: "local-rank",
    label: "Local Grid Rank",
    description: "Track local pack rankings on a zip-level 5×5 grid for primary keywords.",
    href: "/local-rank",
    icon: MapPinned,
    accent: "border-teal-500/30 hover:border-teal-400/50",
    iconClass: "text-teal-400",
  },
  {
    id: "llms-txt",
    label: "llms.txt Generator",
    description: "AI-curated llms.txt and llms-full.txt exports for client websites.",
    href: "/llms-txt",
    icon: FileText,
    accent: "border-lime-500/30 hover:border-lime-400/50",
    iconClass: "text-lime-400",
  },
  {
    id: "my-tasks",
    label: "My Tasks",
    description: "Personal task queue, categories, and client assignments.",
    href: "/my-tasks",
    icon: ListTodo,
    accent: "border-sky-500/30 hover:border-sky-400/50",
    iconClass: "text-sky-400",
  },
];

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    id: "client-work",
    label: "Client Work",
    borderClass: "border-l-blue-500/50",
    labelClass: "text-blue-400/70",
    moduleIds: ["clients", "vet-onboarding", "strategy-mapper", "sales-lab"],
  },
  {
    id: "ads-performance",
    label: "Ads & Performance",
    borderClass: "border-l-orange-500/50",
    labelClass: "text-orange-400/70",
    moduleIds: ["global-ads", "ppc-defense", "conversion-integrity"],
  },
  {
    id: "seo-discovery",
    label: "SEO & Discovery",
    borderClass: "border-l-emerald-500/50",
    labelClass: "text-emerald-400/70",
    moduleIds: ["seo-ops", "site-audit", "local-rank", "llms-txt"],
  },
];

const MODULE_BY_ID = new Map(APP_MODULES.map((module) => [module.id, module]));

export function getModuleById(id: string) {
  return MODULE_BY_ID.get(id);
}

export const HEADER_MODULE_LINKS = APP_MODULES.filter(
  (module) => module.id !== "clients" && module.id !== "my-tasks",
);
