/**
 * Internal dependencies
 */
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarSkeleton() {
  return (
    <Card className="border-0 w-full max-md:flex max-md:justify-center gap-4 md:p-6 pb-5">
      <div className="grid grid-cols-[320px,1fr] md:grid-cols-[400px,1fr] md:gap-4">
        {/* Calendar Section */}
        <div className="space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-4" />
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
              <Skeleton key={day} className="md:h-11 md:w-11 max-md:h-9 max-md:w-9 rounded-md" />
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="md:h-11 md:w-11 max-md:h-9 max-md:w-9 rounded-md" />
            ))}
          </div>
          {/* Bottom Bar */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>

        {/* Time Slots Section */}
        <div className="space-y-2 max-md:hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-44 rounded-md" />
          ))}
        </div>
      </div>
    </Card>
  );
}
