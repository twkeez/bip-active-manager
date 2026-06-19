"use client";
type DetailTabButtonProps = {
  tabId: string;
  label: string;
  activeTab: string;
  onClick: (tab: string) => void;
  hasAlert?: boolean;
  notificationCount?: number;
};
export default function DetailTabButton({
  tabId,
  label,
  activeTab,
  onClick,
  hasAlert = false,
  notificationCount,
}: DetailTabButtonProps) {
  const showDot =
    hasAlert || (notificationCount != null && notificationCount > 0);
  const badgeCount =
    notificationCount != null && notificationCount > 0
      ? notificationCount > 99
        ? "99+"
        : String(notificationCount)
      : null;
  return (
    <button
      type="button"
      onClick={() => onClick(tabId)}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${activeTab === tabId ? "bg-bip-accent text-bip-page" : "text-bip-text hover:bg-bip-fill"}`}
    >
      
      <span>{label}</span>
      {showDot && (
        <span className="relative inline-flex shrink-0 items-center justify-center">
          
          {badgeCount ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              
              {badgeCount}
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
          )}
        </span>
      )}
    </button>
  );
}
