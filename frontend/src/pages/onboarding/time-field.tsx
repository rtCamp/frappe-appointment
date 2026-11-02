/**
 * A time field for working hours, as two dropdowns: the clock time ("9:00", typed or picked from a list in 15-minute
 * steps) and AM or PM. For an end time the list says how long the day is. Values are "HH:MM", as the hours editor
 * keeps them. Browsers that write times in 24 hours get the time alone, 00:00 to 23:45, with no AM/PM.
 */
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";

import { cn, lengthInWords } from "@/lib/utils";
import { fieldClass } from "./form-fields";

const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
/** The last minute of the day, for hours that run to midnight. */
const END_OF_DAY = "23:59";

/** Whether the browser writes times with AM and PM. */
const TWELVE_HOUR = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12 ?? true;

/** The clock part of a time: "9:30" (or "09:30" in 24 hours). */
const clockLabel = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return TWELVE_HOUR ? `${h % 12 || 12}:${pad(m)}` : `${pad(h)}:${pad(m)}`;
};
const isPm = (time: string) => toMinutes(time) >= 12 * 60;
/** The same clock time in the morning or the afternoon. */
const inPeriod = (time: string, pm: boolean) => {
  const [h, m] = time.split(":").map(Number);
  return `${pad((h % 12) + (pm ? 12 : 0))}:${pad(m)}`;
};

/** Text with case, spaces and dots dropped, to compare what's typed with the list. */
const squash = (text: string) => text.toLowerCase().replace(/[\s.]/g, "");

/**
 * "HH:MM" for what someone typed, or null when it isn't a time. An hour from 1 to 12 stays in the AM or PM already
 * picked, unless the typing says am or pm; 0 and 13 to 23 read as 24-hour times.
 */
const parseTime = (text: string, pm: boolean): string | null => {
  const t = text
    .toLowerCase()
    .replace(/([ap])\.?\s*m\.?/, "$1m")
    .replace(/\s+/g, "")
    .replace(".", ":");
  if (t === "noon") return "12:00";
  if (t === "midnight") return "00:00";
  const match = t.match(/^(\d{1,2})(?::?(\d{2}))?(a|p|am|pm)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (minutes > 59 || hours > 23) return null;
  if (match[3]) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (match[3].startsWith("p") ? 12 : 0);
  } else if (TWELVE_HOUR && hours >= 1 && hours <= 12) hours = (hours % 12) + (pm ? 12 : 0);
  return `${pad(hours)}:${pad(minutes)}`;
};

const listClass = "z-50 rounded-xl border border-outline-gray-1 bg-surface-elevation-2 p-1 shadow-es-2xl";
const optionClass = (active: boolean, selected: boolean) =>
  cn(
    "flex items-center justify-between gap-4 h-7 px-2 rounded-lg text-es-base tabular-nums whitespace-nowrap cursor-pointer",
    active && "bg-surface-gray-2",
    selected ? "text-ink-gray-9 font-medium" : "text-ink-gray-8"
  );

