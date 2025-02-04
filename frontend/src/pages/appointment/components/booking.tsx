/**
 * External dependencies.
 */
import { useEffect, useRef, useState } from "react";
import { format, formatDate } from "date-fns";
import {
  Clock,
  Globe,
  Calendar as CalendarIcon,
  ArrowLeft,
} from "lucide-react";

/**
 * Internal dependencies.
 */
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { TimeFormat, DayAvailability } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import Typography from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import MeetingForm from "./meetingForm";
import { getCurrentTime, getTimeZoneOffset } from "../utils";
import { useAppContext } from "@/context/app";
import { useFrappeGetCall } from "frappe-react-sdk";
import CalendarSkeleton from "./calendarSkeleton";

const timeZones = [
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Calcutta",
  "Asia/Tokyo",
];

// Map days to numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
const dayMapping: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

// Convert available days to disabled days
const disabledDays = (availableDays?: string[]) => {
  if (!availableDays) return []; // Return an empty array if data isn't loaded yet

  return Object.values(dayMapping).filter(
    (dayNumber) => !availableDays.includes(Object.keys(dayMapping)[dayNumber])
  );
};

export const mockAvailability: DayAvailability[] = [
  {
    date: "2025-01-31",
    slots: [
      {
        startTime: "2025-01-31T06:30:00.000Z", // 12:00 PM IST
        endTime: "2025-01-31T07:00:00.000Z", // 12:30 PM IST
        isAvailable: true,
      },
      {
        startTime: "2025-01-31T07:00:00.000Z", // 12:30 PM IST
        endTime: "2025-01-31T07:30:00.000Z", // 1:00 PM IST
        isAvailable: true,
      },
      {
        startTime: "2025-01-31T07:30:00.000Z", // 1:00 PM IST
        endTime: "2025-01-31T08:00:00.000Z", // 1:30 PM IST
        isAvailable: true,
      },
      {
        startTime: "2025-01-31T07:30:00.000Z", // 1:00 PM IST
        endTime: "2025-01-31T08:00:00.000Z", // 1:30 PM IST
        isAvailable: true,
      },
      {
        startTime: "2025-01-31T07:30:00.000Z", // 1:00 PM IST
        endTime: "2025-01-31T08:00:00.000Z", // 1:30 PM IST
        isAvailable: true,
      },
      {
        startTime: "2025-01-31T07:30:00.000Z", // 1:00 PM IST
        endTime: "2025-01-31T08:00:00.000Z", // 1:30 PM IST
        isAvailable: true,
      },
      {
        startTime: "2025-01-31T07:30:00.000Z", // 1:00 PM IST
        endTime: "2025-01-31T08:00:00.000Z", // 1:30 PM IST
        isAvailable: true,
      },
      {
        startTime: "2025-01-31T07:30:00.000Z", // 1:00 PM IST
        endTime: "2025-01-31T08:00:00.000Z", // 1:30 PM IST
        isAvailable: true,
      },
      {
        startTime: "2025-01-31T07:30:00.000Z", // 1:00 PM IST
        endTime: "2025-01-31T08:00:00.000Z", // 1:30 PM IST
        isAvailable: true,
      },
      {
        startTime: "2025-01-31T07:30:00.000Z", // 1:00 PM IST
        endTime: "2025-01-31T08:00:00.000Z", // 1:30 PM IST
        isAvailable: true,
      },
    ],
  },
];

