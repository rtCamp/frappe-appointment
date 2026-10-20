/**
 * Google Calendar section: create (if needed) and authorize the user's Google Calendar record.
 */
import { useState } from "react";
import { CalendarDays, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/button";
import { Switch } from "@/components/switch";
import { Label } from "@/components/label";
import { cn } from "@/lib/utils";
import { CalendarInfo, OnboardingApi } from "../api";
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
import { useCalendarConnect } from "./useCalendarConnect";

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
  const { busy, error, waiting, manualUrl, timedOut, connect, cancel, checkAgain } = useCalendarConnect({
    api,
    user,
    selected,
    ignoreAllDay,
    onConnected,
  });

  const isConnected = !!selected?.custom_is_google_calendar_authorized && !!selected?.enable;

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
                  onClick={cancel}
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
              onClick={checkAgain}
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
