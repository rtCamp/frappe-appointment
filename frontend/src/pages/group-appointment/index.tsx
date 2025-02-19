/**
 * External dependencies
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, CircleAlert, Clock } from "lucide-react";
import { toast } from "sonner";

/**
 * Internal dependencies
 */
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Typography from "@/components/ui/typography";
import {
  capitalizeWords,
  cn,
  convertToMinutes,
  getAllSupportedTimeZones,
  getTimeZoneOffsetFromTimeZoneString,
  parseDateString,
  parseFrappeErrorMsg,
} from "@/lib/utils";
import { TimeFormat } from "../appointment/types";
import { Button } from "@/components/ui/button";
import PoweredBy from "@/components/powered-by";
import { Switch } from "@/components/ui/switch";
import TimeZoneSelect from "../appointment/components/timeZoneSelectmenu";
import Spinner from "@/components/ui/spinner";
import GroupMeetSkeleton from "./components/groupMeetSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { getIconForKey, validTitle } from "./utils";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import SuccessAlert from "@/components/success-alert";
import MetaTags from "@/components/meta-tags";
import { CalendarWrapper } from "@/components/calendar-wrapper";
import { useMeetingReducer } from "./reducer";

const GroupAppointment = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date");
  const reschedule = searchParams.get("reschedule") || "";
  const event_token = searchParams.get("event_token") || "";
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [state, dispatch] = useMeetingReducer();

  const {
    data,
    isLoading: dataIsLoading,
    error: fetchError,
    mutate,
  } = useFrappeGetCall(
    "frappe_scheduler.api.group_meet.get_time_slots",
    {
      ...Object.fromEntries(searchParams),
      appointment_group_id: groupId,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(date ? parseDateString(date) : state.selectedDate),
      user_timezone_offset: String(
        getTimeZoneOffsetFromTimeZoneString(state.timeZone)
      ),
    },
    undefined,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const { call: bookMeeting, loading } = useFrappePostCall(
    "frappe_scheduler.api.group_meet.book_time_slot"
  );

  useEffect(() => {
    if (data) {
      dispatch({ type: "SET_MEETING_DATA", payload: data.message });
      const validData = data.message.is_invalid_date
        ? new Date(data.message.next_valid_date)
        : state.selectedDate;
      dispatch({ type: "SET_SELECTED_DATE", payload: validData });
      dispatch({ type: "SET_DISPLAY_MONTH", payload: validData });
      updateDateQuery(validData);
    }
    if (fetchError) {
      navigate("/");
    }
  }, [data, fetchError, mutate, navigate, dispatch]);

  useEffect(() => {
    if (
      state.meetingData.booked_slot &&
      Object.keys(state.meetingData.booked_slot).length > 0
    ) {
      dispatch({ type: "SET_APPOINTMENT_SCHEDULED", payload: true });
      dispatch({
        type: "SET_SELECTED_SLOT",
        payload: {
          start_time: state.meetingData.booked_slot.start_time,
          end_time: state.meetingData.booked_slot.end_time,
        },
      });
      dispatch({
        type: "SET_BOOKING_RESPONSE",
        payload: {
          meet_link: state.meetingData.booked_slot.meet_link,
          meeting_provider: state.meetingData.booked_slot.meeting_provider,
          reschedule_url: state.meetingData.booked_slot.reschedule_url,
          google_calendar_event_url:
            state.meetingData.booked_slot.google_calendar_event_url,
          message: "Event scheduled",
          event_id: state.meetingData.booked_slot.reschedule_url,
        },
      });
    }
  }, [state.meetingData.booked_slot]);

  useEffect(() => {
    const handleResize = () => {
      dispatch({ type: "SET_MOBILE_VIEW", payload: window.innerWidth <= 768 });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (date) {
      const dateObj = parseDateString(date);
      dispatch({ type: "SET_SELECTED_DATE", payload: dateObj });
      dispatch({ type: "SET_DISPLAY_MONTH", payload: dateObj });
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
      timeZone: state.timeZone,
    }).format(date);
  };

  const scheduleMeeting = () => {
    const meetingData = {
      ...Object.fromEntries(searchParams),
      appointment_group_id: groupId,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(state.selectedDate),
      user_timezone_offset: String(
        getTimeZoneOffsetFromTimeZoneString(state.timeZone)
      ),
      start_time: state.selectedSlot!.start_time,
      end_time: state.selectedSlot!.end_time,
    };

    bookMeeting(meetingData)
      .then((data) => {
        dispatch({ type: "SET_BOOKING_RESPONSE", payload: data.message });
        dispatch({ type: "SET_APPOINTMENT_SCHEDULED", payload: true });
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
      <MetaTags
        title={`${
          capitalizeWords(validTitle(state.meetingData.appointment_group_id)) ||
          "Group"
        } | Scheduler`}
        description={`Book appointment with ${validTitle(
          state.meetingData.appointment_group_id
        )}`}
        // keywords="Group appointment"
        // author={state.meetingData.appointment_group_id}
        // robots="index, follow"
        // ogTitle={`${
        //   capitalizeWords(validTitle(state.meetingData.appointment_group_id)) ||
        //   "Group"
        // } | Scheduler`}
        // ogDescription={`Book appointment with ${validTitle(
        //   state.meetingData.appointment_group_id
        // )}`}
        // twitterCard="summary_large_image"
        // twitterTitle={`${
        //   capitalizeWords(validTitle(state.meetingData.appointment_group_id)) ||
        //   "Group"
        // } | Scheduler`}
        // twitterDescription={`Book appointment with ${validTitle(
        //   state.meetingData.appointment_group_id
        // )}`}
      />
      <div className="w-full flex justify-center items-center">
        <div className="w-full xl:w-4/5 2xl:w-3/5 lg:py-16 p-6 px-4">
          <div className="h-fit flex w-full max-lg:flex-col md:border md:rounded-lg md:p-6 md:px-4 max-lg:gap-5 ">
            {/* Group Meet Details */}
            {!state.meetingData.appointment_group_id ? (
              <GroupMeetSkeleton />
            ) : (
              <div className="flex flex-col w-full lg:w-3/4 gap-3 ">
                <Typography
                  variant="h2"
                  className="text-3xl font-semibold text-left w-full capitalize"
                >
                  {validTitle(state.meetingData.appointment_group_id)}
                </Typography>
                {state.meetingData && (
                  <div className="w-full flex flex-col gap-2 mt-3">
                    {state.meetingData.meeting_details &&
                      Object.entries(state.meetingData.meeting_details).map(
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
                                        "truncate font-medium text-gray-600",
                                        key.includes("name") &&
                                          "text-foreground",
                                        key.includes("email")
                                          ? ""
                                          : "capitalize"
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
                    <div className="flex cursor-default items-center gap-2 w-full ">
                      <div className="w-full truncate text-gray-600 flex items-center justify-start gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        <Tooltip>
                          <TooltipTrigger className="text-left truncate">
                            <Typography className="truncate font-medium text-gray-600">
                              {convertToMinutes(
                                state.meetingData.duration
                              ).toString()}{" "}
                              Minute Meeting
                            </Typography>
                          </TooltipTrigger>
                          <TooltipContent className="capitalize">
                            <span className="text-blue-600">duration</span> :{" "}
                            {convertToMinutes(
                              state.meetingData.duration
                            ).toString()}{" "}
                            Minute Meeting
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <hr className="w-full bg-muted md:hidden" />
            {(!state.isMobileView || !state.expanded) && (
              <div className="flex flex-col w-full lg:max-w-96">
                {/* Calendar View */}
                <div className="w-full">
                  <CalendarWrapper
                    displayMonth={state.displayMonth}
                    selectedDate={state.selectedDate}
                    loading={loading}
                    setDisplayMonth={(date) =>
                      dispatch({ type: "SET_DISPLAY_MONTH", payload: date })
                    }
                    meetingData={{
                      valid_start_date: state.meetingData.valid_start_date,
                      valid_end_date: state.meetingData.valid_end_date,
                      available_days: state.meetingData.available_days,
                    }}
                    setSelectedDate={(date) =>
                      dispatch({ type: "SET_SELECTED_DATE", payload: date })
                    }
                    onDayClick={(date) => {
                      dispatch({ type: "SET_SELECTED_DATE", payload: date });
                      dispatch({ type: "SET_DISPLAY_MONTH", payload: date });
                      dispatch({ type: "SET_EXPANDED", payload: true });
                      dispatch({
                        type: "SET_SELECTED_SLOT",
                        payload: {
                          start_time: "",
                          end_time: "",
                        },
                      });
                      updateDateQuery(date);
                    }}
                    className="rounded-md md:border md:h-96 w-full flex lg:px-6 lg:p-2 p-0"
                  />
                </div>
                <div className="w-full mt-4 gap-5 flex max-md:flex-col md:justify-between md:items-center ">
                  {/* Timezone */}

                  <TimeZoneSelect
                    timeZones={getAllSupportedTimeZones()}
                    setTimeZone={(tz) =>
                      dispatch({ type: "SET_TIMEZONE", payload: tz })
                    }
                    timeZone={state.timeZone}
                    disable={loading}
                  />

                  {/* Time Format Toggle */}
                  <div className="flex items-center gap-2">
                    <Typography className="text-sm text-gray-700">
                      AM/PM
                    </Typography>
                    <Switch
                      disabled={loading}
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
            {state.isMobileView && state.expanded && (
              <div className="h-14 fixed bottom-0 left-0 w-screen border z-10 bg-white border-top flex items-center justify-between px-4">
                <Button
                  variant="link"
                  className="text-blue-500 px-0"
                  onClick={() =>
                    dispatch({ type: "SET_EXPANDED", payload: false })
                  }
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4 " />
                  Back
                </Button>
                <Button
                  disabled={
                    (state.selectedSlot?.start_time &&
                    state.selectedSlot?.end_time
                      ? false
                      : true) || loading
                  }
                  className={cn(
                    "bg-blue-500 flex hover:bg-blue-500 w-fit px-10",
                    "md:hidden"
                  )}
                  onClick={scheduleMeeting}
                >
                  {loading && <Spinner />}
                  {reschedule && event_token ? "Reschedule" : "Schedule"}
                </Button>
              </div>
            )}
            {/* Available Slots */}
            <div
              className={cn(
                "w-full flex flex-col lg:w-1/2 gap-2 lg:px-5",
                !state.expanded && "max-md:hidden"
              )}
            >
              <Typography
                variant="h3"
                className="text-sm font-semibold lg:w-full truncate"
              >
                {format(state.selectedDate, "EEEE, d MMMM yyyy")}
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
                    {state.meetingData.all_available_slots_for_data.length >
                    0 ? (
                      state.meetingData.all_available_slots_for_data.map(
                        (slot, index) => (
                          <Button
                            key={index}
                            onClick={() => {
                              dispatch({
                                type: "SET_SELECTED_SLOT",
                                payload: {
                                  start_time: slot.start_time,
                                  end_time: slot.end_time,
                                },
                              });
                            }}
                            disabled={loading}
                            variant="outline"
                            className={cn(
                              "w-full font-normal border border-blue-500 text-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-colors ",
                              state.selectedSlot?.start_time ===
                                slot.start_time &&
                                state.selectedSlot?.end_time ===
                                  slot.end_time &&
                                "bg-blue-500 text-white hover:bg-blue-500 hover:text-white"
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
                      "bg-blue-500 hover:bg-blue-500 lg:!mt-0 max-lg:w-full hidden",
                      state.selectedSlot?.start_time &&
                        state.selectedSlot.end_time &&
                        "flex",
                      "max-md:hidden"
                    )}
                    onClick={scheduleMeeting}
                  >
                    {loading && <Spinner />}
                    {reschedule && event_token ? "Reschedule" : "Schedule"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <PoweredBy />
      {state.selectedSlot?.start_time && (
        <SuccessAlert
          open={state.appointmentScheduled}
          setOpen={(open) =>
            dispatch({ type: "SET_APPOINTMENT_SCHEDULED", payload: open })
          }
          selectedSlot={state.selectedSlot}
          meetingProvider={state.bookingResponse.meeting_provider}
          meetLink={state.bookingResponse.meet_link}
          rescheduleLink={state.bookingResponse.reschedule_url}
          calendarString={state.bookingResponse.google_calendar_event_url}
          disableClose={
            state.meetingData.booked_slot &&
            Object.keys(state.meetingData.booked_slot).length > 0
              ? true
              : false
          }
        />
      )}
    </>
  );
};

export default GroupAppointment;