/** The clock time: typed, or picked from the quarter hours of the morning or afternoon already chosen. */
const ClockField = ({
  value,
  onChange,
  label,
  invalid,
  after,
}: {
  value: string;
  onChange: (time: string) => void;
  label: string;
  invalid?: boolean;
  after?: string;
}) => {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const focusedByClick = useRef(false);
  const [open, setOpen] = useState(false);
  // What's in the box while someone types; null shows the saved time.
  const [draft, setDraft] = useState<string | null>(null);
  const [active, setActive] = useState(value);
  const pm = isPm(value);

  // Every quarter hour in the morning or the afternoon (the whole day in 24 hours), plus the saved time when it's
  // between them, and the last minute of the day for an end time that runs to midnight.
  const options = useMemo(() => {
    const start = TWELVE_HOUR && pm ? 12 * 60 : 0;
    const count = TWELVE_HOUR ? 48 : 96;
    const list = Array.from({ length: count }, (_, i) => fromMinutes(start + i * 15));
    if (after && (!TWELVE_HOUR || pm)) list.push(END_OF_DAY);
    return list.includes(value) ? list : [...list, value].sort();
  }, [pm, after, value]);

  // Keeps the highlighted time in view as it moves.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-time="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    setActive(value);
    setOpen(true);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-time="${value}"]`)?.scrollIntoView({ block: "center" }));
  };

  const pick = (time: string) => {
    if (time !== value) onChange(time);
    setDraft(null);
    setOpen(false);
  };

  /** The first listed time that starts the way the text does: "6:3" is 6:30. A bare number is a whole hour, so "1" is 1:00, not 10:00. */
  const listMatch = (text: string) => {
    const typed = squash(text);
    if (!typed) return undefined;
    return options.find((t) => {
      const shown = squash(clockLabel(t));
      return shown.startsWith(typed) && !(/^\d+$/.test(typed) && /^\d/.test(shown.slice(typed.length)));
    });
  };

  // A typed time is kept if it reads as one; anything else puts the saved time back.
  const commit = () => {
    if (draft === null) return setOpen(false);
    pick(listMatch(draft) ?? parseTime(draft, pm) ?? value);
  };

  const type = (text: string) => {
    setDraft(text);
    if (!open) setOpen(true);
    const parsed = parseTime(text, pm);
    const match = listMatch(text) ?? (parsed && options.find((t) => t >= parsed));
    if (match) setActive(match);
  };

  const move = (step: number) => {
    if (!open) return show();
    const at = options.indexOf(active);
    const next = options[Math.min(options.length - 1, Math.max(0, (at === -1 ? options.indexOf(value) : at) + step))];
    if (next) {
      setActive(next);
      setDraft(clockLabel(next));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && draft === null) pick(active);
      else commit();
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setDraft(null);
      setOpen(false);
    }
  };

  const length = (time: string) => {
    const minutes = after ? toMinutes(time) - toMinutes(after) + (time === END_OF_DAY ? 1 : 0) : 0;
    return minutes > 0 ? lengthInWords(minutes) : null;
  };

  return (
    <Popover.Root open={open} onOpenChange={(next) => !next && commit()}>
      <Popover.Anchor asChild>
        <span ref={anchorRef} className="relative inline-flex">
          <input
            type="text"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open ? `${listId}-${active}` : undefined}
            aria-invalid={invalid}
            autoComplete="off"
            spellCheck={false}
            value={draft ?? clockLabel(value)}
            onChange={(e) => type(e.target.value)}
            // The whole time is selected on the way in, by click or Tab, so typing replaces it.
            onFocus={(e) => {
              e.target.select();
              focusedByClick.current = true;
            }}
            onMouseUp={(e) => {
              if (focusedByClick.current) e.preventDefault();
              focusedByClick.current = false;
            }}
            // Clicking back into a field that kept focus after a pick selects the time again.
            onClick={(e) => {
              if (open) return;
              e.currentTarget.select();
              show();
            }}
            onBlur={commit}
            onKeyDown={onKeyDown}
            className={cn(fieldClass, "w-[84px] pr-7 tabular-nums cursor-pointer focus:cursor-text", invalid && "border-ink-red-7")}
          />
          <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
        </span>
      </Popover.Anchor>
      {/* Not in a portal: the app's colors are set on its own root, which a portal would leave. */}
      <Popover.Content
        align="start"
        sideOffset={4}
        collisionPadding={8}
        // The field keeps focus, so typing and arrow keys go on working while the list is open.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        // Escape puts the saved time back rather than keeping the one arrowed to.
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          setDraft(null);
          setOpen(false);
        }}
        // Clicking the field itself leaves the list open.
        onInteractOutside={(e) => anchorRef.current?.contains(e.target as Node) && e.preventDefault()}
        className={cn(listClass, "min-w-[84px]")}
      >
        <div ref={listRef} id={listId} role="listbox" aria-label={label} className="max-h-60 overflow-y-auto">
          {options.map((time) => {
            const how = length(time);
            return (
              <div
                key={time}
                id={`${listId}-${time}`}
                data-time={time}
                role="option"
                aria-selected={time === value}
                onClick={() => pick(time)}
                onMouseMove={() => active !== time && setActive(time)}
                className={optionClass(time === active, time === value)}
              >
                {clockLabel(time)}
                {how && <span className="text-es-sm font-normal text-ink-gray-5">{how}</span>}
              </div>
            );
          })}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};

/** AM or PM, as its own dropdown. Typing A or P on it picks straight away. */
const PeriodSelect = ({ value, onChange, label }: { value: string; onChange: (time: string) => void; label: string }) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const pm = isPm(value);
  const [active, setActive] = useState(pm);

  const pick = (toPm: boolean) => {
    if (toPm !== pm) onChange(inPeriod(value, toPm));
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const key = e.key.toLowerCase();
    if (key === "a" || key === "p") {
      e.preventDefault();
      pick(key === "p");
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setActive(pm);
        setOpen(true);
      } else setActive(e.key === "ArrowDown");
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      pick(active);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setActive(pm);
        setOpen(next);
      }}
    >
      <Popover.Trigger
        type="button"
        role="combobox"
        aria-label={`${label}, AM or PM`}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active ? "pm" : "am"}` : undefined}
        onKeyDown={onKeyDown}
        className={cn(fieldClass, "relative w-[64px] pr-7 text-left cursor-pointer")}
      >
        {pm ? "PM" : "AM"}
        <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Content
        align="start"
        sideOffset={4}
        collisionPadding={8}
        // Focus stays on the button, so A, P and the arrow keys keep working.
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(listClass, "min-w-[64px]")}
      >
        <div id={listId} role="listbox" aria-label={`${label}, AM or PM`}>
          {[false, true].map((option) => (
            <div
              key={String(option)}
              id={`${listId}-${option ? "pm" : "am"}`}
              role="option"
              aria-selected={option === pm}
              onClick={() => pick(option)}
              onMouseMove={() => setActive(option)}
              className={optionClass(option === active, option === pm)}
            >
              {option ? "PM" : "AM"}
            </div>
          ))}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};

const TimeField = ({
  value,
  onChange,
  label,
  invalid,
  after,
}: {
  value: string;
  onChange: (time: string) => void;
  /** Read out by screen readers, e.g. "Monday start time". */
  label: string;
  invalid?: boolean;
  /** For an end time: the start time, so the list can say how long the day is. */
  after?: string;
}) => (
  <span className="inline-flex items-center gap-1">
    <ClockField value={value} onChange={onChange} label={label} invalid={invalid} after={after} />
    {TWELVE_HOUR && <PeriodSelect value={value} onChange={onChange} label={label} />}
  </span>
);

export default TimeField;
