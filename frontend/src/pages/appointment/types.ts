export type TimeFormat = "12h" | "24h";

export interface MeetingData {
  all_available_slots_for_data: any[]; // Define a more specific type if possible
  available_days: string[]; // Array of weekdays
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
  label:string;
}
