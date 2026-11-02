/**
 * Form fields for the settings screens: a labelled field, a length picker in seconds (with Custom…), and a
 * number box.
 */
import { ReactNode } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";

import { cn, lengthInWords } from "@/lib/utils";
import { durationLabel } from "./api";
import { LENGTHS, Length, RuleDate, WHOLE_NUMBER, digitsOnly, savedLength } from "./booking-rules";

export const fieldClass =
  "h-7 px-2 rounded-lg border border-transparent bg-surface-gray-2 text-es-base text-ink-gray-8 placeholder:text-ink-gray-4 hover:bg-surface-gray-3 focus:outline-none focus:bg-surface-base focus:border-outline-gray-4 focus:shadow-es-focus";

export const Field = ({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
    <label htmlFor={id} className="text-es-sm text-ink-gray-6">
      {label}
    </label>
    {children}
    {error ? (
      <span role="alert" className="text-es-p-sm text-ink-red-7">
        {error}
      </span>
    ) : (
      hint && <span className="text-es-p-sm text-ink-gray-5">{hint}</span>
    )}
  </div>
);

/** The real date under a booking rule, like "Until Wed, Jan 13, 2027, including that day." */
export const DateHint = ({ note }: { note: RuleDate }) => (
  <span className="tabular-nums">
    {note.lead} {note.date && <span className="text-ink-gray-8">{note.date}</span>}
    {note.tail}
  </span>
);

export const SecondsSelect = ({
  id,
  value,
  choices,
  none,
  custom,
  onChange,
  className,
  label,
}: {
  id: string;
  value: number;
  choices: number[];
  /** Label for 0. */
  none?: string;
  /** Adds a "Custom…" choice at the end; open while the caller shows its own minutes field. */
  custom?: { open: boolean; onOpen: () => void };
  onChange: (value: number) => void;
  className?: string;
  /** For a select without a visible label. */
  label?: string;
}) => (
  <span className={cn("relative", className)}>
    <select
      id={id}
      aria-label={label}
      value={custom?.open ? "custom" : value}
      onChange={(e) => (e.target.value === "custom" ? custom?.onOpen() : onChange(Number(e.target.value)))}
      className={cn(fieldClass, "w-full pr-7 appearance-none tabular-nums cursor-pointer")}
    >
      {(choices.includes(value) ? choices : [...choices, value].sort((a, b) => a - b)).map((s) => (
        <option key={s} value={s}>
          {s === 0 && none ? none : durationLabel(s)}
        </option>
      ))}
      {custom && <option value="custom">Custom…</option>}
    </select>
    <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
  </span>
);

/** The length select, with Custom… at the end. */
export const LengthSelect = ({
  id,
  value,
  onChange,
  className,
  label,
}: {
  id: string;
  value: Length;
  onChange: (length: Length) => void;
  className?: string;
  label?: string;
}) => (
  <SecondsSelect
    id={id}
    value={value.seconds}
    choices={LENGTHS}
    custom={{ open: value.custom, onOpen: () => onChange({ ...value, custom: true, customMinutes: String(Math.round(value.seconds / 60)) }) }}
    onChange={(seconds) => onChange(savedLength(seconds))}
    className={className}
    label={label}
  />
);

/** The minutes box under a length select while Custom… is picked, with the length in words beside it. */
export const CustomLength = ({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: Length;
  onChange: (length: Length) => void;
  error?: string;
}) => {
  if (!value.custom) return null;
  const minutes = value.customMinutes.trim();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-es-base text-ink-gray-7">
          Custom length:
        </label>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value.customMinutes}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange({ ...value, customMinutes: digitsOnly(e.target.value) })}
          className={cn(fieldClass, "w-16 text-right tabular-nums", error && "border-ink-red-7")}
        />
        <span className="text-es-base text-ink-gray-7">minutes</span>
        {WHOLE_NUMBER.test(minutes) && Number(minutes) > 0 && (
          <span className="inline-flex items-center gap-2 text-es-base text-ink-gray-5 tabular-nums">
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            {lengthInWords(Number(minutes))}
          </span>
        )}
      </div>
      {error && (
        <span id={`${id}-error`} role="alert" className="text-es-p-sm text-ink-red-7">
          {error}
        </span>
      )}
    </div>
  );
};

/** A labelled length field: the select, and the minutes box once Custom… is picked. */
export const LengthField = ({
  id,
  value,
  onChange,
  error,
  className,
}: {
  id: string;
  value: Length;
  onChange: (length: Length) => void;
  error?: string;
  className?: string;
}) => (
  <div className="flex flex-col gap-1.5 min-w-0">
    <Field id={id} label="Length">
      <LengthSelect id={id} value={value} onChange={onChange} className={className} />
    </Field>
    <CustomLength id={`${id}-custom`} value={value} onChange={onChange} error={error} />
  </div>
);

export const NumberInput = ({
  id,
  value,
  placeholder,
  error,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  error?: string;
  onChange: (value: string) => void;
}) => (
  <input
    id={id}
    type="text"
    inputMode="numeric"
    value={value}
    placeholder={placeholder}
    aria-invalid={!!error}
    onChange={(e) => onChange(digitsOnly(e.target.value))}
    className={cn(fieldClass, "tabular-nums", error && "border-ink-red-7")}
  />
);
