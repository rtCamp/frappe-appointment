/**
 * "Use a different calendar in this Google account": the Calendar ID bookings go to and busy times come from.
 */
import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const OtherCalendar = ({
  user,
  value,
  onChange,
  open,
  onToggle,
  action,
}: {
  user: string;
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
  /** Shown under the field, like Settings' Save button. */
  action?: ReactNode;
}) => (
  <>
    <button
      type="button"
      aria-expanded={open}
      aria-controls="calendar-other"
      onClick={onToggle}
      className="self-start inline-flex items-center gap-1.5 min-h-7 px-2 -ml-2 text-left rounded-lg border-0 bg-transparent text-es-base text-ink-gray-7 cursor-pointer hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:shadow-es-focus"
    >
      <ChevronRight className={cn("w-4 h-4 transition-transform", open && "rotate-90")} aria-hidden="true" />
      Use a different calendar in this Google account
    </button>
    {open && (
      <div id="calendar-other" className="flex flex-col gap-1.5">
        <label htmlFor="calendar-id" className="text-es-sm text-ink-gray-6">
          Calendar ID
        </label>
        <input
          id="calendar-id"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
    {open && action}
  </>
);

export default OtherCalendar;
