"use client";

// Legend mapping mood colors to labels with counts. Port of MoodColorLegendView.swift.

import { moodColor, moodLabel } from "../../../lib/mood";

export function MoodColorLegend({ distribution }) {
  if (!distribution.length) return null;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
      {distribution.map((item) => (
        <div key={item.mood} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: moodColor(item.mood) }}
          />
          <span className="text-[12.5px] text-[var(--foreground)]">
            {moodLabel(item.mood)}
          </span>
          <span className="ml-auto text-[12.5px] text-[var(--muted)]">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}
