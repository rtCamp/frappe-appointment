/**
 * The tips in the Help panel, opened from the sidebar. A tip about one of the app's sections is listed first while
 * that section is open.
 */
import type { MotionModule } from "@/components/motion-player/kit";
import type { SettingsTab } from "./settings";

/** Where a tip's link goes: a tab of Settings, or one of the sidebar's sections. */
export type HelpDestination = { settings: SettingsTab } | { section: string };

export interface HelpLink {
  label: string;
  to: HelpDestination;
}

export interface HelpTip {
  id: string;
  title: string;
  body: string;
  /** Numbered steps under the body, for how-to tips. */
  steps?: string[];
  /** A plain list under the body, when the order doesn't matter. */
  points?: string[];
  /** The sidebar section the tip is about; none for a tip about the whole app. */
  section?: string;
  /** Shortcuts to the places the tip talks about, under the text. */
  links?: HelpLink[];
  /** Lazy import of the motion that shows the task, played under the text. */
  motion?: () => Promise<MotionModule>;
}

/** blocksTimeOff: holidays and approved leave take times off this person's booking page. */
export const helpTips = (blocksTimeOff: boolean): HelpTip[] => [
  {
    id: "pause-bookings",
    section: "Home",
    title: "Stop taking bookings for a while",
    body: "Turn off Accepting bookings at the top of Home. Your link stays the same and shows guests a message instead of times. To change the message, open Settings: it's under Accept bookings. Group meetings you're in still work.",
    links: [
      { label: "Go to Home", to: { section: "Home" } },
      { label: "Open Booking page settings", to: { settings: "booking" } },
    ],
    motion: () => import("@/assets/motions/pause-bookings?motion"),
  },
  {
    id: "meeting-type-link",
    section: "Meeting types",
    title: "Share a link for one meeting type",
    body: "Every meeting type has its own link, which skips the meeting choice and goes straight to picking a time. Select Copy link beside the meeting type, on Home or in Meeting types.",
    links: [{ label: "Go to Meeting types", to: { section: "Meeting types" } }],
    motion: () => import("@/assets/motions/meeting-type-link?motion"),
  },
  {
    id: "missing-times",
    section: "Availability",
    title: "Why a time isn't offered",
    body: "Guests only see times inside your weekly hours. These take times away:",
    points: [
      "Events on your Google Calendar that you made or were invited to, unless you declined them.",
      "All-day events, which block the whole day. To skip them, turn on Ignore all-day events in Settings, under Calendar.",
      ...(blocksTimeOff ? ["Holidays from your holiday list and approved leave."] : []),
      "The meeting type's own rules: Break between meetings, Max per day, Earliest booking and Book up to.",
    ],
    links: [
      { label: "Go to Availability", to: { section: "Availability" } },
      { label: "Open Calendar settings", to: { settings: "calendar" } },
    ],
  },
  {
    id: "group-link",
    section: "Group meetings",
    title: "Let guests book several people at once",
    body: "A group has one link that only offers times when everyone required is free.",
    steps: [
      "In Group meetings, select New group.",
      "Name the group and add the people. Only people who've set up Appointments show up.",
      "Turn off the switch beside anyone who's optional.",
      "Set the meeting and the booking rules, then share the group's link.",
    ],
    links: [{ label: "Go to Group meetings", to: { section: "Group meetings" } }],
    motion: () => import("@/assets/motions/group-link?motion"),
  },
  {
    id: "no-confirmation-email",
    title: "Why a guest got no confirmation email",
    body: "Confirmation emails only go out when the booking has a video link. With No video link chosen, nothing is sent. Change it in Settings, under Video calls, or in a group's Meeting step.",
    links: [{ label: "Open Video call settings", to: { settings: "video" } }],
  },
];
