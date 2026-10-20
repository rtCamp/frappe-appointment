/**
 * Create (if needed) and authorize a user's Google Calendar record.
 * Uses the same authorize_access call as the Desk "Authorize Google Calendar Access" button,
 * in a popup, and polls the record until the Google callback marks it authorized.
 */
import { useEffect, useRef, useState } from "react";

import { CalendarInfo, OnboardingApi, errorText } from "../api";

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

interface Waiting {
  calendar: string;
  wasAuthorized: boolean;
  modifiedBefore?: string;
  startedAt: number;
}

export const useCalendarConnect = ({
  api,
  user,
  selected,
  ignoreAllDay,
  onConnected,
}: {
  api: OnboardingApi;
  user: string;
  selected: CalendarInfo | null;
  ignoreAllDay: boolean;
  onConnected: (calendar: string) => Promise<void>;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const createCalendar = async (): Promise<string> => {
    const values = {
      user,
      enable: 1,
      pull_from_google_calendar: 1,
      push_to_google_calendar: 1,
      custom_ignore_all_day_events: ignoreAllDay ? 1 : 0,
    };
    try {
      const doc = await api.createCalendar({ ...values, calendar_name: user });
      return doc.name as string;
    } catch (err) {
      // calendar_name is unique; fall back to a second name if the email is already taken.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.exc_type === "DuplicateEntryError") {
        const doc = await api.createCalendar({ ...values, calendar_name: `${user} (appointments)` });
        return doc.name as string;
      }
      throw err;
    }
  };

  const connect = async () => {
    setError(null);
    setTimedOut(false);
    setManualUrl(null);
    // Open the popup synchronously so the browser doesn't block it, then point it at Google.
    const popup = window.open("about:blank", "appointments-google-auth", "width=520,height=720");
    popupRef.current = popup;
    setBusy(true);
    try {
      let name = selected?.name;
      if (!name) {
        name = await createCalendar();
      } else if (!selected?.enable) {
        await api.updateCalendar(name, { enable: 1 });
      }
      const url = await api.getAuthorizeUrl(name);
      if (!url) throw new Error("Google sign-in isn't available. Ask your admin to check Google Settings.");
      if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        setManualUrl(url);
      }
      setWaiting({
        calendar: name,
        wasAuthorized: !!selected?.custom_is_google_calendar_authorized,
        modifiedBefore: selected?.modified,
        startedAt: Date.now(),
      });
    } catch (err) {
      popup?.close();
      setError(err instanceof Error ? err.message : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    popupRef.current?.close();
    setWaiting(null);
  };

  const checkAgain = async () => {
    if (!selected) return;
    setTimedOut(false);
    await onConnected(selected.name);
  };

  // Poll until the Google callback flips the authorized flag on the record.
  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (Date.now() - waiting.startedAt > POLL_TIMEOUT_MS) {
        setWaiting(null);
        setTimedOut(true);
        return;
      }
      try {
        const state = await api.getCalendarState(waiting.calendar);
        let authorized = !!state?.custom_is_google_calendar_authorized;
        if (!state) {
          authorized = !!(await api.getStatus(user)).is_google_calendar_authorized;
        }
        const changed = !waiting.wasAuthorized || (state?.modified && state.modified !== waiting.modifiedBefore);
        if (authorized && changed && !stopped) {
          stopped = true;
          popupRef.current?.close();
          setWaiting(null);
          await onConnected(waiting.calendar);
        }
      } catch {
        // keep polling; a transient error shouldn't end the flow
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [waiting, api, user, onConnected]);

  return { busy, error, waiting: !!waiting, manualUrl, timedOut, connect, cancel, checkAgain };
};
