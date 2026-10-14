/**
 * Thin wrappers around the existing Frappe endpoints the Desk forms already use.
 * No new server code: Google Calendar and User Appointment Availability are
 * created and updated through the standard REST resource API.
 */
import { useContext, useMemo } from "react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { getErrorMessages } from "@/lib/utils";

export const GOOGLE_CALENDAR = "Google Calendar";
export const AVAILABILITY = "User Appointment Availability";

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type Day = (typeof DAYS)[number];

export interface SetupStatus {
  is_google_calendar_setup: boolean;
  is_google_calendar_enabled: boolean;
  is_google_calendar_authorized: boolean;
  google_calendar_id: string | null;
  user_appointment_availability: string | null;
}

export interface UserInfo {
  name: string;
  full_name: string;
  time_zone: string | null;
  user_type: string;
  user_image: string | null;
}

export interface CalendarInfo {
  name: string;
  enable: 0 | 1;
  custom_is_google_calendar_authorized: 0 | 1;
  custom_ignore_all_day_events?: 0 | 1;
  modified?: string;
}

export interface TimeSlotRow {
  name?: string;
  day: Day;
  start_time: string;
  end_time: string;
}

export interface DurationRow {
  name?: string;
  title: string;
  duration: number;
  minimum_buffer_time?: number | null;
  availability_window?: number | null;
  limit_booking_frequency?: number | null;
  minimum_notice_before_event?: number | null;
  allow_rescheduling?: 0 | 1;
  minimum_notice_for_reschedule?: number | null;
}

export interface AvailabilityDoc {
  name: string;
  user: string;
  google_calendar: string;
  enable_scheduling: 0 | 1;
  slug: string | null;
  meeting_provider: string | null;
  meeting_link: string | null;
  response_email_template: string | null;
  appointment_time_slot: TimeSlotRow[];
  available_durations: DurationRow[];
}

/** "9:00:00" / "09:00:00.000000" -> "09:00:00" */
export const timeAsText = (value: string | null | undefined): string => {
  const [h = "0", m = "0", s = "0"] = String(value ?? "").split(".")[0].split(":");
  const pad = (v: string) => String(parseInt(v, 10) || 0).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

/**
 * The availability validator parses time slots with strptime, which only accepts strings.
 * Rows the request leaves out are loaded from the database as timedelta and fail, so every
 * update must send the current time slots back as text (the Desk form always does).
 */
export const slotsAsText = (rows: TimeSlotRow[] | undefined): TimeSlotRow[] =>
  (rows ?? []).map((r) => ({
    ...(r.name ? { name: r.name } : {}),
    day: r.day,
    start_time: timeAsText(r.start_time),
    end_time: timeAsText(r.end_time),
  }));

/** Turn any Frappe error into one readable sentence. */
export const errorText = (err: unknown): string => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = getErrorMessages(err as any);
    const text = messages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => (typeof m === "string" ? m : m?.message))
      .filter(Boolean)
      .join(" ");
    const clean = text.replace(/<\/?[^>]+(>|$)/g, "").trim();
    return clean || "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
};

export const useOnboardingApi = () => {
  const frappe = useContext(FrappeContext) as FrappeConfig;

  return useMemo(() => {
    const { call, db } = frappe;
    return {
      getStatus: async (user: string) =>
        (
          await call.get<{ message: SetupStatus }>(
            "frappe_appointment.api.utils.check_google_calendar_setup",
            { user }
          )
        ).message,

      getUser: async (user: string) =>
        (
          await call.get<{ message: Omit<UserInfo, "name"> }>(
            "frappe.client.get_value",
            {
              doctype: "User",
              filters: user,
              fieldname: JSON.stringify([
                "full_name",
                "time_zone",
                "user_type",
                "user_image",
              ]),
            }
          )
        ).message,

      setTimeZone: (user: string, timeZone: string) =>
        call.post("frappe.client.set_value", {
          doctype: "User",
          name: user,
          fieldname: "time_zone",
          value: timeZone,
        }),

      listCalendars: (user: string) =>
        db.getDocList<CalendarInfo>(GOOGLE_CALENDAR, {
          fields: [
            "name",
            "enable",
            "custom_is_google_calendar_authorized",
            "custom_ignore_all_day_events",
            "modified",
          ],
          filters: [["user", "=", user]],
          orderBy: { field: "modified", order: "desc" },
          limit: 20,
        }),

      getCalendarState: async (name: string) =>
        (
          await call.get<{
            message: Pick<CalendarInfo, "custom_is_google_calendar_authorized" | "enable" | "modified">;
          }>("frappe.client.get_value", {
            doctype: GOOGLE_CALENDAR,
            filters: name,
            fieldname: JSON.stringify([
              "custom_is_google_calendar_authorized",
              "enable",
              "modified",
            ]),
          })
        ).message,

      createCalendar: (values: Record<string, unknown>) =>
        db.createDoc(GOOGLE_CALENDAR, values),

      updateCalendar: (name: string, values: Record<string, unknown>) =>
        db.updateDoc(GOOGLE_CALENDAR, name, values),

      getAuthorizeUrl: async (calendar: string) =>
        (
          await call.post<{ message: { url: string } }>(
            "frappe.integrations.doctype.google_calendar.google_calendar.authorize_access",
            { g_calendar: calendar, reauthorize: 1 }
          )
        ).message?.url,

      getAvailability: (name: string) =>
        db.getDoc<AvailabilityDoc>(AVAILABILITY, name) as Promise<AvailabilityDoc>,

      createAvailability: (values: Partial<AvailabilityDoc>) =>
        db.createDoc(AVAILABILITY, values) as unknown as Promise<AvailabilityDoc>,

      updateAvailability: (name: string, values: Partial<AvailabilityDoc>) =>
        db.updateDoc(AVAILABILITY, name, values) as unknown as Promise<AvailabilityDoc>,

      isSlugAvailable: async (slug: string) =>
        (
          await call.get<{
            message: { is_available: boolean; suggested_slug: string | null };
          }>(
            "frappe_appointment.frappe_appointment.doctype.user_appointment_availability.user_appointment_availability.is_slug_available",
            { slug }
          )
        ).message,

      getDefaultTemplates: async () =>
        (
          await call.get<{ message: { personal: string | null } }>(
            "frappe_appointment.frappe_appointment.doctype.appointment_settings.appointment_settings.get_default_email_template"
          )
        ).message,
    };
  }, [frappe]);
};

export type OnboardingApi = ReturnType<typeof useOnboardingApi>;
