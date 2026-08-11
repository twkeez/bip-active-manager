"use client";

import { useState } from "react";
import { AWARENESS_DAYS } from "@/lib/social/awareness-days";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function AwarenessDaysTab() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const days = AWARENESS_DAYS.filter((d) => d.month === selectedMonth);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {MONTH_NAMES.slice(1).map((name, i) => {
          const month = i + 1;
          const count = AWARENESS_DAYS.filter((d) => d.month === month).length;
          return (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                selectedMonth === month
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {name} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {days.map((day) => (
          <div key={day.name} className="border rounded-lg p-4 space-y-1">
            <div className="flex items-start justify-between gap-4">
              <span className="font-medium text-sm">{day.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {day.day ? `${MONTH_NAMES[day.month]} ${day.day}` : "Whole month"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{day.description}</p>
            <p className="text-xs mt-1"><span className="font-medium">Content angle:</span> {day.contentAngle}</p>
          </div>
        ))}
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">No major awareness days catalogued for this month.</p>
        )}
      </div>
    </div>
  );
}
