/**
 * External dependencies.
 */
import { useReducer } from "react";
/**
 * Internal dependencies.
 */
import { TimeFormat } from "./types";
import { BookingResponseType } from "@/lib/types";

interface MeetingData {
  all_available_slots_for_data: any[];
  available_days: any[];
  date: string;
  duration: number;
  endtime: string;
  is_invalid_date: boolean;
  next_valid_date: string;
  prev_valid_date: string;
  starttime: string;
  total_slots_for_day: number;
  user: string;
  valid_end_date: string;
  valid_start_date: string;
  label: string;
}

interface State {
  timeFormat: TimeFormat;
  expanded: boolean;
  isMobileView: boolean;
  showMeetingForm: boolean;
  showReschedule: boolean;
  appointmentScheduled: boolean;
  bookingResponse: BookingResponseType;
  displayMonth: Date;
  meetingData: MeetingData;
}

type Action =
  | { type: "SET_TIMEFORMAT"; payload: TimeFormat }
  | { type: "SET_EXPANDED"; payload: boolean }
  | { type: "SET_MOBILE_VIEW"; payload: boolean }
  | { type: "SET_SHOW_MEETING_FORM"; payload: boolean }
  | { type: "SET_SHOW_RESCHEDULE"; payload: boolean }
  | { type: "SET_APPOINTMENT_SCHEDULED"; payload: boolean }
  | { type: "SET_BOOKING_RESPONSE"; payload: BookingResponseType }
  | { type: "SET_DISPLAY_MONTH"; payload: Date }
  | { type: "SET_MEETING_DATA"; payload: MeetingData };

const initialState: State = {
  timeFormat: "12h",
  expanded: false,
  isMobileView: false,
  showMeetingForm: false,
  showReschedule: false,
  appointmentScheduled: false,
  bookingResponse: {
    event_id: "",
    meet_link: "",
    meeting_provider: "",
    message: "",
    reschedule_url: "",
    google_calendar_event_url: "",
  },
  displayMonth: new Date(),
  meetingData: {
    all_available_slots_for_data: [],
    available_days: [],
    date: "",
    duration: 0,
    endtime: "",
    is_invalid_date: true,
    next_valid_date: "",
    prev_valid_date: "",
    starttime: "",
    total_slots_for_day: 0,
    user: "",
    valid_end_date: "",
    valid_start_date: "",
    label: "",
  },
};

const actionHandlers: Record<
  Action["type"],
  (state: State, payload: any) => State
> = {
  SET_TIMEFORMAT: (state, payload) => ({ ...state, timeFormat: payload }),
  SET_EXPANDED: (state, payload) => ({ ...state, expanded: payload }),
  SET_MOBILE_VIEW: (state, payload) => ({ ...state, isMobileView: payload }),
  SET_SHOW_MEETING_FORM: (state, payload) => ({
    ...state,
    showMeetingForm: payload,
  }),
  SET_SHOW_RESCHEDULE: (state, payload) => ({
    ...state,
    showReschedule: payload,
  }),
  SET_APPOINTMENT_SCHEDULED: (state, payload) => ({
    ...state,
    appointmentScheduled: payload,
  }),
  SET_BOOKING_RESPONSE: (state, payload) => ({
    ...state,
    bookingResponse: payload,
  }),
  SET_DISPLAY_MONTH: (state, payload) => ({ ...state, displayMonth: payload }),
  SET_MEETING_DATA: (state, payload) => ({ ...state, meetingData: payload }),
};

const reducer = (state: State, action: Action): State => {
  const handler = actionHandlers[action.type];
  return handler ? handler(state, action.payload) : state;
};

export function useBookingReducer() {
  return useReducer(reducer, initialState);
}
