/**
 * Form fields for the settings screens: a labelled field, a length picker in seconds, and a number box.
 */
import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { durationLabel } from "./api";

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
  hint?: string;
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

export const SecondsSelect = ({
  id,
  value,
  choices,
  none,
  onChange,
  className,
}: {
  id: string;
  value: number;
  choices: number[];
  /** Label for 0. */
  none?: string;
  onChange: (value: number) => void;
  className?: string;
}) => (
  <span className={cn("relative", className)}>
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(fieldClass, "w-full pr-7 appearance-none tabular-nums cursor-pointer")}
    >
      {(choices.includes(value) ? choices : [...choices, value].sort((a, b) => a - b)).map((s) => (
        <option key={s} value={s}>
          {s === 0 && none ? none : durationLabel(s)}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
  </span>
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
    onChange={(e) => onChange(e.target.value)}
    className={cn(fieldClass, "tabular-nums", error && "border-ink-red-7")}
  />
);
