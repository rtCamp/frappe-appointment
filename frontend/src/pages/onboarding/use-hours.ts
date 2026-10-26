/**
 * The time zone and weekly hours being edited, shared by the Working hours step and the
 * Availability page, and how they're saved: User.time_zone and the availability's time slots.
 */
import { useState } from "react";
import { FrappeConfig } from "frappe-react-sdk";

import { AVAILABILITY, Availability, DAYS, Day, toInputTime, toServerTime } from "./api";

export interface DayHours {
  day: Day;
  on: boolean;
  start: string;
  end: string;
}

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

const slotsFor = (list: DayHours[]) =>
  list
    .filter((d) => d.on)
    .map((d) => `${d.day} ${d.start} ${d.end}`)
    .join("|");

export const useHours = (availability: Availability | null, savedTimeZone: string) => {
  const [timeZone, setTimeZone] = useState(savedTimeZone);
  const [days, setDays] = useState(() => initialDays(availability));

  const setDay = (i: number, change: Partial<DayHours>) =>
    setDays((current) => current.map((d, j) => (j === i ? { ...d, ...change } : d)));

  const copyMonday = () =>
    setDays((current) =>
      current.map((d, i) => (i > 0 && i < 5 ? { ...d, on: current[0].on, start: current[0].start, end: current[0].end } : d))
    );

  // "HH:MM" strings compare correctly as text.
  const badDays = days.filter((d) => d.on && !(d.start && d.end && d.end > d.start)).map((d) => d.day);
  const noDays = !days.some((d) => d.on);
  const changed = timeZone !== savedTimeZone || !availability || slotsFor(days) !== slotsFor(initialDays(availability));

  /** Writes what changed. Every slot goes back as text: the server's check parses them with strptime. */
  const save = async ({ call, db }: Pick<FrappeConfig, "call" | "db">, user: string, calendar: string) => {
    const setUserTimeZone = (value: string) =>
      call.post("frappe.client.set_value", { doctype: "User", name: user, fieldname: "time_zone", value });
    const timeZoneChanged = timeZone !== savedTimeZone;
    if (timeZoneChanged) await setUserTimeZone(timeZone);
    const slots = days
      .filter((d) => d.on)
      .map((d) => ({ day: d.day, start_time: toServerTime(d.start), end_time: toServerTime(d.end) }));
    try {
      if (availability) {
        await db.updateDoc(AVAILABILITY, availability.name, { google_calendar: calendar, appointment_time_slot: slots });
      } else {
        await db.createDoc(AVAILABILITY, { user, google_calendar: calendar, appointment_time_slot: slots });
      }
    } catch (err) {
      // The hours are read in this time zone, so don't keep a new one without them.
      if (timeZoneChanged) await setUserTimeZone(savedTimeZone).catch(() => undefined);
      throw err;
    }
  };

  return { timeZone, setTimeZone, days, setDay, copyMonday, badDays, noDays, changed, save };
};

export type Hours = ReturnType<typeof useHours>;
