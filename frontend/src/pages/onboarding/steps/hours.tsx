/**
 * Step 2: the user's time zone and weekly hours, saved to User.time_zone and the
 * User Appointment Availability time slots (one range per weekday).
 */
import { useContext, useMemo, useState } from "react";
import { ChevronDown, Copy, LoaderCircle } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn, getAllSupportedTimeZones } from "@/lib/utils";
import {
  AVAILABILITY,
  Availability,
  DAYS,
  Day,
  errorText,
  isNotYours,
  toInputTime,
  toServerTime,
} from "../api";
import { Button, Notice, StepHeader, Switch } from "../ui";

interface DayHours {
  day: Day;
  on: boolean;
  start: string;
  end: string;
}

const NOT_YOURS = "Your availability was created by someone else in Desk, so you can't change it here. Ask your admin to fix it.";

/** Saved hours, or Monday to Friday 9 to 5 for someone setting up for the first time. */
const initialDays = (availability: Availability | null): DayHours[] =>
  DAYS.map((day, i) => {
    const slot = availability?.appointment_time_slot.find((s) => s.day === day);
    if (availability) {
      return slot
        ? { day, on: true, start: toInputTime(slot.start_time), end: toInputTime(slot.end_time) }
        : { day, on: false, start: "09:00", end: "17:00" };
    }
    return { day, on: i < 5, start: "09:00", end: "17:00" };
  });

/** "GMT+5:30" for a time zone, or "" if the browser doesn't know it. */
const gmtOffset = (timeZone: string) => {
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
};

const timeInputClass =
  "w-[124px] h-7 px-2 rounded-lg border border-transparent bg-surface-gray-2 text-es-base tabular-nums text-ink-gray-8 [color-scheme:light] dark:[color-scheme:dark] hover:bg-surface-gray-3 focus:outline-none focus:bg-surface-base focus:border-outline-gray-4 focus:shadow-es-focus";

