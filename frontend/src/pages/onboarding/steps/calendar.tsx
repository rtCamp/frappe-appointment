/**
 * Step 1: connect the user's Google Calendar (see useGoogleConnect), and how Appointments reads it.
 */
import { useContext, useState } from "react";
import { CalendarDays, LoaderCircle } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { CalendarInfo, GOOGLE_CALENDAR, errorText, isConnected } from "../api";
import GoogleConnectNotices from "../google-connect-notices";
import OtherCalendar from "../other-calendar";
import { Button, Pill, StepHeader, Switch } from "../ui";
import { useGoogleConnect } from "../use-google-connect";

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
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const connected = isConnected(calendar);

  // A blank calendar ID means the main calendar; the server stores the user's email for it.
  const savedCalendarId = calendar?.google_calendar_id && calendar.google_calendar_id !== user ? calendar.google_calendar_id : "";
  const [calendarId, setCalendarId] = useState(savedCalendarId);
  const [otherOpen, setOtherOpen] = useState(!!savedCalendarId);
  const [ignoreAllDay, setIgnoreAllDay] = useState(calendar ? !!calendar.custom_ignore_all_day_events : true);

  const google = useGoogleConnect({ user, calendar, onChanged });
  const [saving, setSaving] = useState(false);
  const busy = google.busy || saving;
  const setError = google.setError;

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
      setSaving(true);
      try {
        await db.updateDoc(GOOGLE_CALENDAR, calendar.name, { google_calendar_id: calendarId.trim() });
        await onChanged();
      } catch (err) {
        setError(errorText(err));
        return;
      } finally {
        setSaving(false);
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
          {google.waiting ? (
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
          <OtherCalendar
            user={user}
            value={calendarId}
            onChange={setCalendarId}
            open={otherOpen}
            onToggle={() => setOtherOpen((v) => !v)}
          />
        </div>
      </div>

      <GoogleConnectNotices user={user} google={google} />

      <div className="flex justify-end gap-2">
        {connected ? (
          <Button variant="solid" size="md" onClick={continueToHours} disabled={busy}>
            Continue
          </Button>
        ) : (
          <Button
            variant="solid"
            size="md"
            onClick={() => google.connect({ ignoreAllDay, calendarId, savedCalendarId })}
            disabled={busy || google.waiting}
          >
            {(busy || google.waiting) && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {google.waiting ? "Waiting for Google" : "Connect Google Calendar"}
          </Button>
        )}
      </div>
    </>
  );
};

export default CalendarStep;
