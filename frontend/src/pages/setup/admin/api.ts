/**
 * Admin setup reads one status call and saves through the standard REST resource API,
 * the same way the Desk forms for Google Settings, Appointment Settings and Appointment Group do.
 */
import { useContext, useMemo } from "react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

const ADMIN_SETUP = "frappe_appointment.api.admin_setup";
export const GOOGLE_SETTINGS = "Google Settings";
export const APPOINTMENT_SETTINGS = "Appointment Settings";
export const APPOINTMENT_GROUP = "Appointment Group";

export interface TeamMember {
  user: string;
  full_name: string;
  has_calendar: boolean;
  calendar_connected: boolean;
  availability: string | null;
  booking_live: boolean;
}

export interface ConnectedCalendar {
  name: string;
  user: string;
  full_name: string;
  zoom_email: string | null;
}

export interface GroupSummary {
  name: string;
  group_name: string;
  meet_provider: string | null;
  event_creator: string;
  members: number;
}

export interface TemplateDefaults {
  personal: string | null;
  personal_organisers: string | null;
  group: string | null;
  availability: string | null;
}

export interface AdminStatus {
  site_url: string;
  redirect_uri: string;
  google: { enable: boolean; client_id: string; has_client_secret: boolean };
  zoom: { enable: boolean; account_id: string; client_id: string; has_client_secret: boolean };
  templates: TemplateDefaults;
  email_templates: string[];
  groups: GroupSummary[];
  team: TeamMember[];
  calendars: ConnectedCalendar[];
}

export interface NewGroup {
  group_name: string;
  event_creator: string;
  members: { user: string; is_mandatory: 0 | 1 }[];
  duration_for_event: number;
  minimum_buffer_time: number;
  meet_provider: string;
  meet_link?: string | null;
  response_email_template?: string | null;
}

export const googleReady = (s: AdminStatus) => s.google.enable && !!s.google.client_id && s.google.has_client_secret;
export const zoomReady = (s: AdminStatus) =>
  s.zoom.enable && !!s.zoom.account_id && !!s.zoom.client_id && s.zoom.has_client_secret;

export const templatesReady = (s: AdminStatus) => Object.values(s.templates).every(Boolean);

/** Appointment Group names are the group name scrubbed, with hyphens (see AppointmentGroup.autoname). */
export const groupNameToId = (groupName: string) =>
  groupName.trim().replace(/[ -]/g, "_").toLowerCase().replace(/_/g, "-");

export const useAdminApi = () => {
  const frappe = useContext(FrappeContext) as FrappeConfig;

  return useMemo(() => {
    const { call, db } = frappe;
    return {
      getStatus: async () =>
        (await call.get<{ message: AdminStatus }>(`${ADMIN_SETUP}.get_admin_setup_status`)).message,

      saveGoogleSettings: (values: { enable: 0 | 1; client_id: string; client_secret?: string }) =>
        db.updateDoc(GOOGLE_SETTINGS, GOOGLE_SETTINGS, values),

      saveAppointmentSettings: (values: Record<string, unknown>) =>
        db.updateDoc(APPOINTMENT_SETTINGS, APPOINTMENT_SETTINGS, values),

      testZoom: async () =>
        (await call.post<{ message: { ok: boolean; message: string } }>(`${ADMIN_SETUP}.test_zoom_connection`))
          .message,

      setZoomEmail: (calendar: string, email: string) =>
        db.updateDoc("Google Calendar", calendar, { custom_zoom_user_email: email }),

      createGroup: (values: NewGroup) => db.createDoc(APPOINTMENT_GROUP, values),
    };
  }, [frappe]);
};

export type AdminApi = ReturnType<typeof useAdminApi>;
