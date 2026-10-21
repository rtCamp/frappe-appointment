import { getErrorMessages } from "@/lib/utils";

export const ONBOARDING_STATUS = "frappe_appointment.api.onboarding.get_onboarding_status";
export const GOOGLE_CALENDAR = "Google Calendar";
export const AUTHORIZE_GOOGLE_CALENDAR = "frappe.integrations.doctype.google_calendar.google_calendar.authorize_access";
export const AVAILABILITY = "User Appointment Availability";

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Day = (typeof DAYS)[number];

/** google_ready is only sent to desk (System) users. */
export interface OnboardingStatus {
  user_type: string;
  google_ready?: boolean;
}

export interface CalendarInfo {
  name: string;
  enable: 0 | 1;
  custom_is_google_calendar_authorized: 0 | 1;
  custom_ignore_all_day_events: 0 | 1;
  google_calendar_id: string | null;
  modified: string;
}

export const CALENDAR_FIELDS = [
  "name",
  "enable",
  "custom_is_google_calendar_authorized",
  "custom_ignore_all_day_events",
  "google_calendar_id",
  "modified",
];

export const isConnected = (calendar: CalendarInfo | null) =>
  !!calendar?.enable && !!calendar?.custom_is_google_calendar_authorized;

/** The calendar Appointments uses: a connected one if there is one, else the newest. */
export const pickCalendar = (calendars: CalendarInfo[]) => calendars.find(isConnected) ?? calendars[0] ?? null;

export interface TimeSlot {
  day: Day;
  start_time: string;
  end_time: string;
}

/** The fields of User Appointment Availability these steps read; it is named after the user. */
export interface Availability {
  name: string;
  google_calendar: string;
  appointment_time_slot: TimeSlot[];
}

/** "9:00:00" from the server -> "09:00" for a time input. */
export const toInputTime = (value: string) => {
  const [h = "0", m = "0"] = value.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
};

/** "09:00" -> "09:00:00"; the availability check only accepts times written out like this. */
export const toServerTime = (value: string) => `${value}:00`;

/** Errors from a document the user isn't allowed to open: someone else created it in Desk. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNotYours = (err: any) => err?.exc_type === "PermissionError" || err?.httpStatus === 403;

export interface SessionUser {
  name: string;
  fullName: string;
  timeZone: string;
}

interface Boot {
  user?: { name?: string };
  user_info?: Record<string, { fullname?: string }>;
  time_zone?: { system?: string; user?: string };
}

/** The logged-in user from the boot data Frappe renders into the page, or null for guests. */
export const getSessionUser = (): SessionUser | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boot: Boot = (window as any).frappe?.boot ?? {};
  const name = boot.user?.name;
  if (!name || name === "Guest") return null;
  return {
    name,
    fullName: boot.user_info?.[name]?.fullname || name,
    timeZone: boot.time_zone?.user || boot.time_zone?.system || Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
};

/** One readable sentence from a Frappe error response. */
export const errorText = (err: unknown): string => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = getErrorMessages(err as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => (typeof m === "string" ? m : m?.message))
      .filter(Boolean)
      .join(" ")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .trim();
    return text || "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
};
