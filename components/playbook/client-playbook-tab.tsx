"use client";

import { CheckCircle, XCircle, MinusCircle, BookOpen, ExternalLink } from "lucide-react";
import type { PlaybookItem, ServiceTier } from "@/lib/playbook/types";
import type { VerifyResult } from "@/lib/playbook/types";

const TYPE_COLORS = {
  checklist: "text-[var(--bip-accent)]",
  deliverable: "text-blue-400",
  guideline: "text-violet-400",
};

const TYPE_LABELS = {
  checklist: "Setup / Action",
  deliverable: "Deliverable",
  guideline: "Guideline",
};

function VerifyBadge({ result }: { result: VerifyResult }) {
  if (result.pass) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
        <CheckCircle size={11} />
        {result.label}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-red-400">
      <XCircle size={11} />
      {result.label}
    </span>
  );
}

function CategorySection({
  category,
  items,
  verifications,
}: {
  category: string;
  items: PlaybookItem[];
  verifications: Record<string, VerifyResult>;
}) {
  return (
    <div>
      <p className="bip-section-label px-4 pt-4 pb-2">{category}</p>
      <div className="divide-y divide-[var(--bip-border)]">
        {items.map((item) => {
          const verify = item.auto_verify_key
            ? verifications[item.auto_verify_key]
            : null;
          const Icon =
            item.type === "checklist"
              ? CheckCircle
              : item.type === "deliverable"
                ? BookOpen
                : MinusCircle;

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bip-hover)] transition-colors"
            >
              <Icon
                size={14}
                className={`mt-0.5 shrink-0 ${TYPE_COLORS[item.type]}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-bip-text">{item.title}</p>
                  <span className="text-[10px] text-[rgba(255,255,255,0.25)] uppercase tracking-wider">
                    {TYPE_LABELS[item.type]}
                  </span>
                </div>
                {item.body && (
                  <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.45)] leading-relaxed">
                    {item.body}
                  </p>
                )}
                {verify && (
                  <div className="mt-1.5">
                    <VerifyBadge result={verify} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TierSection({
  tier,
  items,
  verifications,
}: {
  tier: ServiceTier;
  items: PlaybookItem[];
  verifications: Record<string, VerifyResult>;
}) {
  const grouped: Record<string, PlaybookItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  const autoVerifyItems = items.filter((i) => i.auto_verify_key);
  const passCount = autoVerifyItems.filter(
    (i) => i.auto_verify_key && verifications[i.auto_verify_key]?.pass,
  ).length;
  const totalVerifiable = autoVerifyItems.length;

  return (
    <div className="bip-card overflow-hidden">
      {/* Tier header */}
      <div className="flex items-center justify-between border-b border-[var(--bip-border)] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-bip-text">{tier.tier_label}</p>
          <p className="text-xs text-[rgba(255,255,255,0.4)] line-clamp-1 mt-0.5">
            {tier.objective}
          </p>
        </div>
        {totalVerifiable > 0 && (
          <div className="shrink-0 ml-4 text-right">
            <p
              className={`text-xs font-medium ${
                passCount === totalVerifiable
                  ? "text-emerald-400"
                  : passCount === 0
                    ? "text-red-400"
                    : "text-amber-400"
              }`}
            >
              {passCount}/{totalVerifiable} verified
            </p>
            <p className="text-[10px] text-[rgba(255,255,255,0.3)]">auto-checks</p>
          </div>
        )}
      </div>

      {/* Categories */}
      {Object.entries(grouped).map(([cat, catItems]) => (
        <CategorySection
          key={cat}
          category={cat}
          items={catItems}
          verifications={verifications}
        />
      ))}
    </div>
  );
}

type Props = {
  tiers: ServiceTier[];
  itemsByTier: Record<string, PlaybookItem[]>;
  verifications: Record<string, VerifyResult>;
  clientName: string;
};

export default function ClientPlaybookTab({
  tiers,
  itemsByTier,
  verifications,
  clientName,
}: Props) {
  const activeTiers = tiers.filter((t) => itemsByTier[t.tier_key]?.length > 0);

  if (activeTiers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen size={32} className="mb-3 text-[rgba(255,255,255,0.2)]" />
        <p className="text-sm text-[rgba(255,255,255,0.4)]">
          No active service tiers detected for {clientName}.
        </p>
        <p className="mt-1 text-xs text-[rgba(255,255,255,0.25)]">
          Update the client profile with their active services to see playbook items.
        </p>
        <a
          href="/playbook"
          className="mt-4 flex items-center gap-1 text-xs text-[var(--bip-accent)] hover:underline"
        >
          <ExternalLink size={11} />
          View full playbook library
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[rgba(255,255,255,0.4)]">
          Showing playbook for {activeTiers.length} active service{activeTiers.length !== 1 ? "s" : ""}.
          Auto-checks verify integration status in real time.
        </p>
        <a
          href="/playbook"
          className="flex items-center gap-1 text-xs text-[rgba(255,255,255,0.35)] hover:text-[var(--bip-accent)] transition-colors"
        >
          <ExternalLink size={11} />
          Edit playbook
        </a>
      </div>

      {activeTiers.map((tier) => (
        <TierSection
          key={tier.tier_key}
          tier={tier}
          items={itemsByTier[tier.tier_key] ?? []}
          verifications={verifications}
        />
      ))}
    </div>
  );
}