const Booking = () => {
  const {
    userInfo,
    duration,
    timeZone,
    setTimeZone,
    selectedDate,
    setSelectedDate,
    setSelectedSlot,
    durationId,
  } = useAppContext();
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const { data, isLoading, error, mutate } = useFrappeGetCall(
    "frappe_appointment.api.personal_meet.get_time_slots?=330",
    {
      duration_id: durationId,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(selectedDate),
      user_timezone_offset:-selectedDate.getTimezoneOffset(),
    },
    undefined
  );

  // Get availability for selected date
  const dayAvailability = mockAvailability.find(
    (day) => day.date === format(selectedDate, "yyyy-MM-dd")
  );

  // Convert availability slots to selected timezone
  const convertedSlots =
    dayAvailability?.slots.map((slot) => ({
      ...slot,
      startTime: new Date(slot.startTime),
      endTime: new Date(slot.endTime),
    })) || [];

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
      <div className="md:w-4xl max-md:w-full max-md:mx-1 py-8 md:px-4 md:py-16 gap-10 md:gap-12">
        <div className="w-full rounded-lg flex max-md:flex-col md:border gap-8 md:gap-28 items-start">
          {/* Profile */}
          <div className="w-full md:max-w-sm flex flex-col gap-4 md:p-6 px-4">
            <Avatar className="md:h-32 md:w-32 h-24 w-24 object-cover mb-4 md:mb-0">
              <AvatarImage src={userInfo.userImage} alt="Profile picture" />
              <AvatarFallback className="text-4xl">
                {userInfo.name?.toString()[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="w-full flex flex-col gap-1 ">
              <Typography variant="h2" className="text-3xl font-semibold">
                {userInfo.name}
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
          {isLoading ? (
            <CalendarSkeleton />
          ) : (
            <>
              {/* Calendar and Availability slots */}
              {!showMeetingForm && (
                <div className="w-full flex max-md:flex-col gap-4 md:p-6 pb-5">
                  {(!isMobileView || !expanded) && (
                    <div className="flex flex-col w-full md:w-[25rem] shrink-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        weekStartsOn={1}
                        disabled={(date) => {
                          const disabledDaysList =
                            disabledDays(data?.message?.available_days) || []; // Ensure it's always an array
                          return disabledDaysList.includes(date.getDay());
                        }}
                        onDayClick={(date) => {
                          setSelectedDate(date);
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
                        <Select
                          value={timeZone}
                          onValueChange={(tz) => {
                            setTimeZone(tz);
                          }}
                        >
                          <SelectTrigger className="w-full md:w-fit md:border-none md:focus:ring-0 md:focus:ring-offset-0 [&>svg]:ml-3 [&>span]:text-gray-700 [&>span]:font-medium">
                            <Globe className="h-4 w-4 mr-2 text-gray-700 max-md:hidden" />
                            <SelectValue placeholder="Select timezone">
                              {timeZone.split("/")[1].replace("_", " ")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {timeZones.map((tz) => (
                              <SelectItem
                                key={tz}
                                value={tz}
                                className="cursor-pointer py-3 px-4 [&_svg]:hidden"
                              >
                                <div className="flex w-full items-center gap-4">
                                  {/* Timezone Name with Fixed Width */}
                                  <div className="w-40 truncate">
                                    <div className="font-medium truncate">
                                      {tz.split("/")[1].replace("_", " ")}
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate">
                                      {getTimeZoneOffset(tz)}
                                    </div>
                                  </div>

                                  {/* Current Time with Fixed Width */}
                                  <div className="w-20 text-sm text-muted-foreground text-right">
                                    {getCurrentTime(tz)}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

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

                  <div
                    className={cn(
                      "w-48 max-md:w-full overflow-hidden space-y-4 max-md:pb-10 max-md:px-4 transition-all duration-300 ",
                      !expanded && "max-md:hidden"
                    )}
                  >
                    <h3 className="text-sm font-semibold mb-4 ">
                      {format(selectedDate, "EEEE, d MMMM yyyy")}
                    </h3>
                    <div
                      className="md:h-96 overflow-y-auto no-scrollbar space-y-2 transition-transform transform"
                      style={{
                        transform: selectedDate
                          ? "translateX(0)"
                          : "translateX(-100%)",
                      }}
                    >
                      {data?.message?.all_available_slots_for_data.length >
                      0 ? (
                        data?.message?.all_available_slots_for_data.map(
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
                  </div>
                </div>
              )}
              {showMeetingForm && (
                <MeetingForm
                  onBack={() => {
                    setShowMeetingForm(false);
                    setExpanded(false);
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
