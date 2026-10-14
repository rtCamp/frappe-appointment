/**
 * Working hours section: weekly Appointment Time Slot rows and the user's time zone.
 * Creates the User Appointment Availability record if it doesn't exist yet.
 */
import { useState } from "react";
import { Copy, LoaderCircle } from "lucide-react";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Switch } from "@/components/switch";
import { cn, getAllSupportedTimeZones } from "@/lib/utils";
import TimeZoneSelect from "@/pages/appointment/components/timeZoneSelectmenu";
import { AvailabilityDoc, DAYS, Day, OnboardingApi, TimeSlotRow, errorText } from "../api";
import { Box, Notice, Section, blueButton, blueFocus, blueGhostButton, blueSwitch, toastSaved } from "../ui";

type DayState = { on: boolean; start: string; end: string; rowName?: string };

/** "9:00:00" / "09:00:00.000000" -> "09:00" */
const toHHMM = (value: string | null | undefined): string => {
  if (!value) return "";
  const [h = "0", m = "0"] = String(value).split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0").slice(0, 2)}`;
};

const initialDays = (availability: AvailabilityDoc | null): Record<Day, DayState> => {
  const rows = availability?.appointment_time_slot ?? [];
  const days = {} as Record<Day, DayState>;
  DAYS.forEach((day, i) => {
    const row = rows.find((r) => r.day === day);
    days[day] = row
      ? { on: true, start: toHHMM(row.start_time), end: toHHMM(row.end_time), rowName: row.name }
      : // New users start with Mon–Fri, 9 to 5.
        { on: !availability && i < 5, start: "09:00", end: "17:00" };
  });
  return days;
};

const HoursStep = ({
  api,
  user,
  calendar,
  timeZone,
  availability,
  onSaved,
}: {
  api: OnboardingApi;
  user: string;
  calendar: string;
  timeZone: string;
  availability: AvailabilityDoc | null;
  onSaved: (doc: AvailabilityDoc, timeZone: string) => void;
}) => {
  const [days, setDays] = useState<Record<Day, DayState>>(() => initialDays(availability));
  const [tz, setTz] = useState(timeZone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (day: Day, patch: Partial<DayState>) =>
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const copyToWeekdays = (from: Day) =>
    setDays((prev) => {
      const next = { ...prev };
      DAYS.slice(0, 5).forEach((d) => {
        next[d] = { ...next[d], on: true, start: prev[from].start, end: prev[from].end };
      });
      return next;
    });

  const isInvalid = (d: DayState) => d.on && (!d.start || !d.end || d.start >= d.end);
  const problems = DAYS.filter((d) => isInvalid(days[d]));
  const firstOn = DAYS.find((d) => days[d].on);

  const save = async () => {
    setError(null);
    if (!firstOn) return setError("Turn on at least one day.");
    if (problems.length)
      return setError(`Check the hours for ${problems.join(", ")}. The end time must be after the start time.`);
    setSaving(true);
    try {
      if (tz && tz !== timeZone) {
        await api.setTimeZone(user, tz);
      }
      const slots: TimeSlotRow[] = DAYS.filter((d) => days[d].on).map((d) => ({
        ...(days[d].rowName ? { name: days[d].rowName } : {}),
        day: d,
        start_time: `${days[d].start}:00`,
        end_time: `${days[d].end}:00`,
      }));
      const doc = availability
        ? await api.updateAvailability(availability.name, { google_calendar: calendar, appointment_time_slot: slots })
        : await api.createAvailability({ user, google_calendar: calendar, enable_scheduling: 0, appointment_time_slot: slots });
      toastSaved("Working hours saved");
      onSaved(doc, tz);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Working hours"
      description="People can only book you inside these hours, and never over something already on your calendar. Approved leave and holidays are blocked too."
    >
      <Box className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>Your time zone</Label>
          <div className="w-fit rounded-md border border-blue-100 dark:border-zinc-800">
            <TimeZoneSelect timeZones={getAllSupportedTimeZones()} timeZone={tz} setTimeZone={setTz} disable={saving} />
          </div>
          <p className="text-sm text-muted-foreground">
            Your hours are in this time zone. People booking you see times in their own.
          </p>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-2">
            <Label>Weekly hours</Label>
            {firstOn && (
              <Button size="sm" variant="ghost" className={blueGhostButton} onClick={() => copyToWeekdays(firstOn)}>
                <Copy /> Copy {firstOn} to weekdays
              </Button>
            )}
          </div>
          <div className="divide-y divide-blue-50 dark:divide-zinc-800">
            {DAYS.map((day) => {
              const d = days[day];
              const invalid = isInvalid(d);
              return (
                <div key={day} className="grid grid-cols-1 sm:grid-cols-[150px,1fr] items-center gap-2 sm:gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      id={`day-${day}`}
                      checked={d.on}
                      onCheckedChange={(on) => update(day, { on })}
                      className={blueSwitch}
                    />
                    <Label htmlFor={`day-${day}`} className="cursor-pointer">
                      {day}
                    </Label>
                  </div>
                  {d.on ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        step={900}
                        value={d.start}
                        aria-label={`${day} start time`}
                        aria-invalid={invalid}
                        onChange={(e) => update(day, { start: e.target.value })}
                        className={cn("sm:w-36 tabular-nums", blueFocus, invalid && "border-red-400")}
                      />
                      <span className="text-sm text-muted-foreground">to</span>
                      <Input
                        type="time"
                        step={900}
                        value={d.end}
                        aria-label={`${day} end time`}
                        aria-invalid={invalid}
                        onChange={(e) => update(day, { end: e.target.value })}
                        className={cn("sm:w-36 tabular-nums", blueFocus, invalid && "border-red-400")}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unavailable</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && <Notice tone="red" title="Couldn't save your hours">{error}</Notice>}

        <div className="flex justify-end">
          <Button className={blueButton} onClick={save} disabled={saving}>
            {saving && <LoaderCircle className="animate-spin" />} Save hours
          </Button>
        </div>
      </Box>
    </Section>
  );
};

export default HoursStep;
