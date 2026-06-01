// Shared mood color / emoji / score / label helpers and analytics.
// Ported 1:1 from the iOS app so web and iOS render identical mood data:
//   • MoodHelpers.swift   → colors, emoji, score (1–6 scale), labels
//   • MoodViewModel.swift → distribution, averageScore, dailyAverages, trend
//
// The child app writes moodEntries documents with a `mood` string field
// (one of MOODS below) and a Firestore `timestamp`.

// Canonical mood keys, in the order iOS lists them (best → worst).
export const MOODS = ["happy", "calm", "neutral", "sad", "anxious", "angry"];

const COLOR = {
  happy: "#2ECC71",
  calm: "#3399DB",
  neutral: "#95A5A6",
  sad: "#8E8EF0",
  anxious: "#F39C12",
  angry: "#E74C3C",
};

const EMOJI = {
  happy: "😊",
  calm: "😌",
  neutral: "😐",
  sad: "😢",
  anxious: "😰",
  angry: "😠",
};

const SCORE = {
  happy: 6,
  calm: 5,
  neutral: 4,
  sad: 3,
  anxious: 2,
  angry: 1,
};

function normalize(mood) {
  return String(mood || "").toLowerCase();
}

export function moodColor(mood) {
  return COLOR[normalize(mood)] ?? "#95A5A6";
}

export function moodEmoji(mood) {
  return EMOJI[normalize(mood)] ?? "🙂";
}

/** Score on the iOS 1–6 scale. Unknown moods score 4 (neutral), matching iOS. */
export function moodScore(mood) {
  return SCORE[normalize(mood)] ?? 4;
}

export function moodLabel(mood) {
  const m = normalize(mood);
  if (!m) return "—";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** The mood key for a moodEntries doc (handles `mood` or legacy `label`). */
export function entryMood(entry) {
  return normalize(entry?.mood || entry?.label);
}

function entryMillis(entry) {
  const ms = entry?.timestamp?.toMillis?.();
  if (typeof ms === "number") return ms;
  if (entry?.timestamp instanceof Date) return entry.timestamp.getTime();
  return null;
}

// ─── Analytics (mirror MoodViewModel computed properties) ────────────────────

/** Mean score across all entries, 0 when empty. */
export function averageScore(entries) {
  if (!entries.length) return 0;
  const total = entries.reduce((sum, e) => sum + moodScore(entryMood(e)), 0);
  return total / entries.length;
}

/** [{ mood, count }] sorted by count descending. */
export function distribution(entries) {
  const counts = new Map();
  for (const e of entries) {
    const m = entryMood(e);
    if (!m) continue;
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  return Array.from(counts, ([mood, count]) => ({ mood, count })).sort(
    (a, b) => b.count - a.count,
  );
}

export function mostFrequentMood(entries) {
  return distribution(entries)[0]?.mood ?? null;
}

/** [{ date, score }] — average score per calendar day, ascending by date. */
export function dailyAverages(entries) {
  const byDay = new Map();
  for (const e of entries) {
    const ms = entryMillis(e);
    if (ms == null) continue;
    const day = new Date(ms);
    day.setHours(0, 0, 0, 0);
    const key = day.getTime();
    if (!byDay.has(key)) byDay.set(key, { total: 0, count: 0 });
    const slot = byDay.get(key);
    slot.total += moodScore(entryMood(e));
    slot.count += 1;
  }
  return Array.from(byDay, ([key, { total, count }]) => ({
    date: new Date(key),
    score: total / count,
  })).sort((a, b) => a.date - b.date);
}

/** "Improving" | "Declining" | "Stable" — compares first vs second half of days. */
export function trend(entries) {
  const averages = dailyAverages(entries);
  if (averages.length < 2) return "Stable";
  const mid = Math.floor(averages.length / 2);
  const first = averages.slice(0, mid);
  const second = averages.slice(mid);
  const avg = (arr) => arr.reduce((s, x) => s + x.score, 0) / arr.length;
  const f = avg(first);
  const s = avg(second);
  if (s - f > 0.5) return "Improving";
  if (f - s > 0.5) return "Declining";
  return "Stable";
}

/** Color for an averaged daily score (MoodWeekTimelineView.scoreColor). */
export function scoreColor(score) {
  if (score >= 5) return "#2ECC71";
  if (score >= 4) return "#3399DB";
  if (score >= 3) return "#95A5A6";
  if (score >= 2) return "#F39C12";
  return "#E74C3C";
}