const HoursStep = ({
  user,
  timeZone: savedTimeZone,
  calendar,
  availability,
  notYours,
  onSaved,
  onBack,
}: {
  user: string;
  timeZone: string;
  calendar: string;
  availability: Availability | null;
  notYours: boolean;
  onSaved: (timeZone: string) => Promise<void>;
  onBack: () => void;
}) => {
  const { call, db } = useContext(FrappeContext) as FrappeConfig;

  const [timeZone, setTimeZone] = useState(savedTimeZone);
  const [days, setDays] = useState(() => initialDays(availability));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(notYours ? NOT_YOURS : null);

  // The same list the booking pages use: the browser's own time zone names.
  const zones = useMemo(() => {
    const names: string[] = getAllSupportedTimeZones();
    return (names.includes(timeZone) ? names : [timeZone, ...names]).map((name) => {
      const offset = gmtOffset(name);
      return { name, label: offset ? `${name} (${offset})` : name };
    });
  }, [timeZone]);

  const setDay = (i: number, change: Partial<DayHours>) =>
    setDays((current) => current.map((d, j) => (j === i ? { ...d, ...change } : d)));

  const copyMonday = () =>
    setDays((current) =>
      current.map((d, i) => (i > 0 && i < 5 ? { ...d, on: current[0].on, start: current[0].start, end: current[0].end } : d))
    );

  // "HH:MM" strings compare correctly as text.
  const badDays = days.filter((d) => d.on && !(d.start && d.end && d.end > d.start)).map((d) => d.day);
  const noDays = !days.some((d) => d.on);

  const slotsFor = (list: DayHours[]) =>
    list.filter((d) => d.on).map((d) => `${d.day} ${d.start} ${d.end}`).join("|");
  const changed = timeZone !== savedTimeZone || !availability || slotsFor(days) !== slotsFor(initialDays(availability));

  const save = async () => {
    // Nothing to write: just move on. (The server rejects any save while, say, a saved Zoom
    // choice is no longer set up, so an unchanged step shouldn't depend on it.)
    if (!changed) return onSaved(timeZone);
    setError(null);
    setSaving(true);
    try {
      if (timeZone !== savedTimeZone) {
        await call.post("frappe.client.set_value", { doctype: "User", name: user, fieldname: "time_zone", value: timeZone });
      }
      const slots = days
        .filter((d) => d.on)
        .map((d) => ({ day: d.day, start_time: toServerTime(d.start), end_time: toServerTime(d.end) }));
      if (availability) {
        // Every slot goes back as text: the server's check parses them with strptime.
        await db.updateDoc(AVAILABILITY, availability.name, { google_calendar: calendar, appointment_time_slot: slots });
      } else {
        await db.createDoc(AVAILABILITY, { user, google_calendar: calendar, appointment_time_slot: slots });
      }
      await onSaved(timeZone);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError(isNotYours(err) || (err as any)?.exc_type === "DuplicateEntryError" ? NOT_YOURS : errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader title="When can people book you?">
        People can only book inside these hours, never over something already on your calendar. Holidays and approved
        leave are blocked too.
      </StepHeader>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="time-zone" className="text-es-sm text-ink-gray-6">
          Time zone
        </label>
        <div className="relative w-80 max-w-full">
          <select
            id="time-zone"
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className="w-full h-7 pl-2 pr-7 appearance-none rounded-lg border border-transparent bg-surface-gray-2 text-es-base text-ink-gray-8 cursor-pointer hover:bg-surface-gray-3 focus:outline-none focus:border-outline-gray-4 focus:shadow-es-focus"
          >
            {zones.map((z) => (
              <option key={z.name} value={z.name}>
                {z.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
        </div>
        <span className="text-es-p-sm text-ink-gray-5">People booking you see times in their own time zone.</span>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between pb-2">
          <span className="text-es-base font-medium text-ink-gray-8">Weekly hours</span>
          <Button variant="ghost" onClick={copyMonday}>
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            Copy Monday to weekdays
          </Button>
        </div>
        <div className="border-t border-outline-gray-1">
          {days.map((d, i) => {
            const bad = badDays.includes(d.day);
            return (
              <div key={d.day} className="flex flex-wrap items-center gap-x-4 gap-y-1 min-h-12 py-2 border-b border-outline-gray-1">
                <span className="flex items-center gap-2.5 w-[150px]">
                  <Switch checked={d.on} onChange={(on) => setDay(i, { on })} label={d.day} />
                  <span className="text-es-base text-ink-gray-8">{d.day}</span>
                </span>
                {d.on ? (
                  <span className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${d.day} start time`}
                      value={d.start}
                      onChange={(e) => setDay(i, { start: e.target.value })}
                      aria-invalid={bad}
                      className={cn(timeInputClass, bad && "border-ink-red-7")}
                    />
                    <span className="text-es-sm text-ink-gray-5">to</span>
                    <input
                      type="time"
                      aria-label={`${d.day} end time`}
                      value={d.end}
                      onChange={(e) => setDay(i, { end: e.target.value })}
                      aria-invalid={bad}
                      className={cn(timeInputClass, bad && "border-ink-red-7")}
                    />
                  </span>
                ) : (
                  <span className="text-es-base text-ink-gray-5">Unavailable</span>
                )}
                {bad && (
                  <span role="alert" className="basis-full pl-[166px] max-sm:pl-0 text-es-p-sm text-ink-red-7">
                    The end time has to be after the start time.
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {noDays && <span className="pt-2 text-es-p-sm text-ink-gray-5">Turn on at least one day so people can book you.</span>}
      </div>

      {error && (
        <Notice tone="red" title="Couldn't save your hours">
          {error}
        </Notice>
      )}

      <div className="flex justify-between gap-2">
        <Button size="md" onClick={onBack}>
          Back
        </Button>
        <Button variant="solid" size="md" onClick={save} disabled={saving || notYours || badDays.length > 0 || noDays}>
          {saving && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Continue
        </Button>
      </div>
    </>
  );
};

export default HoursStep;
