"use client";

import { useState } from "react";
import { CalendarBuilder, type CalendarClient } from "./calendar-builder";
import { IdeaRepositoryTab } from "./idea-repository-tab";
import { AwarenessDaysTab } from "./awareness-days-tab";
import type { SocialIdea } from "@/lib/social/types";

type Tab = "calendar" | "ideas" | "awareness";

const TAB_LABELS: Record<Tab, string> = {
  calendar: "Calendar Builder",
  ideas: "Idea Bank",
  awareness: "Awareness Days",
};

export function SocialPlannerStudio({
  initialIdeas,
  clients,
  isAdminUser,
}: {
  initialIdeas: SocialIdea[];
  clients: CalendarClient[];
  isAdminUser: boolean;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("calendar");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Social Content Planner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build monthly calendars from the idea bank plus fresh AI concepts, then send clients their photo list.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "calendar" && <CalendarBuilder clients={clients} bankIdeas={initialIdeas} isAdminUser={isAdminUser} />}
      {activeTab === "ideas" && <IdeaRepositoryTab initialIdeas={initialIdeas} />}
      {activeTab === "awareness" && <AwarenessDaysTab />}
    </div>
  );
}
