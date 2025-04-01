/**
 * External dependencies
 */
import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useFrappeGetCall } from "frappe-react-sdk";

/**
 * Internal dependencies
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { MeetingCardSkeleton, ProfileSkeleton } from "./components/skeletons";
import MeetingCard from "./components/meetingCard";
import Booking from "./components/booking";
import SocialProfiles from "./components/socialProfiles";
import { useAppContext } from "@/context/app";
import { Skeleton } from "@/components/skeleton";
import { getLocalTimezone } from "@/lib/utils";
import PoweredBy from "@/components/powered-by";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/tooltip";
import Typography from "@/components/typography";
import MetaTags from "@/components/meta-tags";
import { Info } from "lucide-react";

const Appointment = () => {
  const { meetId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const type = searchParams.get("type");

  const updateTypeQuery = (type: string) => {
    setSearchParams({ type });
  };

  const navigate = useNavigate();
  const {
    setMeetingId,
    setUserInfo,
    userInfo,
    setDuration,
    setTimeZone,
    meetingDurationCards,
    setMeetingDurationCards,
  } = useAppContext();

  const { data, isLoading, error } = useFrappeGetCall(
    "frappe_appointment.api.personal_meet.get_meeting_windows",
    {
      slug: meetId,
    },
    undefined,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      errorRetryCount: 3,
    }
  );

  useEffect(() => {
    if (meetId) {
      setMeetingId(meetId);
    }
    setTimeZone(getLocalTimezone());
  }, []);

  useEffect(() => {
    if (data) {
      setUserInfo({
        name: data?.message?.full_name,
        designation: data?.message?.position,
        organizationName: data?.message?.company,
        userImage: data?.message?.profile_pic,
        socialProfiles: [],
        meetingProvider: data?.message?.meeting_provider,
        banner_image:data?.message?.banner_image,
      });
      setMeetingDurationCards(data?.message?.durations);
    }
    if (error) {
      navigate("/");
    }
  }, [data, error]);

  return (
    <>
      <MetaTags
        title={`${userInfo.name} | Appointment`}
        description={`Book appointment with ${userInfo.name}`}
      />
      {!type || isLoading ? (
        <div className="w-full h-full max-md:h-fit flex justify-center">
          <div className="container max-w-[74rem] mx-auto md:p-4 md:py-8 lg:py-16 grid md:gap-12">
            <div className="grid lg:grid-cols-[360px,1fr] md:gap-8 max-md:gap-10  items-start relative rounded-lg">
              {/* Profile Section */}
              {isLoading ? (
                <ProfileSkeleton />
              ) : (
                <div className="w-full flex flex-col gap-4 p-4 md:p-6 max-lg:md:pt-10 md:px-4 justify-center items-center bg-gradient-to-b from-blue-100 to-transparent dark:bg-gradient-to-b dark:from-zinc-800 md:rounded-2xl">
                  <Avatar className="md:h-32 md:w-32 h-24 w-24 object-cover mb-4 md:mb-0 hover:outline outline-blue-300 dark:outline-blue-400/80 transition-all duration-100">
                    <AvatarImage
                      src={userInfo.userImage}
                      alt="Profile picture"
                      className="bg-blue-50"
                    />
                    <AvatarFallback className="text-4xl">
                      {userInfo?.name?.toString()[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="w-full flex flex-col gap-1">
                    <Typography variant="h2" className="text-3xl font-semibold">
                      <Tooltip>
                        <TooltipTrigger className="truncate w-full">
                          {userInfo.name}
                        </TooltipTrigger>
                        <TooltipContent>{userInfo.name}</TooltipContent>
                      </Tooltip>
                    </Typography>
                    {userInfo.designation && userInfo.organizationName && (
                      <Tooltip>
                        <TooltipTrigger className="w-full">
                          <Typography className="text-base text-muted-foreground">
                            {userInfo.designation} at{" "}
                            {userInfo.organizationName}
                          </Typography>
                        </TooltipTrigger>
                        <TooltipContent>
                          {userInfo.designation} at {userInfo.organizationName}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <SocialProfiles profiles={userInfo.socialProfiles} />
                </div>
              )}

              {/* Meeting Options */}
              <div className="space-y-6 p-4 md:p-6 md:pt-0">
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 md:w-56" />
                    <Skeleton className="h-4 md:w-72" />
                  </>
                ) : (
                  <div>
                    <h2 className="text-xl font-semibold mb-2">
                      Select Meeting Duration
                    </h2>
                    <p className="text-muted-foreground">
                      You will receive a calendar invite with meeting link.
                    </p>
                  </div>
                )}
                {/* meeting cards */}
                <div className="grid sm:grid-cols-2 gap-4 h-full lg:pb-5 overflow-y-auto py-3">
                  {isLoading ? (
                    <>
                      <MeetingCardSkeleton />
                      <MeetingCardSkeleton />
                      <MeetingCardSkeleton />
                    </>
                  ) : (
                    meetingDurationCards.map((card) => (
                      <MeetingCard
                        key={card.id}
                        title={card.label}
                        duration={card.duration / 60}
                        onClick={() => {
                          setDuration((card.duration / 60)?.toString());
                          updateTypeQuery(card.id);
                        }}
                      />
                    ))
                  )}
                </div>
                <div className="mt-4 p-3 md:hidden bg-gray-50 dark:bg-card rounded-2xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-3">
                    <Info className="text-amber-500 size-10" />
                    <p>
                      All times are in your local timezone. Meetings can be
                      rescheduled if needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Booking type={type} banner={userInfo.banner_image} />
      )}
      <PoweredBy />
    </>
  );
};

export default Appointment;
