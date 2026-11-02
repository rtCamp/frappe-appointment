/**
 * Booking rule choices shared by meeting types and group meetings.
 */

/** Choices in seconds, like the Duration fields store them. */
export const LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120].map((m) => m * 60);
export const BREAKS = [0, 5, 10, 15, 20, 30, 45, 60].map((m) => m * 60);

export const WHOLE_NUMBER = /^\d+$/;

export const daysLabel = (n: number) => (n === 1 ? "1 day" : `${n} days`);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86400000;

/** The server counts days from today's UTC date (appointment_group.py), so these do too. */
const serverToday = () => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};

/** "Sat, Oct 31", with the year only when it isn't this year. */
const dayLabel = (time: number, today: number) => {
  const d = new Date(time);
  const year = d.getUTCFullYear() !== new Date(today).getUTCFullYear() ? `, ${d.getUTCFullYear()}` : "";
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${year}`;
};

const days = (value: string) => {
  const text = value.trim();
  if (!text) return 0;
  return WHOLE_NUMBER.test(text) ? Number(text) : null;
};

/** A date under a booking rule: lead text, the date itself, then any text after it. */
export interface RuleDate {
  lead: string;
  date: string;
  tail: string;
}

/** The first bookable day for an Earliest booking value, or null while the value isn't a number. */
export const firstDayNote = (notice: string): RuleDate | null => {
  const n = days(notice);
  if (n === null) return null;
  const today = serverToday();
  return { lead: n === 0 ? "Starting today," : "First day", date: dayLabel(today + n * DAY, today), tail: "" };
};

/**
 * The last bookable day for a Book up to value, counted from the earliest day, which is day 1
 * (start + window - 1, as the server does). Null while either value isn't a number.
 */
export const lastDayNote = (notice: string, window: string): RuleDate | null => {
  const n = days(notice);
  const w = days(window);
  if (n === null || w === null) return null;
  if (w === 0) return { lead: "No end date.", date: "", tail: "" };
  const today = serverToday();
  const last = today + (n + w - 1) * DAY;
  if (w === 1) return { lead: "Only", date: dayLabel(last, today), tail: "" };
  return { lead: "Until", date: dayLabel(last, today), tail: ", including that day." };
};
