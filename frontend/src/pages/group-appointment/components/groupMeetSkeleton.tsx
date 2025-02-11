import { Skeleton } from "@/components/ui/skeleton";

const GroupMeetSkeleton = () => {
  return (
    <>
      <div className="flex flex-col w-full lg:w-3/4 truncate gap-3 ">
        <Skeleton className="w-4/5 h-10" />
        <div className="w-full pr-5 flex flex-col gap-2 mt-3">
          <div className="flex gap-2">
            <Skeleton className="w-5 rounded-full h-5" />
            <Skeleton className="w-44 h-5" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-5 rounded-full h-5" />
            <Skeleton className="w-36 h-5" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-5 rounded-full h-5" />
            <Skeleton className="w-48 h-5" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-5 rounded-full h-5" />
            <Skeleton className="w-40 h-5" />
          </div>
        </div>
      </div>
    </>
  );
};

export default GroupMeetSkeleton;
