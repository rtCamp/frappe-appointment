import { getErrorMessages } from "@/lib/utils";

export const ONBOARDING_STATUS = "frappe_appointment.api.onboarding.get_onboarding_status";
export const GOOGLE_SETUP = "frappe_appointment.api.onboarding.get_google_setup";
export const GOOGLE_SETTINGS = "Google Settings";
export const EVENT = "Event";
export const GOOGLE_CALENDAR = "Google Calendar";
export const AUTHORIZE_GOOGLE_CALENDAR = "frappe.integrations.doctype.google_calendar.google_calendar.authorize_access";
export const AVAILABILITY = "User Appointment Availability";
export const IS_SLUG_AVAILABLE =
  "frappe_appointment.frappe_appointment.doctype.user_appointment_availability.user_appointment_availability.is_slug_available";
export const DEFAULT_EMAIL_TEMPLATES =
  "frappe_appointment.frappe_appointment.doctype.appointment_settings.appointment_settings.get_default_email_template";

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Day = (typeof DAYS)[number];

/** Everything but user_type is only sent to desk (System) users. */
export interface OnboardingStatus {
  user_type: string;
  is_admin?: boolean;
  google_ready?: boolean;
  zoom_ready?: boolean;
  /** Approved leave and holidays block booking days (HR apps installed, and the user is an Employee). */
  blocks_time_off?: boolean;
}

/** For System Managers: what to paste into Google Cloud, and what Google Settings already holds. */
export interface GoogleSetup {
  origin: string;
  domain: string;
  redirect_uri: string;
  enabled: boolean;
  client_id: string;
  has_client_secret: boolean;
}

export interface CalendarInfo {
  name: string;
  enable: 0 | 1;
  custom_is_google_calendar_authorized: 0 | 1;
  custom_ignore_all_day_events: 0 | 1;
  google_calendar_id: string | null;
  custom_zoom_user_email: string | null;
  modified: string;
}

export const CALENDAR_FIELDS = [
  "name",
  "enable",
  "custom_is_google_calendar_authorized",
  "custom_ignore_all_day_events",
  "google_calendar_id",
  "custom_zoom_user_email",
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

/** A row of available_durations: one meeting type on the booking page. Durations are in seconds. */
export interface MeetingType {
  name?: string;
  title: string;
  duration: number;
  minimum_buffer_time: number | null;
  availability_window: number | null;
  limit_booking_frequency: number | null;
  minimum_notice_before_event: number | null;
  allow_rescheduling: 0 | 1;
  minimum_notice_for_reschedule: number | null;
}

/** The fields of User Appointment Availability these steps read; it is named after the user. */
export interface Availability {
  name: string;
  google_calendar: string;
  appointment_time_slot: TimeSlot[];
  enable_scheduling: 0 | 1;
  slug: string | null;
  meeting_provider: "None" | "Custom" | "Zoom" | "Google Meet" | "" | null;
  meeting_link: string | null;
  response_email_template: string | null;
  available_durations: MeetingType[];
}

/**
 * Setup is finished: the booking page has a link and meeting types. It can still be turned off
 * (enable_scheduling); that pauses bookings without sending anyone back through setup.
 */
export const isSetUp = (availability: Availability | null) =>
  !!availability?.slug && availability.available_durations.length > 0 && availability.appointment_time_slot.length > 0;

/** Same rule as the server's SLUG_REGEX. */
export const SLUG_PATTERN = /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/;

/** "Robin Roy" -> "robin-roy" */
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "9:00:00" from the server -> "09:00" for a time input. */
export const toInputTime = (value: string) => {
  const [h = "0", m = "0"] = value.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
};

/** "09:00" -> "09:00:00"; the availability check only accepts times written out like this. */
export const toServerTime = (value: string) => `${value}:00`;

/**
 * The saved time slots as text. Every save of the availability record has to send them: the server
 * parses them with strptime, and rows it loads itself come back as timedelta and fail.
 */
export const slotsAsText = (availability: Availability) =>
  availability.appointment_time_slot.map((s) => ({
    day: s.day,
    start_time: toServerTime(toInputTime(s.start_time)),
    end_time: toServerTime(toInputTime(s.end_time)),
  }));

/** A length in seconds, in words: "30 min", "1 hr", "1 hr 30 min". */
export const durationLabel = (seconds: number) => {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)} hr ${m % 60} min`;
};

/** What a booking page offers for video calls, in words. */
export const providerLabel = (provider: Availability["meeting_provider"]) =>
  provider === "Custom" ? "Your own link" : provider === "None" || !provider ? "No video link" : provider;

/** A personal booking: an Event linked to the host's availability. Times are in the site's time zone. */
export interface Booking {
  name: string;
  subject: string;
  starts_on: string;
  ends_on: string | null;
  custom_meeting_provider: Availability["meeting_provider"];
}

/** Minutes a time zone is ahead of UTC at a given moment. */
const zoneOffset = (timeZone: string, at: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - at.getTime()) / 60000;
};

/** "2026-10-14 02:00:00" as written in the site's time zone -> the moment it means. */
export const fromSiteTime = (value: string, siteTimeZone: string) => {
  const [date, time = "00:00:00"] = value.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi, s] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi, Math.floor(s || 0));
  return new Date(wall - zoneOffset(siteTimeZone, new Date(wall)) * 60000);
};

/** The current moment written in the site's time zone, for filtering Events. */
export const siteNow = (siteTimeZone: string) => {
  const shifted = new Date(Date.now() + zoneOffset(siteTimeZone, new Date()) * 60000);
  return shifted.toISOString().slice(0, 19).replace("T", " ");
};

export const NOT_YOURS =
  "Your availability was created by someone else in Desk, so you can't change it here. Ask your admin to fix it.";

/** Errors from a document the user isn't allowed to open: someone else created it in Desk. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNotYours = (err: any) => err?.exc_type === "PermissionError" || err?.httpStatus === 403;

export interface SessionUser {
  name: string;
  fullName: string;
  timeZone: string;
  /** The site's time zone, which Datetime fields like Event.starts_on are written in. */
  siteTimeZone: string;
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
    siteTimeZone: boot.time_zone?.system || Intl.DateTimeFormat().resolvedOptions().timeZone,
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
