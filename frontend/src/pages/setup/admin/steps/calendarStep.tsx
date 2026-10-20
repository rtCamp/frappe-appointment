/**
 * Your calendar step: the admin connects their own Google Calendar. It proves the Google
 * client works and gives team meetings a calendar to create events from.
 */
import { useState } from "react";
import { CalendarDays, LoaderCircle, RefreshCw } from "lucide-react";

import { CalendarInfo, OnboardingApi } from "../../api";
import { useCalendarConnect } from "../../steps/useCalendarConnect";
import { Field, Notice, StepHeader, Switch } from "../ui";

const CalendarStep = ({
  api,
  user,
  calendars,
  selected,
  onSelect,
  onConnected,
  onBack,
  onNext,
}: {
  api: OnboardingApi;
  user: string;
  calendars: CalendarInfo[];
  selected: CalendarInfo | null;
  onSelect: (name: string) => void;
  onConnected: (calendar: string) => Promise<void>;
  onBack: () => void;
  onNext: () => void;
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
    <>
      <StepHeader title="Connect your Google Calendar">
        This checks the Google client works, and gives group meetings a calendar to create their events from.
      </StepHeader>

      {calendars.length > 1 && (
        <Field label="Calendar" htmlFor="admin-calendar">
          <select
            id="admin-calendar"
            className="input"
            value={selected?.name ?? ""}
            onChange={(e) => onSelect(e.target.value)}
            disabled={waiting}
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

      <div className="card divide">
        <div className="flex items-center gap-3 p-4">
          <span className="ico">
            <CalendarDays aria-hidden="true" />
          </span>
          <span className="row-text flex-1">
            <span className="t-base-medium">Google Calendar</span>
            <span className="t-sm truncate" style={{ color: "var(--ink-gray-5)" }}>
              {selected?.name ?? user}
            </span>
          </span>
          {waiting ? (
            <span className="pill">Waiting for Google</span>
          ) : isConnected ? (
            <span className="pill pill-green">Connected</span>
          ) : selected && !selected.enable ? (
            <span className="pill">Turned off</span>
          ) : (
            <span className="pill pill-amber">Not connected</span>
          )}
        </div>
        {!selected && (
          <div className="row">
            <span className="row-text">
              <span className="t-base-medium">Ignore all-day events</span>
              <span className="t-p-sm" style={{ color: "var(--ink-gray-6)" }}>
                Holidays and reminders on your calendar won't hide your free time.
              </span>
            </span>
            <Switch checked={ignoreAllDay} onChange={setIgnoreAllDay} label="Ignore all-day events" />
          </div>
        )}
      </div>

      {waiting && (
        <Notice
          tone="blue"
          title="Finish signing in with Google"
          actions={
            <>
              {manualUrl && (
                <a href={manualUrl} target="_blank" rel="noreferrer" className="btn">
                  Open sign-in
                </a>
              )}
              <button type="button" className="btn btn-ghost" onClick={cancel}>
                Cancel
              </button>
            </>
          }
        >
          {manualUrl ? "Your browser blocked the sign-in window, so open it here. " : "A Google window is open. "}
          Sign in as {user} and allow access. This page updates by itself.
        </Notice>
      )}

      {!waiting && selected && !isConnected && (
        <Notice tone="amber" title="Your calendar isn't connected">
          {!selected.enable
            ? "This calendar is turned off. Connecting turns it back on."
            : "The Google sign-in wasn't finished, or the connection expired. Connect again to fix it."}
        </Notice>
      )}

      {timedOut && (
        <Notice
          tone="amber"
          title="We didn't hear back from Google"
          actions={
            <button type="button" className="btn" onClick={checkAgain}>
              <RefreshCw aria-hidden="true" /> Check again
            </button>
          }
        >
          If you finished signing in, check again. Otherwise, connect again.
        </Notice>
      )}

      {error && (
        <Notice tone="red" title="Couldn't connect">
          {error}
        </Notice>
      )}

      <div className="flex justify-between gap-2">
        <button type="button" className="btn btn-md" onClick={onBack}>
          Back
        </button>
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <button type="button" className="btn btn-md btn-ghost" onClick={connect} disabled={busy || waiting}>
                Reconnect
              </button>
              <button type="button" className="btn btn-md btn-solid" onClick={onNext}>
                Continue
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-md btn-solid" onClick={connect} disabled={busy || waiting}>
              {(busy || waiting) && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {waiting ? "Waiting for Google" : "Connect Google Calendar"}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default CalendarStep;
