/**
 * Google Calendar section: create (if needed) and authorize the user's Google Calendar record.
 * Uses the same authorize_access call as the Desk "Authorize Google Calendar Access" button,
 * in a popup, and polls the record until the Google callback marks it authorized.
 */
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/button";
import { Switch } from "@/components/switch";
import { Label } from "@/components/label";
import { cn } from "@/lib/utils";
import { CalendarInfo, OnboardingApi, errorText } from "../api";
import {
  Box,
  Field,
  Notice,
  Section,
  StatusPill,
  blueButton,
  blueGhostButton,
  blueSwitch,
  panel,
} from "../ui";

const POLL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

interface Waiting {
  calendar: string;
  wasAuthorized: boolean;
  modifiedBefore?: string;
  startedAt: number;
}

const CalendarStep = ({
  api,
  user,
  calendars,
  selected,
  onSelect,
  onConnected,
}: {
  api: OnboardingApi;
  user: string;
  calendars: CalendarInfo[];
  selected: CalendarInfo | null;
  onSelect: (name: string) => void;
  onConnected: (calendar: string) => Promise<void>;
}) => {
  const [ignoreAllDay, setIgnoreAllDay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const isConnected = !!selected?.custom_is_google_calendar_authorized && !!selected?.enable;

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

  return (
    <Section
      title="Google Calendar"
      description="We check your calendar so people can only book times when you're free, and every booking is added to it automatically."
    >
      <Box className="flex flex-col gap-6">
        {calendars.length > 1 && (
          <Field label="Calendar" htmlFor="setup-calendar">
            <select
              id="setup-calendar"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              value={selected?.name ?? ""}
              onChange={(e) => onSelect(e.target.value)}
              disabled={!!waiting}
            >
              {calendars.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                  {c.custom_is_google_calendar_authorized ? " (connected)" : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className={cn(panel, "flex items-center gap-4 p-4")}>
          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-600/20 flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{selected ? selected.name : "No calendar connected yet"}</p>
            <p className="text-sm text-muted-foreground truncate">Google account: {user}</p>
          </div>
          {selected &&
            (isConnected ? (
              <StatusPill tone="green">Connected</StatusPill>
            ) : !selected.enable ? (
              <StatusPill tone="gray">Turned off</StatusPill>
            ) : (
              <StatusPill tone="amber">Not connected</StatusPill>
            ))}
        </div>

        {!selected && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="setup-allday">Don't block my day for all-day events</Label>
              <p className="text-sm text-muted-foreground">
                Recommended. All-day items like holidays or reminders won't hide your free time.
              </p>
            </div>
            <Switch id="setup-allday" checked={ignoreAllDay} onCheckedChange={setIgnoreAllDay} className={blueSwitch} />
          </div>
        )}

        {!isConnected && selected && !waiting && (
          <Notice tone="amber" title="Your calendar isn't connected">
            {!selected.enable
              ? "This calendar is turned off. Connecting will turn it back on."
              : "Either the Google sign-in was never finished, or the connection expired. Connect again to fix it."}
          </Notice>
        )}

        {waiting && (
          <Notice
            tone="blue"
            title="Finish signing in with Google"
            actions={
              <>
                {manualUrl && (
                  <Button asChild size="sm" className={blueButton}>
                    <a href={manualUrl} target="_blank" rel="noreferrer">
                      <ExternalLink /> Open Google sign-in
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className={blueGhostButton}
                  onClick={() => {
                    popupRef.current?.close();
                    setWaiting(null);
                  }}
                >
                  Cancel
                </Button>
              </>
            }
          >
            {manualUrl ? "Your browser blocked the sign-in window, so open it with the button below. " : "A Google window has opened. "}
            Sign in as <span className="font-medium text-foreground">{user}</span> and allow access. This page
            updates by itself once you're done, and you can close the Google tab.
          </Notice>
        )}

        {timedOut && (
          <Notice tone="amber" title="We didn't hear back from Google">
            If you finished signing in, click Check again. Otherwise, connect again.
          </Notice>
        )}

        {error && <Notice tone="red" title="Couldn't connect">{error}</Notice>}

        <div className="flex flex-wrap justify-end gap-2">
          {timedOut && selected && (
            <Button
              variant="ghost"
              className={blueGhostButton}
              onClick={async () => {
                setTimedOut(false);
                await onConnected(selected.name);
              }}
            >
              <RefreshCw /> Check again
            </Button>
          )}
          {isConnected ? (
            <Button variant="ghost" className={blueGhostButton} onClick={connect} disabled={busy || !!waiting}>
              {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Reconnect
            </Button>
          ) : (
            <Button className={blueButton} onClick={connect} disabled={busy || !!waiting}>
              {busy || waiting ? <LoaderCircle className="animate-spin" /> : <CalendarDays />}
              {waiting ? "Waiting for Google…" : "Connect Google Calendar"}
            </Button>
          )}
        </div>
      </Box>
    </Section>
  );
};

export default CalendarStep;
