"use client";

import { useState } from "react";
import { CalendarBuilder, type CalendarClient } from "./calendar-builder";
import { IdeaRepositoryTab } from "./idea-repository-tab";
import { SeriesTab } from "./series-tab";
import type { SocialAwarenessDay, SocialIdea, SocialSeriesWithParts } from "@/lib/social/types";

type Tab = "builder" | "ideas" | "series";

const TAB_LABELS: Record<Tab, string> = {
  builder: "Builder",
  ideas: "Idea Bank",
  series: "Series",
};

export function SocialPlannerStudio({
  initialIdeas,
  clients,
  awarenessDays,
  series,
  isAdminUser,
  initialClientId,
}: {
  initialIdeas: SocialIdea[];
  clients: CalendarClient[];
  awarenessDays: SocialAwarenessDay[];
  series: SocialSeriesWithParts[];
  isAdminUser: boolean;
  initialClientId?: number;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("builder");

  return (
    <div className="flex min-h-full flex-col bg-slate-50/50">
      <div className="px-6 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Social Content Planner</h1>
        <p className="mt-1 text-sm text-slate-500">
          Build a month from your idea bank, awareness days, and series — then send clients their photo list.
        </p>

        <div className="mt-5 flex gap-1 border-b border-slate-200/80">
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "builder" && (
        <CalendarBuilder
          clients={clients}
          bankIdeas={initialIdeas}
          awarenessDays={awarenessDays}
          series={series}
          isAdminUser={isAdminUser}
          initialClientId={initialClientId}
        />
      )}
      {activeTab === "ideas" && (
        <div className="p-6">
          <IdeaRepositoryTab initialIdeas={initialIdeas} />
        </div>
      )}
      {activeTab === "series" && (
        <div className="p-6">
          <SeriesTab series={series} clients={clients} />
        </div>
      )}
    </div>
  );
}
