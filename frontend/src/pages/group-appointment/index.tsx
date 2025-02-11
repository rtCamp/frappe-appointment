/**
 * External dependencies
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

/**
 * Internal dependencies
 */
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Typography from "@/components/ui/typography";
import { cn, getAllSupportedTimeZones } from "@/lib/utils";
import { TimeFormat } from "../appointment/types";
import { Button } from "@/components/ui/button";
import { getLocalTimezone } from "@/lib/utils";
import PoweredBy from "@/components/poweredBy";
import { Switch } from "@/components/ui/switch";
import TimeZoneSelect from "../appointment/components/timeZoneSelectmenu";
import { slotType } from "@/context/app";
import Spinner from "@/components/ui/spinner";
import GroupMeetSkeleton from "./components/groupMeetSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { getIconForKey } from "./utils";

const GroupAppointment = () => {
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date");
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [timeZone, setTimeZone] = useState<string>(getLocalTimezone());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<slotType>();
  const [expanded, setExpanded] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const mockData = [
    {
      start_time: "2025-02-11 05:30:00+00:00",
      end_time: "2025-02-11 06:00:00+00:00",
    },
    {
      start_time: "2025-02-11 06:00:00+00:00",
      end_time: "2025-02-11 06:30:00+00:00",
    },
    {
      start_time: "2025-02-11 06:30:00+00:00",
      end_time: "2025-02-11 07:00:00+00:00",
    },
    {
      start_time: "2025-02-11 07:30:00+00:00",
      end_time: "2025-02-11 08:00:00+00:00",
    },
    {
      start_time: "2025-02-11 08:00:00+00:00",
      end_time: "2025-02-11 08:30:00+00:00",
    },
    {
      start_time: "2025-02-11 08:30:00+00:00",
      end_time: "2025-02-11 09:00:00+00:00",
    },
    {
      start_time: "2025-02-11 09:00:00+00:00",
      end_time: "2025-02-11 09:30:00+00:00",
    },
    {
      start_time: "2025-02-11 09:30:00+00:00",
      end_time: "2025-02-11 10:00:00+00:00",
    },
    {
      start_time: "2025-02-11 11:00:00+00:00",
      end_time: "2025-02-11 11:30:00+00:00",
    },
  ];

  useEffect(() => {
    if (date) {
      const dateObj = new Date(date);
      setSelectedDate(dateObj);
      setDisplayMonth(dateObj);
      updateDateQuery(dateObj);
    }
  }, [date]);

  const updateDateQuery = (date: Date) => {
    const queries: Record<string, string> = {};
    searchParams.forEach((value, key) => (queries[key] = value));
    setSearchParams({
      ...queries,
      date: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
    });
  };

  const formatTimeSlot = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: timeFormat === "12h",
      timeZone: timeZone,
    }).format(date);
  };

  const MeetingData = {
    "name": "Siddhant Singh",
    "job title": "React Engineer",
    "interview round": "React Engineer | HM Technical Interview",
    "meeting provider": "Google Meet",
  };

  const scheduleMeeting = () => {};

  return (
    <>
      <div className="w-full flex justify-center items-center">
        <div className="w-full xl:w-4/5 2xl:w-3/5 lg:py-16 p-6 px-4">
          <div className="h-fit flex w-full max-lg:flex-col md:border md:rounded-lg md:p-6 md:px-4 max-lg:gap-5 ">
            {/* Group Meet Details */}
            {isLoading ? (
              <GroupMeetSkeleton />
            ) : (
              <div className="flex flex-col w-full lg:w-3/4 truncate gap-3 ">
                <Typography variant="h2" className="text-3xl font-semibold">
                  <Tooltip>
                    <TooltipTrigger className="text-left truncate w-full">
                      Siddhant's group
                    </TooltipTrigger>
                    <TooltipContent>Siddhant's group</TooltipContent>
                  </Tooltip>
                </Typography>
                <div className="w-full flex flex-col gap-2 mt-3">
                  {Object.entries(MeetingData).map(([key, value]) => {
                    const Icon = getIconForKey(key);
                    return (
                      <div
                        key={key}
                        className="flex cursor-default items-center gap-2 w-full "
                      >
                        <div className="w-full truncate text-gray-600 flex items-center justify-start gap-2">
                          <Icon className="h-4 w-4 shrink-0" />
                          <Tooltip>
                            <TooltipTrigger className="text-left truncate">
                              <Typography className={cn("truncate capitalize font-medium text-gray-600",key.includes("name")&&"text-foreground")}>
                                {value}
                              </Typography>
                            </TooltipTrigger>
                            <TooltipContent className="capitalize"><span className="text-blue-600">{key}</span> : {value}</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <hr className="w-full bg-muted md:hidden" />
            {(!isMobileView || !expanded) && (
              <div className="flex flex-col w-full lg:max-w-96">
                {/* Calendar View */}
                <div className="w-full">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    month={displayMonth}
                    onMonthChange={setDisplayMonth}
                    onDayClick={(date) => {
                      setSelectedDate(date);
                      updateDateQuery(date);
                      setDisplayMonth(date);
                      setExpanded(true);
                      setSelectedSlot({
                        start_time: "",
                        end_time: "",
                      });
                    }}
                    weekStartsOn={1}
                    className="rounded-md md:border md:h-96 w-full flex lg:px-6 lg:p-2 p-0"
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
                </div>
                <div className="w-full mt-4 gap-5 flex max-md:flex-col md:justify-between md:items-center ">
                  {/* Timezone */}

                  <TimeZoneSelect
                    timeZones={getAllSupportedTimeZones()}
                    setTimeZone={setTimeZone}
                    timeZone={timeZone}
                  />

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
            {/* Available Slots */}
            <div
              className={cn(
                "w-full flex flex-col lg:w-1/2 gap-2 lg:px-5",
                !expanded && "max-md:hidden"
              )}
            >
              <Typography
                variant="h3"
                className="text-sm font-semibold lg:w-full truncate"
              >
                {format(selectedDate, "EEEE, d MMMM yyyy")}
              </Typography>

              {isLoading ? (
                <div className="h-full flex flex-col w-full mb-3 overflow-y-auto no-scrollbar space-y-2">
                  {Array.from({ length: 5 }).map((_, key) => (
                    <Skeleton key={key} className="w-full h-10" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="lg:h-[22rem] mb-3 overflow-y-auto no-scrollbar space-y-2">
                    {mockData.map((slot, index) => (
                      <Button
                        key={index}
                        onClick={() => {
                          setSelectedSlot({
                            start_time: slot.start_time,
                            end_time: slot.end_time,
                          });
                        }}
                        variant="outline"
                        className={cn(
                          "w-full font-normal border border-blue-500 text-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-colors ",
                          selectedSlot?.start_time === slot.start_time &&
                            selectedSlot?.end_time === slot.end_time &&
                            "bg-blue-500 text-white hover:bg-blue-400 hover:text-white"
                        )}
                      >
                        {formatTimeSlot(new Date(slot.start_time))}
                      </Button>
                    ))}
                  </div>
                  <Button
                    className={cn(
                      "bg-blue-400 hover:bg-blue-500 lg:!mt-0 max-lg:w-full hidden",
                      selectedSlot?.start_time &&
                        selectedSlot.end_time &&
                        "block"
                    )}
                    onClick={scheduleMeeting}
                  >
                    Schedule
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <PoweredBy />
    </>
  );
};

export default GroupAppointment;
