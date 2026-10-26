/**
 * Espresso building blocks for the /schedule screens.
 */
import { ButtonHTMLAttributes, Fragment, ReactNode, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, CircleAlert, CircleCheck, Copy, ExternalLink, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonClass, buttonVariants } from "./styles";
import { useCopied } from "./use-copied";

export const Button = ({
  variant,
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: "sm" | "md" | "lg";
}) => <button type="button" className={cn(buttonClass(variant, size), className)} {...props} />;

export const Switch = ({
  checked,
  onChange,
  label,
  disabled,
  size = "sm",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** "md" is the larger switch Home uses in its header. */
  size?: "sm" | "md";
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative shrink-0 rounded-full border-2 border-transparent p-0 box-border cursor-pointer",
      size === "md" ? "w-8 h-5" : "w-[26px] h-4",
      "focus-visible:outline-none focus-visible:shadow-es-focus disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-surface-gray-10" : "bg-surface-gray-4"
    )}
  >
    <span
      className={cn(
        "block rounded-full bg-surface-base shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform",
        size === "md" ? "w-4 h-4" : "w-3 h-3",
        checked && (size === "md" ? "translate-x-3" : "translate-x-2.5")
      )}
    />
  </button>
);

const noticeTones = {
  blue: { box: "bg-surface-gray-1", icon: <Info className="w-4 h-4 shrink-0 mt-px text-ink-blue-5" aria-hidden="true" /> },
  green: { box: "bg-surface-gray-1", icon: <CircleCheck className="w-4 h-4 shrink-0 mt-px text-ink-green-7" aria-hidden="true" /> },
  amber: { box: "bg-surface-gray-1", icon: <TriangleAlert className="w-4 h-4 shrink-0 mt-px text-ink-amber-7" aria-hidden="true" /> },
  red: { box: "bg-surface-red-2", icon: <CircleAlert className="w-4 h-4 shrink-0 mt-px text-ink-red-7" aria-hidden="true" /> },
};

export const Notice = ({
  tone = "blue",
  icon,
  title,
  children,
  actions,
}: {
  tone?: keyof typeof noticeTones;
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) => (
  <div role={tone === "red" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-xl px-3.5 py-3", noticeTones[tone].box)}>
    {icon ?? noticeTones[tone].icon}
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-es-base font-medium text-ink-gray-8">{title}</span>
      {children && <span className="text-es-p-sm text-ink-gray-7">{children}</span>}
      {actions && <div className="flex flex-wrap gap-2 mt-1.5">{actions}</div>}
    </div>
  </div>
);

const pillTones = {
  gray: "bg-surface-gray-2 text-ink-gray-6",
  green: "bg-surface-green-2 text-ink-green-7",
  amber: "bg-surface-amber-2 text-ink-amber-7",
};

export const Pill = ({ tone = "gray", children }: { tone?: keyof typeof pillTones; children: ReactNode }) => (
  <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-es-xs whitespace-nowrap", pillTones[tone])}>
    {children}
  </span>
);

export const StepHeader = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <h2 className="m-0 text-es-title text-ink-gray-9">{title}</h2>
    <p className="m-0 text-es-p-base text-ink-gray-6">{children}</p>
  </div>
);

/** Numbered steps joined by lines; finished steps get a filled check. */
export const Stepper = ({ steps, current, done }: { steps: string[]; current: number; done: boolean[] }) => (
  <ol aria-label="Setup steps" className="list-none m-0 p-0 flex items-center gap-3">
    {steps.map((label, i) => {
      const active = i === current;
      const finished = done[i] && !active;
      return (
        <Fragment key={label}>
          {i > 0 && (
            <li aria-hidden="true" className={cn("flex-1 h-px", done[i - 1] ? "bg-outline-gray-4" : "bg-outline-gray-2")} />
          )}
          <li
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2",
              active ? "text-es-sm font-medium text-ink-gray-9" : "text-es-sm",
              !active && (finished ? "text-ink-gray-6" : "text-ink-gray-5")
            )}
          >
            {finished ? (
              <span className="w-5 h-5 rounded-full grid place-items-center bg-surface-gray-10 text-ink-base">
                <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
              </span>
            ) : (
              <span
                className={cn(
                  "w-5 h-5 rounded-full grid place-items-center box-border border-[1.5px] text-es-xs",
                  active ? "border-ink-gray-9 font-medium" : "border-outline-gray-3"
                )}
              >
                {i + 1}
              </span>
            )}
            <span className={cn(!active && "max-sm:hidden")}>{label}</span>
          </li>
        </Fragment>
      );
    })}
  </ol>
);

