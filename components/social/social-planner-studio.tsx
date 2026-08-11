"use client";

import { useState } from "react";
import { IdeaRepositoryTab } from "./idea-repository-tab";
import { AwarenessDaysTab } from "./awareness-days-tab";
import type { SocialIdea } from "@/lib/social/types";

type Tab = "ideas" | "awareness";

export function SocialPlannerStudio({ initialIdeas }: { initialIdeas: SocialIdea[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("ideas");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Social Content Planner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the Beyond Indigo idea bank and reference awareness days. Generate per-client plans from the cockpit.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {(["ideas", "awareness"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "ideas" ? "Idea Bank" : "Awareness Days"}
          </button>
        ))}
      </div>

      {activeTab === "ideas" && <IdeaRepositoryTab initialIdeas={initialIdeas} />}
      {activeTab === "awareness" && <AwarenessDaysTab />}
    </div>
  );
}
