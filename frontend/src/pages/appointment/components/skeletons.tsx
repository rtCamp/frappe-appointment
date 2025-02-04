/**
 * Internal dependencies
 */
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
  return (
    <Card className="border">
      <CardContent className="p-6 flex flex-col items-center text-center space-y-10">
        <Skeleton className="w-36 h-36 rounded-full" />
        <div className="space-y-2 w-full">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-4 w-1/3 mx-auto" />
        </div>
        <div className="flex gap-4 justify-center">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

export function MeetingCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden">
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
