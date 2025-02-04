export type TimeFormat = "12h" | "24h";

export interface AvailabilitySlot {
  startTime: string; // ISO string
  endTime: string;
  isAvailable: boolean;
}

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  slots: AvailabilitySlot[];
}

export interface UserProfile {
  name: string;
  title: string;
  company: string;
  location: string;
  avatar: string;
  meetingDuration: number;
}
