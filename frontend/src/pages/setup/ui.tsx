/**
 * Shared bits for the setup page, built on the app's existing components and blue theme.
 */
import { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/label";
import { cn } from "@/lib/utils";

/** Same blue treatment the booking pages use. */
export const blueButton =
  "bg-blue-500 hover:bg-blue-600 dark:bg-blue-400 dark:hover:bg-blue-500 text-white focus-visible:ring-blue-400";
export const blueOutlineButton =
  "border-blue-400 bg-transparent text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-800/10 dark:hover:text-blue-400 focus-visible:ring-blue-400";
export const blueGhostButton =
  "text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400 dark:hover:bg-blue-800/20 dark:hover:text-blue-400 focus-visible:ring-blue-400";
export const blueSwitch =
  "data-[state=checked]:bg-blue-500 dark:data-[state=checked]:bg-blue-400 focus-visible:ring-blue-400";
export const blueFocus = "focus-visible:ring-blue-400 focus:ring-blue-400";
export const panel = "rounded-lg bg-gray-50 dark:bg-zinc-800";

export const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-6">
    <div className="flex flex-col gap-1.5 pr-24 md:pr-28">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm md:text-base text-muted-foreground">{description}</p>}
    </div>
    {children}
  </section>
);

export const Box = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("rounded-2xl border border-blue-100 dark:border-zinc-800 bg-card p-4 md:p-6", className)}>
    {children}
  </div>
);

export const Field = ({
  label,
  htmlFor,
  description,
  error,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-2 min-w-0", className)}>
    {label && <Label htmlFor={htmlFor}>{label}</Label>}
    {children}
    {error ? (
      <p className="text-sm text-red-500" role="alert">
        {error}
      </p>
    ) : (
      description && <p className="text-sm text-muted-foreground">{description}</p>
    )}
  </div>
);

type Tone = "blue" | "green" | "amber" | "red";

const toneStyles: Record<Tone, { box: string; icon: ReactNode }> = {
  blue: {
    box: "bg-blue-50 border-blue-100 dark:bg-blue-800/10 dark:border-blue-900/50",
    icon: <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 shrink-0" />,
  },
  green: {
    box: "bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900/40",
    icon: <CircleCheck className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />,
  },
  amber: {
    box: "bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/40",
    icon: <TriangleAlert className="h-5 w-5 text-amber-500 shrink-0" />,
  },
  red: {
    box: "bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/40",
    icon: <CircleAlert className="h-5 w-5 text-red-500 shrink-0" />,
  },
};

export const Notice = ({
  tone = "blue",
  title,
  children,
  actions,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) => (
  <div className={cn("flex gap-3 rounded-xl border p-4", toneStyles[tone].box)} role={tone === "red" ? "alert" : "status"}>
    {toneStyles[tone].icon}
    <div className="flex flex-col gap-1 min-w-0 flex-1">
      {title && <p className="text-sm font-semibold">{title}</p>}
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
      {actions && <div className="flex flex-wrap gap-2 mt-2">{actions}</div>}
    </div>
  </div>
);

export const StatusPill = ({ tone, children }: { tone: "green" | "amber" | "gray" | "blue"; children: ReactNode }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
      tone === "green" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      tone === "amber" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      tone === "gray" && "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400",
      tone === "blue" && "bg-blue-100 text-blue-600 dark:bg-blue-800/20 dark:text-blue-400"
    )}
  >
    {children}
  </span>
);

export const toastSaved = (message: string) =>
  toast(message, {
    duration: 2500,
    icon: <CircleCheck className="h-5 w-5 text-blue-500" />,
  });

export const toastError = (message: string) =>
  toast(message, {
    duration: 5000,
    icon: <CircleAlert className="h-5 w-5 text-red-500" />,
  });
