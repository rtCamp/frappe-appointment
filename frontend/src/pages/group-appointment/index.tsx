/**
 * External dependencies
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { toast } from "sonner";

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
import {
  cn,
  getAllSupportedTimeZones,
  getTimeZoneOffsetFromTimeZoneString,
  parseFrappeErrorMsg,
} from "@/lib/utils";
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
import { getIconForKey, validTitle } from "./utils";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { MeetingData } from "./types";
import { disabledDays } from "../appointment/utils";
import SuccessAlert from "./components/successAlert";

const GroupAppointment = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date");
  const interview = searchParams.get("interview");
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [timeZone, setTimeZone] = useState<string>(getLocalTimezone());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<slotType>();
  const [expanded, setExpanded] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [appointmentScheduled, setAppointmentScheduled] = useState(false);
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
    appointment_group_id: "",
    valid_end_date: "",
    valid_start_date: "",
  });

  const {
    data,
    isLoading: dataIsLoading,
    error: fetchError,
    mutate,
  } = useFrappeGetCall(
    "frappe_appointment.api.group_meet.get_time_slots",
    {
      appointment_group_id: groupId,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(date ? new Date(date) : selectedDate),
      user_timezone_offset: String(
        getTimeZoneOffsetFromTimeZoneString(timeZone)
      ),
      interview: interview,
    },
    undefined,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const { call: bookMeeting, loading } = useFrappePostCall(
    "frappe_appointment.api.group_meet.book_time_slot"
  );

  useEffect(() => {
    if (data) {
      setMeetingData(data.message);
      const validData = data.message.is_invalid_date
        ? new Date(data.message.next_valid_date)
        : selectedDate;
      setSelectedDate(validData);
      setDisplayMonth(validData);
      updateDateQuery(validData);
    }
    if (fetchError) {
      navigate("/");
    }
  }, [data, fetchError, mutate, selectedDate, navigate]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const scheduleMeeting = () => {
    const extraArgs: Record<string, string> = {};
    searchParams.forEach((value, key) => (extraArgs[key] = value));
    const meetingData = {
      ...extraArgs,
      appointment_group_id: groupId,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(selectedDate),
      user_timezone_offset: String(
        getTimeZoneOffsetFromTimeZoneString(timeZone)
      ),
      start_time: selectedSlot!.start_time,
      end_time: selectedSlot!.end_time,
    };

    bookMeeting(meetingData)
      .then(() => {
        setAppointmentScheduled(true);
        mutate();
      })
      .catch((err) => {
        const error = parseFrappeErrorMsg(err);
        toast(error || "Something went wrong", {
          duration: 4000,
          classNames: {
            actionButton:
              "group-[.toast]:!bg-red-500 group-[.toast]:hover:!bg-red-300 group-[.toast]:!text-white",
          },
          icon: <CircleAlert className="h-5 w-5 text-red-500" />,
          action: {
            label: "OK",
            onClick: () => toast.dismiss(),
          },
        });
      });
  };

  return (
    <>
      <div className="w-full flex justify-center items-center">
        <div className="w-full xl:w-4/5 2xl:w-3/5 lg:py-16 p-6 px-4">
          <div className="h-fit flex w-full max-lg:flex-col md:border md:rounded-lg md:p-6 md:px-4 max-lg:gap-5 ">
            {/* Group Meet Details */}
            {!meetingData.appointment_group_id ? (
              <GroupMeetSkeleton />
            ) : (
              <div className="flex flex-col w-full lg:w-3/4 truncate gap-3 ">
                <Typography variant="h2" className="text-3xl font-semibold">
                  <Tooltip>
                    <TooltipTrigger className="text-left truncate w-full capitalize">
                      {validTitle(meetingData.appointment_group_id)}
                    </TooltipTrigger>
                    <TooltipContent className="capitalize">
                      {validTitle(meetingData.appointment_group_id)}
                    </TooltipContent>
                  </Tooltip>
                </Typography>
                {meetingData.meeting_details && (
                  <div className="w-full flex flex-col gap-2 mt-3">
                    {Object.entries(meetingData.meeting_details).map(
                      ([key, value]) => {
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
                                  <Typography
                                    className={cn(
                                      "truncate capitalize font-medium text-gray-600",
                                      key.includes("name") && "text-foreground"
                                    )}
                                  >
                                    {value}
                                  </Typography>
                                </TooltipTrigger>
                                <TooltipContent className="capitalize">
                                  <span className="text-blue-600">
                                    {validTitle(key)}
                                  </span>{" "}
                                  : {value}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
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
                    fromMonth={new Date(meetingData.valid_start_date)}
                    toMonth={new Date(meetingData.valid_end_date)}
                    disabled={(date) => {
                      const disabledDaysList =
                        disabledDays(meetingData.available_days) || [];
                      const isPastDate =
                        date.getTime() <
                        new Date(meetingData.valid_start_date)?.setHours(
                          0,
                          0,
                          0,
                          0
                        );
                      const isNextDate =
                        date.getTime() >
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
              <div className="h-14 fixed bottom-0 left-0 w-screen border z-10 bg-white border-top flex items-center justify-between px-4">
                <Button
                  variant="link"
                  className="text-blue-500 px-0"
                  onClick={() => setExpanded(false)}
                >
                  <ArrowLeft className="h-4 w-4 " />
                  Back
                </Button>
                <Button
                  disabled={
                    (selectedSlot?.start_time && selectedSlot?.end_time
                      ? false
                      : true) || loading
                  }
                  className={cn(
                    "bg-blue-400 flex hover:bg-blue-500 w-fit px-10",
                    "md:hidden"
                  )}
                  onClick={scheduleMeeting}
                >
                  {loading && <Spinner />}Schedule
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

              {dataIsLoading ? (
                <div className="h-full flex flex-col w-full mb-3 overflow-y-auto no-scrollbar space-y-2">
                  {Array.from({ length: 5 }).map((_, key) => (
                    <Skeleton key={key} className="w-full h-10" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="lg:h-[22rem] mb-3 overflow-y-auto no-scrollbar space-y-2">
                    {meetingData.all_available_slots_for_data.length > 0 ? (
                      meetingData.all_available_slots_for_data.map(
                        (slot, index) => (
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
                  <Button
                    disabled={loading}
                    className={cn(
                      "bg-blue-400 hover:bg-blue-500 lg:!mt-0 max-lg:w-full hidden",
                      selectedSlot?.start_time &&
                        selectedSlot.end_time &&
                        "flex",
                      "max-md:hidden"
                    )}
                    onClick={scheduleMeeting}
                  >
                    {loading && <Spinner />}Schedule
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <PoweredBy />
      {selectedSlot && (
        <SuccessAlert
          open={appointmentScheduled}
          setOpen={setAppointmentScheduled}
          selectedSlot={selectedSlot}
        />
      )}
    </>
  );
};

export default GroupAppointment;
