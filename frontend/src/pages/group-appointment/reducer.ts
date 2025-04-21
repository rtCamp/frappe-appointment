/**
 * External dependencies
 */
import { useReducer } from "react";

/**
 * Internal dependencies
 */
import { getLocalTimezone, parseDateString } from "@/lib/utils";
import { slotType } from "@/context/app";
import { MeetingData } from "./types";
import { BookingResponseType } from "@/lib/types";

interface State {
  timeZone: string;
  selectedDate: Date;
  displayMonth: Date;
  selectedSlot?: slotType;
  expanded: boolean;
  isMobileView: boolean;
  appointmentScheduled: boolean;
  meetingData: MeetingData;
  bookingResponse: BookingResponseType;
}

type Action =
  | { type: "SET_TIMEZONE"; payload: string }
  | { type: "SET_SELECTED_DATE"; payload: Date }
  | { type: "SET_DISPLAY_MONTH"; payload: Date }
  | { type: "SET_SELECTED_SLOT"; payload: slotType | undefined }
  | { type: "SET_EXPANDED"; payload: boolean }
  | { type: "SET_MOBILE_VIEW"; payload: boolean }
  | { type: "SET_APPOINTMENT_SCHEDULED"; payload: boolean }
  | { type: "SET_MEETING_DATA"; payload: MeetingData }
  | { type: "SET_BOOKING_RESPONSE"; payload: BookingResponseType };

const actionHandlers: Record<
  Action["type"],
  (state: State, payload: any) => State
> = {
  SET_TIMEZONE: (state, payload) => ({ ...state, timeZone: payload }),
  SET_SELECTED_DATE: (state, payload) => ({ ...state, selectedDate: payload }),
  SET_DISPLAY_MONTH: (state, payload) => ({ ...state, displayMonth: payload }),
  SET_SELECTED_SLOT: (state, payload) => ({ ...state, selectedSlot: payload }),
  SET_EXPANDED: (state, payload) => ({ ...state, expanded: payload }),
  SET_MOBILE_VIEW: (state, payload) => ({ ...state, isMobileView: payload }),
  SET_APPOINTMENT_SCHEDULED: (state, payload) => ({
    ...state,
    appointmentScheduled: payload,
  }),
  SET_MEETING_DATA: (state, payload) => ({ ...state, meetingData: payload }),
  SET_BOOKING_RESPONSE: (state, payload) => ({
    ...state,
    bookingResponse: payload,
  }),
};

const reducer = (state: State, action: Action): State => {
  const handler = actionHandlers[action.type];
  return handler ? handler(state, action.payload) : state;
};

const initialState: State = {
  timeZone: getLocalTimezone(),
  selectedDate: new Date(),
  displayMonth: parseDateString(""),
  selectedSlot: undefined,
  expanded: false,
  isMobileView: false,
  appointmentScheduled: false,
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
    appointment_group_id: "",
    valid_end_date: "",
    valid_start_date: "",
  },
  bookingResponse: {
    event_id: "",
    meet_link: "",
    meeting_provider: "",
    message: "",
    reschedule_url: "",
    google_calendar_event_url: "",
  },
};

export function useMeetingReducer() {
  return useReducer(reducer, initialState);
}
