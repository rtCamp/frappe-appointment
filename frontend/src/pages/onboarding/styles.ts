import { cn } from "@/lib/utils";

export const buttonVariants = {
  solid: "bg-surface-gray-10 text-ink-base hover:bg-surface-gray-9",
  subtle: "bg-surface-gray-2 text-ink-gray-8 hover:bg-surface-gray-3",
  ghost: "bg-transparent text-ink-gray-7 hover:bg-surface-gray-3",
};

/** 28px by default; "md" (32px) for a step's main actions, "lg" (40px) for the log-in card. */
export const buttonClass = (variant: keyof typeof buttonVariants = "subtle", size: "sm" | "md" | "lg" = "sm") =>
  cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-es-base no-underline",
    "focus-visible:outline-none focus-visible:shadow-es-focus",
    "disabled:cursor-not-allowed disabled:bg-surface-gray-2 disabled:text-ink-gray-4",
    size === "sm" && "h-7",
    size === "md" && "h-8 px-3 font-medium",
    size === "lg" && "h-10 px-3 rounded-[10px] text-es-lg font-medium",
    buttonVariants[variant]
  );