/** A setting: what it is on the left, its control on the right. */
export const SettingRow = ({ title, description, children, last }: { title: ReactNode; description?: string; children?: ReactNode; last?: boolean }) => (
  <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4", !last && "border-b border-outline-gray-1")}>
    <span className="flex flex-col gap-1 flex-[1_1_200px] min-w-0">
      <span className="text-es-base font-medium text-ink-gray-8">{title}</span>
      {description && <span className="text-es-p-sm text-ink-gray-6">{description}</span>}
    </span>
    {children}
  </div>
);

/** Labels a dialog: put it on the dialog's heading. */
export const DialogTitle = DialogPrimitive.Title;

/** The first field a dialog's form starts on, skipping anything disabled. */
const firstField = (content: HTMLElement) =>
  content.querySelector<HTMLElement>(
    "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable=true]"
  );

/**
 * The frame every dialog sits in. Radix keeps focus inside it, hides the page behind it from screen readers, lets
 * Escape close only the top dialog, and puts focus back where it was once it closes. It stays where it's rendered
 * rather than moving to a portal, so it keeps the page's theme.
 */
export const DialogFrame = ({
  onClose,
  closeOnClickOutside,
  alert,
  initialFocus,
  overlayClassName,
  className,
  children,
}: {
  onClose: () => void;
  /** Off for forms, so nothing typed is lost by a stray click. */
  closeOnClickOutside?: boolean;
  /** Asks to confirm something, so screen readers announce it straight away. */
  alert?: boolean;
  /** Where focus starts; the first thing you can tab to otherwise. */
  initialFocus?: (content: HTMLElement) => HTMLElement | null | undefined;
  overlayClassName?: string;
  className?: string;
  children: ReactNode;
}) => {
  // Radix only gives focus back to a Dialog.Trigger, and these open from ordinary buttons, so remember what had focus.
  const returnFocusTo = useRef(document.activeElement as HTMLElement | null);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Overlay
        className={cn("fixed inset-0 z-40 flex items-center justify-center p-6 max-sm:p-0 bg-black/30", overlayClassName)}
      >
        <DialogPrimitive.Content
          {...(alert ? { role: "alertdialog" } : {})}
          aria-describedby={undefined}
          onPointerDownOutside={(e) => !closeOnClickOutside && e.preventDefault()}
          onOpenAutoFocus={(e) => {
            const target = initialFocus?.(e.currentTarget as HTMLElement);
            if (!target) return;
            e.preventDefault();
            target.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusTo.current?.focus();
          }}
          className={cn("outline-none", className)}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Root>
  );
};

