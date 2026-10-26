/**
 * Video call providers for a booking page, and the rules for saving one.
 */
import { Availability } from "./api";

export type Provider = "Google Meet" | "Zoom" | "Custom" | "None";

export const PROVIDERS: { id: Provider; title: string; description: string }[] = [
  { id: "Google Meet", title: "Google Meet", description: "A new Meet link for every booking." },
  { id: "Zoom", title: "Zoom", description: "A new Zoom meeting for every booking." },
  { id: "Custom", title: "My own link", description: "The same Zoom, Teams or Meet room each time." },
  { id: "None", title: "No video link", description: "For phone calls or meeting in person." },
];

/**
 * The saved provider. Frappe fills an unset Select with its first option ("None"), so a booking page that was
 * never set up starts on Google Meet instead. A link alone doesn't mean it was set up: new records fetch the username.
 */
export const savedProviderOf = (availability: Availability): Provider =>
  (availability.enable_scheduling || availability.available_durations.length
    ? availability.meeting_provider || "Google Meet"
    : "Google Meet") as Provider;

/** Zoom stays selectable if it's already saved, so turning Zoom off on the site doesn't silently change it. */
export const providersFor = (zoomReady: boolean, saved: Provider) =>
  PROVIDERS.filter((p) => p.id !== "Zoom" || zoomReady || saved === "Zoom");

export const isMeetingLink = (value: string) => /^https?:\/\/\S+$/.test(value.trim());
export const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());
