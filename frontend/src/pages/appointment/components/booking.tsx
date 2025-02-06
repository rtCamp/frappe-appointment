/**
 * External dependencies.
 */
import { useEffect, useRef, useState } from "react";
import { format, formatDate } from "date-fns";
import { Clock, Calendar as CalendarIcon, ArrowLeft } from "lucide-react";
import { useFrappeGetCall } from "frappe-react-sdk";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

/**
 * Internal dependencies.
 */
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { type TimeFormat, type MeetingData } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import Typography from "@/components/ui/typography";
import {
  cn,
  convertToMinutes,
  getTimeZoneOffsetFromTimeZoneString,
  parseFrappeErrorMsg,
} from "@/lib/utils";
import MeetingForm from "./meetingForm";
import { useAppContext } from "@/context/app";
import TimeSlotSkeleton from "./timeSlotSkeleton";
import TimeZoneSelect from "./timeZoneSelectmenu";
import { Skeleton } from "@/components/ui/skeleton";
import { disabledDays } from "../utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BookingProp {
  type: string;
}

const Booking = ({ type }: BookingProp) => {
  const {
    userInfo,
    timeZone,
    duration,
    setDuration,
    setTimeZone,
    selectedDate,
    setSelectedDate,
    setSelectedSlot,
  } = useAppContext();
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [timeZones, setTimeZones] = useState<Array<string>>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date");

  const updateDateQuery = (date: Date) => {
    setSearchParams({
      date: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
      type,
    });
  };

  const [meetingData, setMeetingData] = useState<MeetingData>({
    all_available_slots_for_data: [],
    available_days: [],
    date: "",
    duration: "",
    endtime: "",
    is_invalid_date: true,
    next_valid_date: "",
    prev_valid_date: "",
    starttime: "",
    total_slots_for_day: 0,
    user: "",
    valid_end_date: "",
    valid_start_date: "",
  });
  const navigate = useNavigate();
  const { data, isLoading, error } = useFrappeGetCall(
    "frappe_appointment.api.personal_meet.get_time_slots",
    {
      duration_id: type,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(selectedDate),
      user_timezone_offset: String(
        getTimeZoneOffsetFromTimeZoneString(timeZone || "Asia/Calcutta")
      ),
    },
    undefined
  );

  const {
    data: timeZoneData,
    isLoading: timeZoneLoading,
    error: timeZoneError,
  } = useFrappeGetCall(
    "frappe_appointment.api.personal_meet.get_all_timezones"
  );

  useEffect(() => {
    if (timeZoneData) {
      setTimeZones(timeZoneData?.message || []);
    }
    if (timeZoneError) {
      const error = parseFrappeErrorMsg(timeZoneError);
      toast(error || "Something went wrong", {
        action: {
          label: "OK",
          onClick: () => toast.dismiss(),
        },
      });
    }
  }, [timeZoneData, timeZoneError]);

  useEffect(() => {
    if (date) {
      setSelectedDate(new Date(date));
    }
  }, [date]);

  useEffect(() => {
    if (data) {
      setMeetingData(data.message);
      setDuration(convertToMinutes(data?.message?.duration).toString());
      setSelectedDate(
        data.message.is_invalid_date
          ? new Date(data.message.next_valid_date)
          : selectedDate
      );
      updateDateQuery(
        data.message.is_invalid_date
          ? new Date(data.message.next_valid_date)
          : selectedDate
      );
    }
    if (error) {
      navigate("/");
    }
  }, [data, error, type, navigate, setDuration, setMeetingData]);

  const formatTimeSlot = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: timeFormat === "12h",
      timeZone,
    }).format(date);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
      setExpanded(false);
      setShowMeetingForm(false);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (containerRef.current && isMobileView) {
      containerRef.current.style.width = "100%";
    }
  }, [isMobileView]);

  return (
    <div className="w-full h-fit flex justify-center">
      <div className="md:w-4xl max-lg:w-full max-md:mx-1 py-8 md:px-4 md:py-16 gap-10 md:gap-12">
        <div className="w-full rounded-lg flex max-lg:flex-col md:border gap-8 md:gap-28 items-start">
          {/* Profile */}
          <div className="w-full md:max-w-sm flex flex-col gap-4 md:p-6 px-4">
            <Avatar className="md:h-32 md:w-32 h-24 w-24 object-cover mb-4 md:mb-0">
              <AvatarImage src={userInfo.userImage} alt="Profile picture" />
              <AvatarFallback className="text-4xl">
                {userInfo.name?.toString()[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="w-full flex flex-col gap-1">
              <Typography variant="h2" className="text-3xl font-semibold">
                <Tooltip>
                  <TooltipTrigger className="w-full truncate text-left">
                    {userInfo.name}
                  </TooltipTrigger>
                  <TooltipContent>{userInfo.name}</TooltipContent>
                </Tooltip>
              </Typography>
              <Typography className="text-base text-muted-foreground">
                {userInfo.designation} at {userInfo.organizationName}
              </Typography>
              <Typography className="text-sm mt-1">
                <Clock className="inline-block w-4 h-4 mr-1" />
                {duration} Minute Meeting
              </Typography>
              <Typography className="text-sm  mt-1">
                <CalendarIcon className="inline-block w-4 h-4 mr-1" />
                {formatDate(new Date(), "d MMM, yyyy")}
              </Typography>
              {userInfo.meetingProvider == "Zoom" ? (
                <Typography className="text-sm text-blue-500 mt-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    x="0px"
                    y="0px"
                    className="inline-block w-4 h-4 mr-1"
                    viewBox="0 0 48 48"
                  >
                    <circle cx="24" cy="24" r="20" fill="#2196f3"></circle>
                    <path
                      fill="#fff"
                      d="M29,31H14c-1.657,0-3-1.343-3-3V17h15c1.657,0,3,1.343,3,3V31z"
                    ></path>
                    <polygon
                      fill="#fff"
                      points="37,31 31,27 31,21 37,17"
                    ></polygon>
                  </svg>
                  Zoom
                </Typography>
              ) : (
                <Typography className="text-sm text-blue-700 mt-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    x="0px"
                    y="0px"
                    className="inline-block w-4 h-4 mr-1"
                    width="100"
                    height="100"
                    viewBox="0 0 48 48"
                  >
                    <rect
                      width="16"
                      height="16"
                      x="12"
                      y="16"
                      fill="#fff"
                      transform="rotate(-90 20 24)"
                    ></rect>
                    <polygon
                      fill="#1e88e5"
                      points="3,17 3,31 8,32 13,31 13,17 8,16"
                    ></polygon>
                    <path
                      fill="#4caf50"
                      d="M37,24v14c0,1.657-1.343,3-3,3H13l-1-5l1-5h14v-7l5-1L37,24z"
                    ></path>
                    <path
                      fill="#fbc02d"
                      d="M37,10v14H27v-7H13l-1-5l1-5h21C35.657,7,37,8.343,37,10z"
                    ></path>
                    <path
                      fill="#1565c0"
                      d="M13,31v10H6c-1.657,0-3-1.343-3-3v-7H13z"
                    ></path>
                    <polygon fill="#e53935" points="13,7 13,17 3,17"></polygon>
                    <polygon
                      fill="#2e7d32"
                      points="38,24 37,32.45 27,24 37,15.55"
                    ></polygon>
                    <path
                      fill="#4caf50"
                      d="M46,10.11v27.78c0,0.84-0.98,1.31-1.63,0.78L37,32.45v-16.9l7.37-6.22C45.02,8.8,46,9.27,46,10.11z"
                    ></path>
                  </svg>
                  Google Meet
                </Typography>
              )}
            </div>
          </div>
          {/* Calendar and Availability slots */}
          {!showMeetingForm && (
            <div className="w-full flex max-lg:flex-col gap-4 md:p-6 pb-5">
              {(!isMobileView || !expanded) && (
                <div className="flex flex-col w-full lg:w-[25rem] shrink-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    weekStartsOn={1}
                    fromMonth={new Date(meetingData.valid_start_date)}
                    toMonth={new Date(meetingData.valid_end_date)}
                    disabled={(date) => {
                      const disabledDaysList =
                        disabledDays(meetingData.available_days) || [];
                      const isPastDate =
                        date <
                        new Date(meetingData.valid_start_date)?.setHours(
                          0,
                          0,
                          0,
                          0
                        );
                      const isNextDate =
                        date >
                        new Date(meetingData.valid_end_date)?.setHours(
                          0,
                          0,
                          0,
                          0
                        );
                      return (
                        isPastDate ||
                        disabledDaysList.includes(date.getDay()) ||
                        isNextDate
                      );
                    }}
                    onDayClick={(date) => {
                      setSelectedDate(date);
                      updateDateQuery(date);
                      setExpanded(true);
                    }}
                    className="rounded-md md:border md:h-96 w-full flex md:px-6"
                    classNames={{
                      months:
                        "flex w-full flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 flex-1",
                      month: "space-y-4 w-full flex flex-col",
                      table: "w-full h-full border-collapse space-y-1",
                      head_row: "",
                      row: "w-full mt-2",
                      caption_label: "md:text-xl text-sm",
                    }}
                  />
                  <div className="mt-4 max-md:px-6 gap-5 flex max-md:flex-col md:justify-between md:items-center ">
                    {/* Timezone */}
                    {timeZoneLoading ? (
                      <Skeleton className="w-full lg:w-32 h-10" />
                    ) : (
                      <TimeZoneSelect
                        timeZones={[...timeZones,"Asia/Calcutta"]}
                        setTimeZone={setTimeZone}
                        timeZone={timeZone}
                      />
                    )}

                    {/* Time Format Toggle */}
                    <div className="flex items-center gap-2">
                      <Typography className="text-sm text-gray-700">
                        AM/PM
                      </Typography>
                      <Switch
                        className="data-[state=checked]:bg-blue-500 active:ring-blue-400 focus-visible:ring-blue-400"
                        checked={timeFormat === "24h"}
                        onCheckedChange={(checked) =>
                          setTimeFormat(checked ? "24h" : "12h")
                        }
                      />
                      <Typography className="text-sm text-gray-700">
                        24H
                      </Typography>
                    </div>
                  </div>
                </div>
              )}

              {/* Availability Slots */}
              {isMobileView && expanded && (
                <div className="h-14 fixed bottom-0 left-0 w-screen border z-10 bg-white border-top flex items-center justify-start">
                  <Button
                    variant="link"
                    className="text-blue-500"
                    onClick={() => setExpanded(false)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              )}

              {/* Available slots */}
              <div
                className={cn(
                  "w-48 max-lg:w-full overflow-hidden space-y-4 max-md:pb-10 max-md:px-4 transition-all duration-300 ",
                  !expanded && "max-md:hidden"
                )}
              >
                <h3 className="text-sm font-semibold mb-4 ">
                  {format(selectedDate, "EEEE, d MMMM yyyy")}
                </h3>
                {isLoading ? (
                  <TimeSlotSkeleton />
                ) : (
                  <div
                    className="md:h-96 overflow-y-auto no-scrollbar space-y-2 transition-transform transform"
                    style={{
                      transform: selectedDate
                        ? "translateX(0)"
                        : "translateX(-100%)",
                    }}
                  >
                    {meetingData.all_available_slots_for_data.length > 0 ? (
                      meetingData.all_available_slots_for_data.map(
                        (slot, index) => (
                          <Button
                            key={index}
                            onClick={() => {
                              setShowMeetingForm(true);
                              setSelectedSlot({
                                start_time: slot.start_time,
                                end_time: slot.end_time,
                              });
                            }}
                            variant="outline"
                            className="w-full font-normal border border-blue-500 text-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          >
                            {formatTimeSlot(new Date(slot.start_time))}
                          </Button>
                        )
                      )
                    ) : (
                      <div className="h-full max-md:h-44 w-full flex justify-center items-center">
                        <Typography className="text-center text-gray-500">
                          No open-time slots
                        </Typography>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {showMeetingForm && (
            <MeetingForm
              onBack={() => {
                setShowMeetingForm(false);
                setExpanded(false);
              }}
              durationId={type}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
