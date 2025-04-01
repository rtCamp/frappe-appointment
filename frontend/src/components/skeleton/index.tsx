import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-blue-50 dark:bg-[hsl(240,4%,18%)] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-blue-100/50 dark:before:via-[hsl(220,5%,22%)]/90  before:to-transparent",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
