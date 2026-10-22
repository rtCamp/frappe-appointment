/**
 * The time zone picker and the weekly hours (one range per weekday), for the Working hours step
 * and the Availability page.
 */
import { useMemo } from "react";
import { ChevronDown, Copy } from "lucide-react";

import { cn, getAllSupportedTimeZones } from "@/lib/utils";
import { Button, Switch } from "./ui";
import { Hours } from "./use-hours";

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

const HoursEditor = ({
  hours,
  timeZoneHint,
  heading,
  footnote,
}: {
  hours: Hours;
  timeZoneHint: string;
  /** "Weekly hours" as a plain label (in a step) or a section heading (on a page). */
  heading: "label" | "h2";
  footnote?: string;
}) => {
  const { timeZone, setTimeZone, days, setDay, copyMonday, badDays, noDays } = hours;

  // The same list the booking pages use: the browser's own time zone names.
  const zones = useMemo(() => {
    const names: string[] = getAllSupportedTimeZones();
    return (names.includes(timeZone) ? names : [timeZone, ...names]).map((name) => {
      const offset = gmtOffset(name);
      return { name, label: offset ? `${name} (${offset})` : name };
    });
  }, [timeZone]);

  return (
    <>
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
        <span className="text-es-p-sm text-ink-gray-5">{timeZoneHint}</span>
      </div>

      <section className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          {heading === "h2" ? (
            <h2 className="m-0 text-es-lg font-semibold text-ink-gray-8">Weekly hours</h2>
          ) : (
            <span className="text-es-base font-medium text-ink-gray-8">Weekly hours</span>
          )}
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
        {footnote && <p className="m-0 pt-3 text-es-p-sm text-ink-gray-5">{footnote}</p>}
      </section>
    </>
  );
};

export default HoursEditor;
