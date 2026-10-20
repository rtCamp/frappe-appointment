/**
 * Espresso building blocks for the admin setup page (styles in ./espresso.css).
 */
import { Fragment, ReactNode, useState } from "react";
import { Check, CircleAlert, CircleCheck, Copy, ExternalLink, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { copyText } from "./utils";

export const Switch = ({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className="switch"
    onClick={() => onChange(!checked)}
  />
);

const NOTICE_ICONS = {
  blue: Info,
  green: CircleCheck,
  amber: TriangleAlert,
  red: CircleAlert,
};

export const Notice = ({
  tone = "blue",
  title,
  children,
  actions,
}: {
  tone?: keyof typeof NOTICE_ICONS;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) => {
  const Icon = NOTICE_ICONS[tone];
  return (
    <div className={cn("notice", `notice-${tone}`)} role={tone === "red" ? "alert" : "status"}>
      <Icon aria-hidden="true" />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {title && <span className="t-base-medium" style={{ color: "var(--ink-gray-8)" }}>{title}</span>}
        {children && <div className="t-p-sm" style={{ color: "var(--ink-gray-7)" }}>{children}</div>}
        {actions && <div className="flex flex-wrap gap-2 mt-1.5">{actions}</div>}
      </div>
    </div>
  );
};

export const CopyButton = ({ text, label = "Copy" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-outline"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
};

/** A value to copy elsewhere: a link, a redirect URI, a scope list. */
export const LinkBox = ({ value, open, label }: { value: string; open?: boolean; label?: string }) => (
  <div className="flex flex-col gap-1.5 min-w-0">
    {label && <span className="field-label">{label}</span>}
    <div className="linkbox">
      <span className="t-sm flex-1 min-w-0 truncate" style={{ color: "var(--ink-gray-7)" }} title={value}>
        {value}
      </span>
      {open && (
        <a href={value} target="_blank" rel="noreferrer" aria-label="Open" className="btn btn-ghost btn-icon">
          <ExternalLink aria-hidden="true" />
        </a>
      )}
      <CopyButton text={value} />
    </div>
  </div>
);

export const Field = ({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("field", className)}>
    {label && <label htmlFor={htmlFor}>{label}</label>}
    {children}
    {error ? (
      <p className="field-error" role="alert">
        {error}
      </p>
    ) : (
      hint && <p className="field-hint">{hint}</p>
    )}
  </div>
);

export const ExtLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
    {children}
    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
  </a>
);

export const StepHeader = ({ title, children }: { title: ReactNode; children?: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <h2 className="t-title">{title}</h2>
    {children && (
      <p className="t-p-base m-0" style={{ color: "var(--ink-gray-6)" }}>
        {children}
      </p>
    )}
  </div>
);

export const Stepper = ({
  steps,
  current,
  done,
}: {
  steps: string[];
  current: number;
  done: boolean[];
}) => (
  <ol aria-label="Setup steps" className="list-none m-0 p-0 flex items-center gap-3">
    {steps.map((label, i) => {
      const active = i === current;
      return (
        <Fragment key={label}>
          {i > 0 && (
            <li
              aria-hidden="true"
              className="flex-1 h-px min-w-3"
              style={{ background: done[i - 1] ? "var(--outline-gray-4)" : "var(--outline-gray-2)" }}
            />
          )}
          <li
            aria-current={active ? "step" : undefined}
            className={cn("flex items-center gap-2", active ? "t-sm-medium" : "t-sm")}
            style={{ color: active ? "var(--ink-gray-9)" : done[i] ? "var(--ink-gray-6)" : "var(--ink-gray-5)" }}
          >
            {done[i] && !active ? (
              <span
                className="w-5 h-5 rounded-full grid place-items-center shrink-0"
                style={{ background: "var(--surface-gray-10)", color: "var(--ink-base)" }}
              >
                <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
              </span>
            ) : (
              <span
                className={cn("w-5 h-5 rounded-full grid place-items-center shrink-0 box-border", active ? "t-xs-medium" : "t-xs")}
                style={{ border: `1.5px solid ${active ? "var(--ink-gray-9)" : "var(--outline-gray-3)"}` }}
              >
                {i + 1}
              </span>
            )}
            <span className={cn(!active && "max-md:hidden")}>{label}</span>
          </li>
        </Fragment>
      );
    })}
  </ol>
);
