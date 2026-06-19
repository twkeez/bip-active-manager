"use client";
import { Search } from "lucide-react";
import type {
  ClientServiceFilterKey,
  ClientStatusFilter,
  OnboardingFilter,
} from "@/lib/clients/client-filters";
import { CLIENT_SERVICE_FILTER_OPTIONS } from "@/lib/clients/client-filters";
const STATUS_OPTIONS: Array<{ value: ClientStatusFilter; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "Awaiting", label: "Awaiting" },
  { value: "Pending", label: "Pending" },
  { value: "Paused", label: "Paused" },
];
const ONBOARDING_OPTIONS: Array<{ value: OnboardingFilter; label: string }> = [
  { value: "", label: "All onboarding" },
  { value: "active", label: "Active" },
  { value: "complete", label: "Complete" },
  { value: "not_started", label: "Not started" },
];
type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: ClientStatusFilter;
  onStatusFilterChange: (value: ClientStatusFilter) => void;
  serviceFilters: ClientServiceFilterKey[];
  onServiceFiltersChange: (value: ClientServiceFilterKey[]) => void;
  onboardingFilter: OnboardingFilter;
  onOnboardingFilterChange: (value: OnboardingFilter) => void;
};
export default function ClientListFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  serviceFilters,
  onServiceFiltersChange,
  onboardingFilter,
  onOnboardingFilterChange,
}: Props) {
  function toggleService(service: ClientServiceFilterKey) {
    onServiceFiltersChange(
      serviceFilters.includes(service)
        ? serviceFilters.filter((item) => item !== service)
        : [...serviceFilters, service],
    );
  }
  return (
    <div className="mb-4 rounded-xl border border-bip-border bg-bip-card p-4 shadow-none">
      
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        
        <div className="flex flex-1 flex-col gap-3 sm:max-w-md">
          
          <label className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
            
            Search clients
          </label>
          <div className="relative">
            
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bip-muted" />
            <input
              type="search"
              placeholder="Search by client name…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full rounded-lg border border-bip-border bg-bip-card py-2.5 pl-10 pr-3 text-sm text-bip-text shadow-none placeholder:text-bip-muted focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          
          <label
            htmlFor="client-status-filter"
            className="text-xs font-semibold uppercase tracking-wide text-bip-muted"
          >
            
            Status
          </label>
          <select
            id="client-status-filter"
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(event.target.value as ClientStatusFilter)
            }
            className="min-w-[160px] rounded-lg border border-bip-border bg-bip-card px-3 py-2.5 text-sm text-bip-text shadow-none focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
          >
            
            {STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          
          <label
            htmlFor="client-onboarding-filter"
            className="text-xs font-semibold uppercase tracking-wide text-bip-muted"
          >
            
            Onboarding
          </label>
          <select
            id="client-onboarding-filter"
            value={onboardingFilter}
            onChange={(event) =>
              onOnboardingFilterChange(event.target.value as OnboardingFilter)
            }
            className="min-w-[160px] rounded-lg border border-bip-border bg-bip-card px-3 py-2.5 text-sm text-bip-text shadow-none focus:border-bip-accent focus:outline-none focus:ring-2 focus:ring-bip-accent/30"
          >
            
            {ONBOARDING_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          
          <span className="text-xs font-semibold uppercase tracking-wide text-bip-muted">
            
            Active services
          </span>
          <div className="flex flex-wrap gap-2">
            
            {CLIENT_SERVICE_FILTER_OPTIONS.map((option) => {
              const active = serviceFilters.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleService(option.key)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${active ? "bg-bip-accent text-bip-page" : "border border-bip-border bg-bip-page text-bip-text hover:bg-bip-fill"}`}
                >
                  
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
