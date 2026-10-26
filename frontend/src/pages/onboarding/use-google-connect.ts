/**
 * Connecting (or reconnecting) the user's Google Calendar: creates their Google Calendar record if
 * needed, sends them through Google's sign-in in a popup (the same authorize_access call as Desk),
 * and polls the record until the callback saves a sign-in that Google accepts.
 */
import { useContext, useEffect, useRef, useState } from "react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { AUTHORIZE_GOOGLE_CALENDAR, CalendarInfo, GOOGLE_CALENDAR, IS_CALENDAR_CONNECTED, errorText } from "./api";

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

interface Waiting {
  calendar: string;
  /** The record's modified time before sign-in. A dead sign-in stays saved and authorized, so only a newer save counts. */
  since: string;
  startedAt: number;
  closedAt?: number;
}

/** What a new calendar record starts with, and what changed on an existing one. */
export interface ConnectOptions {
  ignoreAllDay: boolean;
  calendarId: string;
  savedCalendarId: string;
}

const getCalendarState = async (
  call: FrappeConfig["call"],
  name: string
): Promise<{ custom_is_google_calendar_authorized: 0 | 1; modified: string }> =>
  (
    await call.get("frappe.client.get_value", {
      doctype: GOOGLE_CALENDAR,
      filters: name,
      fieldname: JSON.stringify(["custom_is_google_calendar_authorized", "modified"]),
    })
  ).message;

export const useGoogleConnect = ({
  user,
  calendar,
  onChanged,
}: {
  user: string;
  calendar: CalendarInfo | null;
  onChanged: () => Promise<void>;
}) => {
  const { call, db } = useContext(FrappeContext) as FrappeConfig;
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [didNotFinish, setDidNotFinish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  // A record made by a sign-in that didn't finish. The page only loads it once sign-in works, so a retry reuses it.
  const createdRef = useRef<string | null>(null);

  const createCalendar = async ({ ignoreAllDay, calendarId }: ConnectOptions): Promise<string> => {
    const values = {
      user,
      enable: 1,
      // Bookings must reach Google; Appointments reads busy times live, so pulling events into ERP isn't needed.
      push_to_google_calendar: 1,
      pull_from_google_calendar: 0,
      sync_as_public: 0,
      custom_ignore_all_day_events: ignoreAllDay ? 1 : 0,
      google_calendar_id: calendarId.trim(),
    };
    try {
      return (await db.createDoc(GOOGLE_CALENDAR, { ...values, calendar_name: user })).name;
    } catch (err) {
      // calendar_name is unique; someone may already have a record named after them that this user can't see.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.exc_type !== "DuplicateEntryError") throw err;
      return (await db.createDoc(GOOGLE_CALENDAR, { ...values, calendar_name: `${user} (Appointments)` })).name;
    }
  };

  const connect = async (options: ConnectOptions) => {
    setError(null);
    setDidNotFinish(false);
    setManualUrl(null);
    // Open the popup straight from the click so the browser doesn't block it, then point it at Google.
    const popup = window.open("about:blank", "appointments-google-auth", "width=520,height=720");
    popupRef.current = popup;
    setBusy(true);
    try {
      let name = calendar?.name ?? createdRef.current;
      if (!name) {
        name = await createCalendar(options);
        createdRef.current = name;
      } else if (!calendar) {
        await db.updateDoc(GOOGLE_CALENDAR, name, {
          custom_ignore_all_day_events: options.ignoreAllDay ? 1 : 0,
          google_calendar_id: options.calendarId.trim(),
        });
      } else if (!calendar.enable || options.calendarId.trim() !== options.savedCalendarId) {
        await db.updateDoc(GOOGLE_CALENDAR, name, { enable: 1, google_calendar_id: options.calendarId.trim() });
      }
      const since = (await getCalendarState(call, name)).modified;
      const url = (await call.post(AUTHORIZE_GOOGLE_CALENDAR, { g_calendar: name, reauthorize: 1 })).message?.url;
      if (!url) throw new Error("Google sign-in isn't available. Ask your admin to check Google Settings.");
      if (popup && !popup.closed) {
        popup.location.href = url;
      } else if (popup) {
        // The window was closed before Google loaded in it.
        setDidNotFinish(true);
        return;
      } else {
        // The browser blocked the window, so offer the link instead.
        setManualUrl(url);
      }
      setWaiting({ calendar: name, since, startedAt: Date.now() });
    } catch (err) {
      popup?.close();
      setError(err instanceof Error && !("exc_type" in err) ? err.message : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    popupRef.current?.close();
    setWaiting(null);
  };

  // Poll until Google's callback saves a sign-in Google accepts, or the window closes without it.
  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const state = await getCalendarState(call, waiting.calendar);
        if (stopped) return;
        // The callback saves the code before swapping it for a sign-in, so also ask Google that it works.
        const signedIn =
          !!state.custom_is_google_calendar_authorized &&
          state.modified !== waiting.since &&
          !!(await call.get(IS_CALENDAR_CONNECTED, { calendar: waiting.calendar })).message;
        if (stopped) return;
        if (signedIn) {
          stopped = true;
          popupRef.current?.close();
          setWaiting(null);
          await onChanged();
          return;
        }
      } catch {
        // A failed poll shouldn't end the sign-in; try again on the next tick.
      }
      const closed = !manualUrl && popupRef.current?.closed;
      // Give the callback one more poll after the window closes before giving up.
      if (closed && !waiting.closedAt) setWaiting({ ...waiting, closedAt: Date.now() });
      else if ((closed && waiting.closedAt) || Date.now() - waiting.startedAt > POLL_TIMEOUT_MS) {
        stopped = true;
        setWaiting(null);
        setDidNotFinish(true);
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [waiting, manualUrl, call, onChanged]);

  return { connect, cancel, busy, waiting: !!waiting, manualUrl, didNotFinish, error, setError };
};

export type GoogleConnect = ReturnType<typeof useGoogleConnect>;
