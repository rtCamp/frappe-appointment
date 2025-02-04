/**
 * External dependencies
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

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

const Appointment = () => {
  const { meetId } = useParams();
  const {
    setMeetingId,
    setUserInfo,
    userInfo,
    setDuration,
    duration,
    setTimeZone,
  } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const profiles: Profile[] = [
    { LinkedIn: "https://www.linkedin.com/in/example" },
    { X: "https://x.com/example" },
    { GitHub: "https://github.com/example" },
  ];

  // Simulate loading state
  useEffect(() => {
    if (meetId) {
      setMeetingId(meetId);
    }
    setUserInfo({
      name: "Rahul Bansal",
      designation: "Founder & CEO",
      organizationName: "rtCamp",
      userImage:
        "https://lh3.googleusercontent.com/a/AAcHTtd8ByLnu5DhRjHiVrIc_mpqzO5PflSbAyv_kuYW6B8=s150-c",
      socialProfiles: profiles,
      meetingProvider: "Zoom",
    });
    setTimeZone("Asia/Calcutta");
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {!duration ? (
        <div className="w-full h-full max-md:h-fit flex justify-center">
          <div className="container max-w-6xl mx-auto p-4 py-8 md:py-16 grid gap-10 md:gap-12">
            <div className="grid md:grid-cols-[300px,1fr] gap-8 items-start relative">
              {/* Profile Section */}
              {isLoading ? (
                <ProfileSkeleton />
              ) : (
                <Card className="border">
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-10">
                    <Avatar className="w-36 h-36 border-4 border-white shadow-lg">
                      <AvatarImage
                        src={userInfo.userImage}
                        alt="Profile picture"
                      />
                      <AvatarFallback className="text-4xl">
                        {userInfo.name?.toString()[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <h1 className="text-2xl font-semibold tracking-tight">
                        {userInfo.name}
                      </h1>
                      <div className="text-muted-foreground">
                        <p className="font-medium">{userInfo.designation}</p>
                        <p>{userInfo.organizationName}</p>
                      </div>
                    </div>
                    <SocialProfiles profiles={profiles} />
                  </CardContent>
                </Card>
              )}

              {/* Meeting Options */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">
                    Select Meeting Duration
                  </h2>
                  <p className="text-muted-foreground">
                    You will receive a calendar invite with meeting link.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {isLoading ? (
                    <>
                      <MeetingCardSkeleton />
                      <MeetingCardSkeleton />
                    </>
                  ) : (
                    <>
                      <MeetingCard
                        title="quick"
                        duration="30"
                        onClick={() => setDuration("30")}
                      />
                      <MeetingCard
                        title="standard"
                        duration="60"
                        onClick={() => setDuration("60")}
                      />
                      <MeetingCard
                        title="standard"
                        duration="45"
                        onClick={() => setDuration("45")}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Booking />
      )}
    </>
  );
};

export default Appointment;
