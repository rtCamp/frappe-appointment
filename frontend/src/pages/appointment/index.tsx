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
import { Card, CardContent } from "@/components/ui/card";
import { MeetingCardSkeleton, ProfileSkeleton } from "./components/skeletons";
import MeetingCard from "./components/meetingCard";
import Booking from "./components/booking";
import SocialProfiles, { Profile } from "./components/socialProfiles";
import { useAppContext } from "@/context/app";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalTimezone } from "@/lib/utils";
import PoweredBy from "@/components/poweredBy";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  const profiles: Profile[] = [
    { LinkedIn: "https://www.linkedin.com/in/example" },
    { X: "https://x.com/example" },
    { GitHub: "https://github.com/example" },
  ];

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
      {!type || isLoading ? (
        <div className="w-full h-full max-md:h-fit flex justify-center">
          <div className="container max-w-6xl mx-auto p-4 py-8 md:py-16 grid gap-10 md:gap-12">
            <div className="grid lg:grid-cols-[300px,1fr] gap-8 items-start relative">
              {/* Profile Section */}
              {isLoading ? (
                <ProfileSkeleton />
              ) : (
                <Card className="border max-lg:w-full max-lg:overflow-hidden">
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-10">
                    <Avatar className="w-36 h-36 border-4 border-white shadow-lg">
                      <AvatarImage
                        src={userInfo.userImage}
                        alt="Profile picture"
                        className="bg-blue-50"
                      />
                      <AvatarFallback className="text-4xl">
                        {userInfo?.name?.toString()[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2 w-full">
                      <h1 className="text-2xl font-semibold tracking-tight truncate cursor-pointer">
                        <Tooltip>
                          <TooltipTrigger>{userInfo.name}</TooltipTrigger>
                          <TooltipContent>{userInfo.name}</TooltipContent>
                        </Tooltip>
                      </h1>
                      <div className="text-muted-foreground">
                        <p className="font-medium truncate cursor-pointer">
                          <Tooltip>
                            <TooltipTrigger>
                              {userInfo.designation}
                            </TooltipTrigger>
                            <TooltipContent>
                              {userInfo.designation}
                            </TooltipContent>
                          </Tooltip>
                        </p>
                        <p className="cursor-pointer truncate">
                          <Tooltip>
                            <TooltipTrigger>
                              {userInfo.organizationName}
                            </TooltipTrigger>
                            <TooltipContent>
                              {userInfo.organizationName}
                            </TooltipContent>
                          </Tooltip>
                        </p>
                      </div>
                    </div>
                    <SocialProfiles profiles={userInfo.socialProfiles} />
                  </CardContent>
                </Card>
              )}

              {/* Meeting Options */}
              <div className="space-y-6">
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
                    </>
                  ) : (
                    meetingDurationCards.map((card) => (
                      <MeetingCard
                        key={card.id}
                        id={card.id}
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
