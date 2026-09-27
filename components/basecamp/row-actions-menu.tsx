"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export type RowAction = {
  label: string;
  onSelect?: () => void;
  /** Opens in a new tab instead of running onSelect. */
  href?: string;
  disabled?: boolean;
  /** Why it is disabled, shown as the tooltip and read to screen readers. */
  disabledReason?: string;
  tone?: "danger";
};

/**
 * The "⋯" menu on a report row. Keyboard: Enter/Space/ArrowDown opens it,
 * arrows move, Home/End jump, Escape or Tab closes and returns focus.
 *
 * Positioned fixed from the button so the table's own scroll area (which
 * keeps the header sticky) cannot clip it.
 */
export default function RowActionsMenu({ actions, label = "More actions" }: { actions: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const menuId = useId();

  function openMenu(focusIndex = 0) {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedHeight = actions.length * 34 + 8;
    const below = rect.bottom + 4;
    const top = below + estimatedHeight > window.innerHeight ? Math.max(8, rect.top - estimatedHeight - 4) : below;
    setPosition({ top, right: window.innerWidth - rect.right });
    setOpen(true);
    requestAnimationFrame(() => itemRefs.current[focusIndex]?.focus());
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (itemRefs.current.some((item) => item?.contains(target))) return;
      setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const index = itemRefs.current.findIndex((item) => item === document.activeElement);
    const last = actions.length - 1;
    const focus = (i: number) => itemRefs.current[i]?.focus();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focus(index >= last ? 0 : index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focus(index <= 0 ? last : index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focus(last);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      close(false);
    }
  }

  function run(action: RowAction) {
    if (action.disabled) return;
    close(!action.href);
    action.onSelect?.();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(event.key === "ArrowUp" ? actions.length - 1 : 0);
          }
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-bip-border text-bip-muted hover:text-bip-text focus:outline-none focus-visible:ring-2 focus-visible:ring-bip-accent"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && position && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          style={{ position: "fixed", top: position.top, right: position.right }}
          className="z-50 min-w-[12rem] rounded-lg border border-bip-border bg-bip-card py-1 text-left shadow-xl"
        >
          {actions.map((action, index) => {
            const className = `block w-full px-3 py-1.5 text-left text-sm focus:bg-bip-fill focus:outline-none ${
              action.disabled
                ? "cursor-not-allowed text-bip-muted/60"
                : action.tone === "danger"
                  ? "text-red-300 hover:bg-bip-fill"
                  : "text-bip-text hover:bg-bip-fill"
            }`;
            if (action.href && !action.disabled) {
              return (
                <a
                  key={action.label}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  role="menuitem"
                  tabIndex={-1}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => close(false)}
                  className={className}
                >
                  {action.label}
                </a>
              );
            }
            return (
              <button
                key={action.label}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={action.disabled || undefined}
                title={action.disabled ? action.disabledReason : undefined}
                onClick={() => run(action)}
                className={className}
              >
                {action.label}
                {action.disabled && action.disabledReason && <span className="sr-only"> ({action.disabledReason})</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
