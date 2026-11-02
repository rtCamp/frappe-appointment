/**
 * The /schedule app's addresses (after /schedule), so every screen can be refreshed, bookmarked and shared, and
 * Back works. Dialogs have their own address too, shown over the page they open from.
 */
import type { SettingsTab } from "./settings";

/** The setup steps in order, as they appear in /schedule/setup/<step>. */
export const SETUP_PATHS = ["calendar", "hours", "booking-page", "done"];

export type AppRoute =
  | { screen: "home" }
  /** edit: the meeting type open in the editor, by its id, or "new". */
  | { screen: "types"; edit?: string }
  | { screen: "availability" }
  | { screen: "groups"; isNew: boolean }
  | { screen: "group"; name: string; edit: boolean }
  | { screen: "settings"; tab: SettingsTab }
  /** step: 0-2 for the steps, 3 for the done screen; -1 for /setup with no step, which goes to the right one. */
  | { screen: "setup"; step: number }
  /** step: 0-based Google Cloud step. */
  | { screen: "guide"; step: number }
  | { screen: "credentials" };

const TABS: SettingsTab[] = ["booking", "calendar", "video", "google", "zoom", "emails"];

/** The screen for an address, or null when the app has none. */
export const parsePath = (pathname: string): AppRoute | null => {
  let parts: string[];
  try {
    parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    // A stray % that isn't an escape.
    return null;
  }
  const [first, second, third, ...rest] = parts;
  if (rest.length) return null;
  if (!first) return { screen: "home" };
  if (first === "meeting-types") return third ? null : { screen: "types", edit: second };
  if (first === "availability") return second ? null : { screen: "availability" };
  if (first === "groups") {
    if (!second) return { screen: "groups", isNew: false };
    if (second === "new") return third ? null : { screen: "groups", isNew: true };
    if (third && third !== "edit") return null;
    return { screen: "group", name: second, edit: third === "edit" };
  }
  if (first === "settings") {
    const tab = (second ?? "booking") as SettingsTab;
    return TABS.includes(tab) && !third ? { screen: "settings", tab } : null;
  }
  if (first === "setup") {
    if (third) return null;
    if (!second) return { screen: "setup", step: -1 };
    const step = SETUP_PATHS.indexOf(second);
    return step === -1 ? null : { screen: "setup", step };
  }
  if (first === "admin") {
    if (second === "credentials" && !third) return { screen: "credentials" };
    if (second === "guide") {
      if (!third) return { screen: "guide", step: 0 };
      // Steps are numbered from 1; anything else isn't a step.
      return /^[1-9]\d*$/.test(third) ? { screen: "guide", step: Number(third) - 1 } : null;
    }
  }
  return null;
};

export const paths = {
  home: "/",
  types: (edit?: string) => (edit ? `/meeting-types/${encodeURIComponent(edit)}` : "/meeting-types"),
  availability: "/availability",
  groups: "/groups",
  newGroup: "/groups/new",
  group: (name: string, edit = false) => `/groups/${encodeURIComponent(name)}${edit ? "/edit" : ""}`,
  settings: (tab: SettingsTab) => `/settings/${tab}`,
  setup: (step: number) => `/setup/${SETUP_PATHS[step]}`,
  guide: (step: number) => `/admin/guide/${step + 1}`,
  credentials: "/admin/credentials",
};

/** Where a dialog was opened from, kept in the history entry so closing it can go Back instead of adding a step. */
export interface OpenedFrom {
  back?: string;
}
