"use client";

// Daily-average timeline as a row of colored bars. Port of
// MoodWeekTimelineView.swift (score label on top, bar, weekday beneath).

import { scoreColor } from "../../../lib/mood";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_SCORE = 6;

export function MoodWeekTimeline({ dailyAverages }) {
  if (!dailyAverages.length) return null;

  return (
    <div className="flex h-40 items-end gap-2 overflow-x-auto">
      {dailyAverages.map((item) => {
        const heightPct = Math.max(6, (item.score / MAX_SCORE) * 100);
        return (
          <div
            key={item.date.getTime()}
            className="flex min-w-[28px] flex-1 flex-col items-center gap-1.5"
          >
            <span className="text-[9px] text-[var(--muted)]">
              {item.score.toFixed(1)}
            </span>
            <div className="flex h-28 w-full items-end justify-center">
              <div
                className="w-6 rounded-md"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: scoreColor(item.score),
                }}
              />
            </div>
            <span className="text-[9px] text-[var(--muted)]">
              {WEEKDAY[item.date.getDay()]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
