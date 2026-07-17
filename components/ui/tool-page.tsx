import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Standard tool-page shell: centered column, a title (optional icon), and a
// one-line description. Replaces the copy-pasted header + wrapper in every tool.

const MAX_WIDTH: Record<string, string> = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
};

export function ToolPage({
  title,
  icon: Icon,
  description,
  maxWidth = "5xl",
  actions,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  description?: ReactNode;
  maxWidth?: "3xl" | "4xl" | "5xl" | "6xl";
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full ${MAX_WIDTH[maxWidth]} space-y-6 p-6`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-bip-text">
            {Icon && <Icon className="h-5 w-5 text-bip-accent" aria-hidden="true" />}
            {title}
          </h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-bip-muted">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