/** A small modal asking to confirm something destructive. Escape or the backdrop cancels. */
export const ConfirmDialog = ({
  title,
  children,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogFrame
      onClose={onCancel}
      closeOnClickOutside
      alert
      initialFocus={() => cancelRef.current}
      overlayClassName="z-50 p-4 max-sm:p-4"
      className="w-[400px] max-w-full flex flex-col gap-4 p-5 rounded-xl bg-surface-elevation-2 shadow-es-2xl"
    >
      <div className="flex flex-col gap-2">
        <DialogTitle className="m-0 text-es-lg font-semibold text-ink-gray-9">{title}</DialogTitle>
        <div className="text-es-p-base text-ink-gray-6">{children}</div>
      </div>
      {error && (
        <p role="alert" className="m-0 text-es-p-sm text-ink-red-7">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button ref={cancelRef} type="button" onClick={onCancel} className={buttonClass("subtle")}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn(buttonClass("subtle"), "bg-surface-red-2 text-ink-red-7 hover:bg-surface-red-3")}
        >
          {confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
};

/**
 * A form in a dialog over the page. Escape and the close button close it; a click outside doesn't, so
 * nothing typed is lost by accident. On a phone it fills the screen.
 */
export const Modal = ({
  title,
  aside,
  footer,
  className,
  onClose,
  children,
}: {
  title: ReactNode;
  /** Shown before the close button, like "Step 1 of 3". */
  aside?: ReactNode;
  footer: ReactNode;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) => (
  <DialogFrame
    onClose={onClose}
    initialFocus={firstField}
    // "espresso" brings the colour tokens, for a dialog rendered outside the page's frame.
    className={cn(
      "espresso font-espresso w-[560px] max-w-full max-h-full max-sm:h-full flex flex-col overflow-hidden rounded-2xl max-sm:rounded-none bg-surface-elevation-1 text-ink-gray-8 shadow-es-2xl",
      className
    )}
  >
    <div className="min-h-[52px] flex items-center justify-between gap-2 pl-5 pr-3 border-b border-outline-gray-1">
      <DialogTitle className="m-0 min-w-0 truncate text-es-lg font-semibold text-ink-gray-9">{title}</DialogTitle>
      <span className="shrink-0 flex items-center gap-2">
        {aside}
        <Button variant="ghost" className="w-7 px-0" aria-label="Close" onClick={onClose}>
          <X className="w-4 h-4" aria-hidden="true" />
        </Button>
      </span>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-7">{children}</div>
    <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-outline-gray-1">{footer}</div>
  </DialogFrame>
);

/** A value to paste somewhere else (a scope, a redirect URI), with a Copy button. */
export const CopyValue = ({ value, wrap, boxed }: { value: string; wrap?: boolean; boxed?: boolean }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div
      className={cn(
        "flex gap-2 py-1 pr-1 pl-2.5 rounded-[10px]",
        wrap ? "items-start py-1.5" : "items-center",
        boxed ? "border border-outline-gray-2 bg-surface-base" : "bg-surface-gray-1"
      )}
    >
      <code
        className={cn(
          "flex-1 min-w-0 font-mono text-es-sm text-ink-gray-8",
          wrap ? "break-all" : "truncate"
        )}
        title={value}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2 rounded-lg border border-outline-gray-2 bg-surface-base text-es-base text-ink-gray-8 shadow-es-sm cursor-pointer hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:shadow-es-focus"
      >
        {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
};

/** A booking link with Open and Copy link, as on Home and a group's page. */
export const LinkBar = ({ link, dimmed }: { link: string; dimmed?: boolean }) => {
  const { copied, copy } = useCopied();
  return (
    <div className={cn("flex items-center gap-2 py-1.5 pr-1.5 pl-3 rounded-xl bg-surface-gray-1", dimmed && "opacity-[0.55]")}>
      <span className="flex-1 min-w-0 truncate text-es-base text-ink-gray-8" title={link}>
        {link.replace(/^https?:\/\//, "")}
      </span>
      <a href={link} target="_blank" rel="noreferrer" className={buttonClass("ghost")}>
        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        Open
      </a>
      <button
        type="button"
        onClick={() => copy("link", link)}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg border border-outline-gray-2 bg-surface-base text-es-base text-ink-gray-8 shadow-es-sm cursor-pointer hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:shadow-es-focus"
      >
        {copied === "link" ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
        <span aria-live="polite">{copied === "link" ? "Copied" : "Copy link"}</span>
      </button>
    </div>
  );
};
