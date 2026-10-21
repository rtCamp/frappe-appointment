import { getErrorMessages } from "@/lib/utils";

export const ONBOARDING_STATUS = "frappe_appointment.api.onboarding.get_onboarding_status";
export const GOOGLE_CALENDAR = "Google Calendar";
export const AUTHORIZE_GOOGLE_CALENDAR = "frappe.integrations.doctype.google_calendar.google_calendar.authorize_access";

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

export interface SessionUser {
  name: string;
  fullName: string;
}

interface Boot {
  user?: { name?: string };
  user_info?: Record<string, { fullname?: string }>;
}

/** The logged-in user from the boot data Frappe renders into the page, or null for guests. */
export const getSessionUser = (): SessionUser | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boot: Boot = (window as any).frappe?.boot ?? {};
  const name = boot.user?.name;
  if (!name || name === "Guest") return null;
  return { name, fullName: boot.user_info?.[name]?.fullname || name };
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
