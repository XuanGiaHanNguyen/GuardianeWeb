// Catalog of blockable apps for the App Restrictions manager.
//
// On iOS the parent picks apps through Apple's FamilyActivityPicker, which
// returns opaque, device-local tokens — those can't cross to the web. The iOS
// `Child` model, however, also carries `blockedApps: [String]` and
// `screenTimeLimit: Int`, which is the syncable policy the child device reads.
// The web manager writes that same policy, choosing from this curated catalog
// (stable string ids) instead of system tokens.

export const APP_CATEGORIES = [
  {
    id: "social",
    label: "Social",
    apps: [
      { id: "instagram", name: "Instagram" },
      { id: "tiktok", name: "TikTok" },
      { id: "snapchat", name: "Snapchat" },
      { id: "facebook", name: "Facebook" },
      { id: "x", name: "X (Twitter)" },
      { id: "reddit", name: "Reddit" },
      { id: "pinterest", name: "Pinterest" },
    ],
  },
  {
    id: "games",
    label: "Games",
    apps: [
      { id: "roblox", name: "Roblox" },
      { id: "minecraft", name: "Minecraft" },
      { id: "fortnite", name: "Fortnite" },
      { id: "clash-of-clans", name: "Clash of Clans" },
      { id: "among-us", name: "Among Us" },
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    apps: [
      { id: "youtube", name: "YouTube" },
      { id: "netflix", name: "Netflix" },
      { id: "disney-plus", name: "Disney+" },
      { id: "spotify", name: "Spotify" },
      { id: "twitch", name: "Twitch" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    apps: [
      { id: "whatsapp", name: "WhatsApp" },
      { id: "discord", name: "Discord" },
      { id: "messenger", name: "Messenger" },
      { id: "telegram", name: "Telegram" },
    ],
  },
  {
    id: "browsing",
    label: "Web & Shopping",
    apps: [
      { id: "safari", name: "Safari" },
      { id: "chrome", name: "Chrome" },
      { id: "amazon", name: "Amazon" },
    ],
  },
];

// Flat id → name lookup for rendering the "blocked apps" summary.
export const APP_NAMES = Object.fromEntries(
  APP_CATEGORIES.flatMap((c) => c.apps.map((a) => [a.id, a.name])),
);

export function appName(id) {
  return APP_NAMES[id] || id;
}
