"use client";

// Horizontal bars showing the count of each mood type. Port of
// MoodDistributionBarView.swift.

import { moodColor, moodEmoji, moodLabel } from "../../../lib/mood";

export function MoodDistributionBars({ distribution }) {
  if (!distribution.length) return null;
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-2.5">
      {distribution.map((item) => (
        <div key={item.mood} className="flex items-center gap-3">
          <span className="w-7 text-center text-[18px]" aria-hidden>
            {moodEmoji(item.mood)}
          </span>
          <span className="w-16 flex-shrink-0 text-[12.5px] text-[var(--foreground)]">
            {moodLabel(item.mood)}
          </span>
          <div className="relative h-4 flex-1 overflow-hidden rounded-md bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-md"
              style={{
                width: `${(item.count / maxCount) * 100}%`,
                backgroundColor: moodColor(item.mood),
              }}
            />
          </div>
          <span className="w-6 flex-shrink-0 text-right text-[12.5px] text-[var(--muted)]">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}
