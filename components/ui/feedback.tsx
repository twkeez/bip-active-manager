import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Shared async-state primitives so every tool page stops hand-rolling its own
// spinner / empty / error markup. Match the app's existing bip-* theme.

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-bip-muted">
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-bip-border p-8 text-center">
      {Icon && <Icon className="mx-auto mb-3 h-8 w-8 text-bip-muted" aria-hidden="true" />}
      <p className="text-sm text-bip-text">{title}</p>
      {hint && <p className="mt-1 text-xs text-bip-muted">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{message}</p>
  );
}
