/**
 * Step 1: connect the user's Google Calendar.
 * Creates their Google Calendar record if needed, sends them through Google's sign-in in a
 * popup (the same authorize_access call as Desk), and polls the record until the callback
 * marks it authorized.
 */
import { useContext, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronRight, LoaderCircle } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import {
  AUTHORIZE_GOOGLE_CALENDAR,
  CalendarInfo,
  GOOGLE_CALENDAR,
  errorText,
  isConnected,
} from "../api";
import { Button, Notice, Pill, StepHeader, Switch } from "../ui";

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

interface Waiting {
  calendar: string;
  startedAt: number;
  closedAt?: number;
}

const CalendarStep = ({
  user,
  calendar,
  onChanged,
  onContinue,
}: {
  user: string;
  calendar: CalendarInfo | null;
  onChanged: () => Promise<void>;
  onContinue: () => void;
}) => {
  const { call, db } = useContext(FrappeContext) as FrappeConfig;
  const connected = isConnected(calendar);

  // A blank calendar ID means the main calendar; the server stores the user's email for it.
  const savedCalendarId = calendar?.google_calendar_id && calendar.google_calendar_id !== user ? calendar.google_calendar_id : "";
  const [calendarId, setCalendarId] = useState(savedCalendarId);
  const [otherOpen, setOtherOpen] = useState(!!savedCalendarId);
  const [ignoreAllDay, setIgnoreAllDay] = useState(calendar ? !!calendar.custom_ignore_all_day_events : true);

  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [didNotFinish, setDidNotFinish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  const createCalendar = async (): Promise<string> => {
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

  const connect = async () => {
    setError(null);
    setDidNotFinish(false);
    setManualUrl(null);
    // Open the popup straight from the click so the browser doesn't block it, then point it at Google.
    const popup = window.open("about:blank", "appointments-google-auth", "width=520,height=720");
    popupRef.current = popup;
    setBusy(true);
    try {
      let name = calendar?.name;
      if (!name) {
        name = await createCalendar();
      } else if (!calendar?.enable || calendarId.trim() !== savedCalendarId) {
        await db.updateDoc(GOOGLE_CALENDAR, name, { enable: 1, google_calendar_id: calendarId.trim() });
      }
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
      setWaiting({ calendar: name, startedAt: Date.now() });
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

  // Poll until Google's callback marks the record authorized, or the window closes without it.
  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const state = (
          await call.get("frappe.client.get_value", {
            doctype: GOOGLE_CALENDAR,
            filters: waiting.calendar,
            fieldname: JSON.stringify(["custom_is_google_calendar_authorized"]),
          })
        ).message;
        if (stopped) return;
        if (state?.custom_is_google_calendar_authorized) {
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

  const changeIgnoreAllDay = async (value: boolean) => {
    setIgnoreAllDay(value);
    if (!calendar) return;
    try {
      await db.updateDoc(GOOGLE_CALENDAR, calendar.name, { custom_ignore_all_day_events: value ? 1 : 0 });
    } catch (err) {
      setIgnoreAllDay(!value);
      setError(errorText(err));
    }
  };

  const continueToHours = async () => {
    if (calendar && calendarId.trim() !== savedCalendarId) {
      setBusy(true);
      try {
        await db.updateDoc(GOOGLE_CALENDAR, calendar.name, { google_calendar_id: calendarId.trim() });
        await onChanged();
      } catch (err) {
        setError(errorText(err));
        return;
      } finally {
        setBusy(false);
      }
    }
    onContinue();
  };

  return (
    <>
      <StepHeader title="Connect your Google Calendar">
        We only offer times when you're free, and every booking is added to your calendar automatically.
      </StepHeader>

      <div className="rounded-xl border border-outline-gray-1 flex flex-col">
        <div className="flex items-center gap-3 p-4">
          <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0 bg-surface-gray-2 text-ink-gray-7">
            <CalendarDays className="w-[18px] h-[18px]" aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="text-es-base font-medium text-ink-gray-8">Google Calendar</span>
            <span className="text-es-sm text-ink-gray-5 truncate">{user}</span>
          </span>
          {waiting ? (
            <Pill>Waiting for Google</Pill>
          ) : connected ? (
            <Pill tone="green">Connected</Pill>
          ) : (
            <Pill tone="amber">Not connected</Pill>
          )}
        </div>

        <div className="h-px bg-outline-gray-1" />
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <span className="flex flex-col gap-1">
            <span className="text-es-base font-medium text-ink-gray-8">Ignore all-day events</span>
            <span className="text-es-p-sm text-ink-gray-6">Holidays and reminders on your calendar won't hide your free time.</span>
          </span>
          <Switch checked={ignoreAllDay} onChange={changeIgnoreAllDay} label="Ignore all-day events" />
        </div>

        <div className="h-px bg-outline-gray-1" />
        <div className="flex flex-col gap-3 px-4 pt-2.5 pb-3.5">
          <button
            type="button"
            aria-expanded={otherOpen}
            aria-controls="calendar-other"
            onClick={() => setOtherOpen((v) => !v)}
            className="self-start inline-flex items-center gap-1.5 min-h-7 px-2 -ml-2 text-left rounded-lg border-0 bg-transparent text-es-base text-ink-gray-7 cursor-pointer hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:shadow-es-focus"
          >
            <ChevronRight className={cn("w-4 h-4 transition-transform", otherOpen && "rotate-90")} aria-hidden="true" />
            Use a different calendar in this Google account
          </button>
          {otherOpen && (
            <div id="calendar-other" className="flex flex-col gap-1.5">
              <label htmlFor="calendar-id" className="text-es-sm text-ink-gray-6">
                Calendar ID
              </label>
              <input
                id="calendar-id"
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder={user}
                autoComplete="off"
                spellCheck={false}
                className="h-7 px-2 rounded-lg border border-transparent bg-surface-gray-2 text-es-base text-ink-gray-8 placeholder:text-ink-gray-4 hover:bg-surface-gray-3 focus:outline-none focus:bg-surface-base focus:border-outline-gray-4 focus:shadow-es-focus"
              />
              <span className="text-es-p-sm text-ink-gray-5">
                Leave blank to use your main calendar. Bookings go to this calendar, and only events on it block your
                time. Find the ID in Google Calendar under Settings, Integrate calendar.
              </span>
            </div>
          )}
        </div>
      </div>

      {waiting && (
        <Notice
          tone="blue"
          icon={<LoaderCircle className="w-4 h-4 shrink-0 mt-px text-ink-blue-5 animate-spin" aria-hidden="true" />}
          title="Finish signing in with Google"
          actions={
            <>
              {manualUrl && (
                <a href={manualUrl} target="_blank" rel="noreferrer" className="inline-flex items-center h-7 px-2 rounded-lg bg-surface-gray-3 text-es-base text-ink-gray-8 no-underline">
                  Open sign-in
                </a>
              )}
              <Button variant="ghost" onClick={cancel}>
                Cancel
              </Button>
            </>
          }
        >
          {manualUrl ? "Your browser blocked the sign-in window, so open it here. " : "A Google window is open. "}
          Sign in as {user} and allow access. This page updates by itself.
        </Notice>
      )}

      {didNotFinish && (
        <Notice tone="red" title="Google didn't connect your calendar">
          The sign-in closed before Google finished. If Google showed an error, the site's Google setup isn't finished:
          ask your admin to check that the redirect URI in Google Cloud matches this site exactly. Otherwise, try again.
        </Notice>
      )}

      {error && (
        <Notice tone="red" title="Couldn't connect your calendar">
          {error}
        </Notice>
      )}

      <div className="flex justify-end gap-2">
        {connected ? (
          <Button variant="solid" size="md" onClick={continueToHours} disabled={busy}>
            Continue
          </Button>
        ) : (
          <Button variant="solid" size="md" onClick={connect} disabled={busy || !!waiting}>
            {(busy || waiting) && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {waiting ? "Waiting for Google" : "Connect Google Calendar"}
          </Button>
        )}
      </div>
    </>
  );
};

export default CalendarStep;
