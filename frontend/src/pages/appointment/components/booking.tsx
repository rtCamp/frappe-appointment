/**
 * External dependencies.
 */
import { useEffect, useRef } from "react";
import { format, formatDate } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Calendar as CalendarIcon,
  ArrowLeft,
  Tag,
  CircleAlert,
} from "lucide-react";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

/**
 * Internal dependencies.
 */
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Typography from "@/components/ui/typography";
import {
  cn,
  convertToMinutes,
  getAllSupportedTimeZones,
  getTimeZoneOffsetFromTimeZoneString,
  parseDateString,
  parseFrappeErrorMsg,
} from "@/lib/utils";
import MeetingForm from "./meetingForm";
import { useAppContext } from "@/context/app";
import TimeSlotSkeleton from "./timeSlotSkeleton";
import TimeZoneSelect from "./timeZoneSelectmenu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Spinner from "@/components/ui/spinner";
import useBack from "@/hooks/useBack";
import SuccessAlert from "@/components/success-alert";
import { Icon } from "@/components/icons";
import { CalendarWrapper } from "@/components/calendar-wrapper";
import { useBookingReducer } from "../reducer";

interface BookingProp {
  type: string;
  banner: string;
}

const Booking = ({ type, banner }: BookingProp) => {
  const {
    userInfo,
    timeZone,
    duration,
    setDuration,
    setTimeZone,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    meetingId,
  } = useAppContext();
  const [state, dispatch] = useBookingReducer();
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const date = searchParams.get("date");
  const reschedule = searchParams.get("reschedule") || "";
  const event_token = searchParams.get("event_token") || "";

  const handleBackNavigation = () => {
    navigate(location.pathname, { replace: true });
  };

  useBack(handleBackNavigation);

  useEffect(() => {
    if (date) {
      setSelectedDate(parseDateString(date));
    }
  }, [date]);

  const updateDateQuery = (date: Date) => {
    const queries: Record<string, string> = {};
    searchParams.forEach((value, key) => (queries[key] = value));
    setSearchParams({
      ...queries,
      date: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
      type,
    });
  };

  const navigate = useNavigate();
  const { data, isLoading, error, mutate } = useFrappeGetCall(
    "frappe_scheduler.api.personal_meet.get_time_slots",
    {
      duration_id: type,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(date ? parseDateString(date) : selectedDate),
      user_timezone_offset: String(
        getTimeZoneOffsetFromTimeZoneString(timeZone || "Asia/Calcutta")
      ),
    },
    undefined,
    {
      revalidateOnFocus: false,
      errorRetryCount: 3,
    }
  );
  const { call: rescheduleMeeting, loading: rescheduleLoading } =
    useFrappePostCall("frappe_scheduler.api.personal_meet.book_time_slot");

  const onReschedule = () => {
    const extraArgs: Record<string, string> = {};
    searchParams.forEach((value, key) => (extraArgs[key] = value));

    const meetingData = {
      duration_id: type,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(selectedDate),
      user_timezone_offset: String(
        getTimeZoneOffsetFromTimeZoneString(timeZone)
      ),
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      user_name: "",
      user_email: "",
      other_participants: "",
      reschedule,
      event_token,
      ...extraArgs,
    };

    rescheduleMeeting(meetingData)
      .then((data) => {
        dispatch({ type: "SET_SHOW_MEETING_FORM", payload: false });
        dispatch({ type: "SET_EXPANDED", payload: false });
        mutate();
        dispatch({ type: "SET_BOOKING_RESPONSE", payload: data.message });
        dispatch({ type: "SET_APPOINTMENT_SCHEDULED", payload: true });
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

  useEffect(() => {
    if (data) {
      dispatch({ type: "SET_MEETING_DATA", payload: data.message });
      setDuration(convertToMinutes(data?.message?.duration).toString());
      const validData = data.message.is_invalid_date
        ? new Date(data.message.next_valid_date)
        : selectedDate;
      setSelectedDate(validData);
      updateDateQuery(validData);
      dispatch({ type: "SET_DISPLAY_MONTH", payload: validData });
    }
    if (error) {
      const err = parseFrappeErrorMsg(error);
      toast(err || "Something went wrong", {
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
    }
  }, [data, error, type, navigate, setDuration, dispatch, mutate]);

  const formatTimeSlot = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: state.timeFormat === "12h",
      timeZone,
    }).format(date);
  };

  useEffect(() => {
    const handleResize = () => {
      dispatch({ type: "SET_MOBILE_VIEW", payload: window.innerWidth <= 768 });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (containerRef.current && state.isMobileView) {
      containerRef.current.style.width = "100%";
    }
  }, [state.isMobileView]);

  return (
    <>
      <div className="w-full h-fit flex justify-center">
        <div className="md:w-4xl max-lg:w-full md:p-4 md:py-6 gap-10 md:gap-12">
          <div className="w-full rounded-xl rounded-b-none md:border border-blue-100 border-t-0">
            {/* Banner */}
            <div
              className={cn(
                "w-full md:rounded-xl md:rounded-b-none relative bg-blue-100 h-40 max-md:mb-20 md:mb-12",banner && `bg-cover bg-center bg-no-repeat bg-[url('${window.location.origin}${banner}')]`
              )}
            >
              {/* avatar */}
              <Avatar className="h-28 w-28 md:h-32 md:w-32 object-cover absolute bottom-0 translate-y-1/2 md:left-24 max-md:left-5 outline outline-white">
                <AvatarImage
                  src={userInfo.userImage}
                  alt="Profile picture"
                  className="bg-blue-50"
                />
                <AvatarFallback className="text-4xl">
                  {userInfo.name?.toString()[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            {/* Main */}
            <div className="w-full flex max-lg:flex-col max-md:p-4 gap-8 items-start overflow-hidden ">
              {/* Profile */}
              <div className="w-full md:max-w-sm flex flex-col gap-4 md:p-6 md:px-4">
                <div className="w-full flex flex-col gap-1">
                  <Typography variant="h2" className="text-3xl font-semibold">
                    <Tooltip>
                      <TooltipTrigger className="w-full truncate text-left">
                        {userInfo.name}
                      </TooltipTrigger>
                      <TooltipContent>{userInfo.name}</TooltipContent>
                    </Tooltip>
                  </Typography>
                  {userInfo.designation && userInfo.organizationName && (
                    <Typography className="text-base text-muted-foreground">
                      {userInfo.designation} at {userInfo.organizationName}
                    </Typography>
                  )}
                  {state.meetingData.label ? (
                    <Typography className="text-sm mt-1 flex items-center">
                      <Tag className="inline-block w-4 h-4 mr-1" />
                      {state.meetingData.label}
                    </Typography>
                  ) : (
                    <Skeleton className="h-5 w-20" />
                  )}
                  {duration ? (
                    <Typography className="text-sm mt-1 flex items-center">
                      <Clock className="inline-block w-4 h-4 mr-1" />
                      {duration} Minute Meeting
                    </Typography>
                  ) : (
                    <Skeleton className="h-5 w-24" />
                  )}
                  <Typography className="text-sm  mt-1 flex items-center">
                    <CalendarIcon className="inline-block w-4 h-4 mr-1" />
                    {formatDate(new Date(), "d MMM, yyyy")}
                  </Typography>
                  {userInfo.meetingProvider.toLowerCase() == "zoom" && (
                    <Typography className="text-sm text-blue-500 mt-1 flex items-center">
                      <Icon name="zoom" />
                      Zoom
                    </Typography>
                  )}{" "}
                  {userInfo.meetingProvider.toLowerCase() == "google meet" && (
                    <Typography className="text-sm text-blue-700 mt-1 flex items-center">
                      <Icon name="googleMeet" />
                      Google Meet
                    </Typography>
                  )}
                </div>
              </div>
              <div className="w-full md:max-h-[30rem] md:overflow-hidden">
                {/* Calendar and Availability slots */}
                <AnimatePresence mode="wait">
                  {!state.showMeetingForm && (
                    <motion.div
                      key={1}
                      initial={
                        state.isMobileView ? {} : { x: "-100%", opacity: 1 }
                      }
                      animate={{ x: 0, opacity: 1 }}
                      exit={
                        state.isMobileView ? {} : { x: "-100%", opacity: 0 }
                      }
                      transition={{
                        duration: 0.2,
                        ease: "easeInOut",
                      }}
                      className="w-full flex max-lg:flex-col gap-4 md:p-6 pb-5"
                    >
                      {(!state.isMobileView || !state.expanded) && (
                        <div className="flex flex-col w-full lg:w-[25rem] shrink-0">
                          <CalendarWrapper
                            displayMonth={state.displayMonth}
                            selectedDate={selectedDate}
                            loading={rescheduleLoading}
                            setDisplayMonth={(date) =>
                              dispatch({
                                type: "SET_DISPLAY_MONTH",
                                payload: date,
                              })
                            }
                            meetingData={{
                              valid_start_date:
                                state.meetingData.valid_start_date,
                              valid_end_date: state.meetingData.valid_end_date,
                              available_days: state.meetingData.available_days,
                            }}
                            setSelectedDate={setSelectedDate}
                            onDayClick={(date) => {
                              setSelectedDate(date);
                              updateDateQuery(date);
                              dispatch({
                                type: "SET_DISPLAY_MONTH",
                                payload: date,
                              });
                              dispatch({
                                type: "SET_EXPANDED",
                                payload: true,
                              });
                              dispatch({
                                type: "SET_SHOW_RESCHEDULE",
                                payload: false,
                              });
                              setSelectedSlot({
                                start_time: "",
                                end_time: "",
                              });
                            }}
                            className="rounded-xl md:border md:h-96 w-full flex md:px-6 p-0"
                          />
                          <div className="mt-4 gap-5 flex max-md:flex-col md:justify-between md:items-center ">
                            {/* Timezone */}

                            <TimeZoneSelect
                              timeZones={getAllSupportedTimeZones()}
                              setTimeZone={setTimeZone}
                              timeZone={timeZone}
                              disable={rescheduleLoading}
                            />

                            {/* Time Format Toggle */}
                            <div className="flex items-center gap-2">
                              <Typography className="text-sm text-gray-700">
                                AM/PM
                              </Typography>
                              <Switch
                                disabled={rescheduleLoading}
                                className="data-[state=checked]:bg-blue-500 active:ring-blue-400 focus-visible:ring-blue-400"
                                checked={state.timeFormat === "24h"}
                                onCheckedChange={(checked) => {
                                  dispatch({
                                    type: "SET_TIMEFORMAT",
                                    payload: checked ? "24h" : "12h",
                                  });
                                }}
                              />
                              <Typography className="text-sm text-gray-700">
                                24H
                              </Typography>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sticky Bottom Action Bar (Mobile) */}
                      {state.isMobileView && state.expanded && (
                        <div className="h-14 fixed bottom-0 left-0 w-screen border z-10 bg-white border-top flex items-center justify-between px-4">
                          <Button
                            variant="link"
                            className="text-blue-500 px-0"
                            onClick={() =>
                              dispatch({ type: "SET_EXPANDED", payload: false })
                            }
                            disabled={rescheduleLoading}
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                          </Button>
                          {state.showReschedule && (
                            <Button
                              className="bg-blue-500 hover:bg-blue-500 w-fit px-6"
                              onClick={onReschedule}
                              disabled={
                                rescheduleLoading || !state.showReschedule
                              }
                            >
                              {rescheduleLoading && <Spinner />} Reschedule
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Available slots */}
                      <div
                        className={cn(
                          "w-48 max-lg:w-full overflow-hidden space-y-4 max-md:pb-10  transition-all duration-300 ",
                          !state.expanded && "max-md:hidden",
                          state.showReschedule &&
                            "lg:flex lg:flex-col lg:justify-between"
                        )}
                      >
                        <h3 className="text-sm font-semibold lg:w-full">
                          {format(selectedDate, "EEEE, d MMMM yyyy")}
                        </h3>
                        {isLoading ? (
                          <TimeSlotSkeleton />
                        ) : (
                          <div
                            className={cn(
                              "lg:h-[22rem] overflow-y-auto no-scrollbar space-y-2 transition-transform transform",
                              state.showReschedule && "lg:!mt-0"
                            )}
                            style={{
                              transform: selectedDate
                                ? "translateX(0)"
                                : "translateX(-100%)",
                            }}
                          >
                            {state.meetingData.all_available_slots_for_data
                              .length > 0 ? (
                              state.meetingData.all_available_slots_for_data.map(
                                (slot, index) => (
                                  <Button
                                    disabled={rescheduleLoading}
                                    key={index}
                                    onClick={() => {
                                      if (reschedule && event_token) {
                                        dispatch({
                                          type: "SET_SHOW_RESCHEDULE",
                                          payload: true,
                                        });
                                      } else {
                                        dispatch({
                                          type: "SET_SHOW_MEETING_FORM",
                                          payload: true,
                                        });
                                      }
                                      setSelectedSlot({
                                        start_time: slot.start_time,
                                        end_time: slot.end_time,
                                      });
                                    }}
                                    variant="outline"
                                    className={cn(
                                      "w-full font-normal border border-blue-500 text-blue-500 hover:text-blue-500 ease-in-out duration-200 hover:bg-blue-50 transition-colors ",
                                      selectedSlot.start_time ===
                                        slot.start_time &&
                                        selectedSlot.end_time ===
                                          slot.end_time &&
                                        reschedule &&
                                        event_token &&
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
                        )}
                        {state.showReschedule && (
                          <Button
                            className="bg-blue-500 hover:bg-blue-500 lg:!mt-0 max-lg:w-full max-md:hidden"
                            onClick={onReschedule}
                            disabled={rescheduleLoading}
                          >
                            {rescheduleLoading && <Spinner />} Reschedule
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )}
                  {state.showMeetingForm && (
                    <MeetingForm
                      key={2}
                      onSuccess={(data) => {
                        dispatch({
                          type: "SET_SHOW_MEETING_FORM",
                          payload: false,
                        });
                        dispatch({ type: "SET_EXPANDED", payload: false });
                        mutate();
                        dispatch({
                          type: "SET_BOOKING_RESPONSE",
                          payload: data.message,
                        });
                        dispatch({
                          type: "SET_APPOINTMENT_SCHEDULED",
                          payload: true,
                        });
                      }}
                      onBack={() => {
                        dispatch({
                          type: "SET_SHOW_MEETING_FORM",
                          payload: false,
                        });
                        dispatch({ type: "SET_EXPANDED", payload: false });
                        mutate();
                      }}
                      durationId={type}
                      isMobileView={state.isMobileView}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
      {selectedSlot?.start_time && (
        <SuccessAlert
          open={state.appointmentScheduled}
          setOpen={(open) =>
            dispatch({ type: "SET_APPOINTMENT_SCHEDULED", payload: open })
          }
          selectedSlot={selectedSlot}
          onClose={() => {
            navigate(`/in/${meetingId}`);
          }}
          meetingProvider={state.bookingResponse.meeting_provider}
          meetLink={state.bookingResponse.meet_link}
          rescheduleLink={state.bookingResponse.reschedule_url}
          calendarString={state.bookingResponse.google_calendar_event_url}
          disableClose={false}
        />
      )}
    </>
  );
};

export default Booking;
