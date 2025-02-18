/**
 * External dependencies
 */
import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useFrappeGetCall } from "frappe-react-sdk";

/**
 * Internal dependencies
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MeetingCardSkeleton, ProfileSkeleton } from "./components/skeletons";
import MeetingCard from "./components/meetingCard";
import Booking from "./components/booking";
import SocialProfiles from "./components/socialProfiles";
import { useAppContext } from "@/context/app";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalTimezone } from "@/lib/utils";
import PoweredBy from "@/components/powered-by";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Typography from "@/components/ui/typography";
import MetaTags from "@/components/meta-tags";

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
        title={`${userInfo.name} | Scheduler`}
        description={`Book appointment with ${userInfo.name}`}
        // keywords="Personal meeting scheduling"
        // author={userInfo.name}
        // robots="index, follow"
        // ogTitle={`${userInfo.name} | Scheduler`}
        // ogDescription={`Book appointment with ${userInfo.name}`}
        // ogImage={userInfo.userImage}
        // twitterCard="summary_large_image"
        // twitterTitle={`${userInfo.name} | Scheduler`}
        // twitterDescription={`Book appointment with ${userInfo.name}`}
        // twitterImage={userInfo.userImage}
      />
      {!type || isLoading ? (
        <div className="w-full h-full max-md:h-fit flex justify-center">
          <div className="container max-w-[74rem] mx-auto p-4 py-8 md:py-16 grid gap-10 md:gap-12">
            <div className="grid lg:grid-cols-[360px,1fr] gap-8 items-start relative md:border rounded-lg">
              {/* Profile Section */}
              {isLoading ? (
                <ProfileSkeleton />
              ) : (
                <div className="w-full md:max-w-sm flex flex-col gap-4 md:p-6 md:px-4">
                  <Avatar className="md:h-32 md:w-32 h-24 w-24 object-cover mb-4 md:mb-0 ">
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
                        <TooltipTrigger className="text-left truncate w-full">
                          {userInfo.name}
                        </TooltipTrigger>
                        <TooltipContent>{userInfo.name}</TooltipContent>
                      </Tooltip>
                    </Typography>
                    {userInfo.designation && userInfo.organizationName && (
                      <Tooltip>
                        <Typography className="text-base text-left text-muted-foreground">
                          <TooltipTrigger className="text-left">
                            {userInfo.designation} at{" "}
                            {userInfo.organizationName}
                          </TooltipTrigger>
                          <TooltipContent>
                            {userInfo.designation} at{" "}
                            {userInfo.organizationName}
                          </TooltipContent>
                        </Typography>
                      </Tooltip>
                    )}
                  </div>
                  <SocialProfiles profiles={userInfo.socialProfiles} />
                </div>
              )}

              {/* Meeting Options */}
              <div className="space-y-6 md:p-6">
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
                <div className="grid sm:grid-cols-2 gap-4 h-full lg:pb-5 overflow-y-auto">
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
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Booking type={type} />
      )}
      <PoweredBy />
    </>
  );
};

export default Appointment;
