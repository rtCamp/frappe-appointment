/**
 * Internal dependencies
 */
import { Card, CardContent, CardHeader } from "@/components/card";
import { Skeleton } from "@/components/skeleton";

export function ProfileSkeleton() {
  return (
    <Card className="border-0 shadow-none">
      <CardContent className="max-md:p-4 p-6 flex flex-col space-y-7 items-center">
        <Skeleton className="md:h-32 md:w-32 h-24 w-24 object-cover mb-4 md:mb-0  rounded-full" />
        <div className="flex flex-col space-y-2 w-full items-center">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="flex gap-4 items-center">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

export function MeetingCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden rounded-2xl">
      <CardHeader className="space-y-1">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
