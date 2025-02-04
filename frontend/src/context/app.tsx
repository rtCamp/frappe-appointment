/**
 * External dependencies
 */
import React, { createContext, useContext, useState, ReactNode } from "react";

/**
 * Internal dependencies
 */
import { Profile } from "@/pages/appointment/components/socialProfiles";

// Define the types for the userInfo and MeetingProviderTypes
type MeetingProviderTypes = "Google Meet" | "Zoom";

interface UserInfo {
  name: string;
  designation: string;
  organizationName: string;
  userImage: string;
  socialProfiles: Profile[];
  meetingProvider: MeetingProviderTypes;
}

interface AppContextType {
  meetingId: string;
  duration: string;
  userInfo: UserInfo;
  selectedDate: Date;
  selectedSlot: string;
  timeZone: string;
  setMeetingId: (id: string) => void;
  setDuration: (duration: string) => void;
  setUserInfo: (userInfo: UserInfo) => void;
  setSelectedDate: (date: Date) => void;
  setSelectedSlot: (date: string) => void;
  setTimeZone: (tz: string) => void;
}

// Initial context values
const initialAppContextType: AppContextType = {
  meetingId: "",
  duration: "",
  selectedDate: new Date(),
  selectedSlot: "",
  timeZone: "",
  userInfo: {
    name: "",
    designation: "",
    organizationName: "",
    userImage: "",
    socialProfiles: [],
    meetingProvider: "Zoom",
  },
  setMeetingId: () => {},
  setDuration: () => {},
  setUserInfo: () => {},
  setSelectedDate: () => {},
  setSelectedSlot: () => {},
  setTimeZone: () => {},
};

// Create the context
const AppContext = createContext<AppContextType>(initialAppContextType);

// Provider component
export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [meetingId, setMeetingId] = useState<string>(
    initialAppContextType.meetingId
  );
  const [duration, setDuration] = useState<string>(
    initialAppContextType.duration
  );
  const [userInfo, setUserInfo] = useState<UserInfo>(
    initialAppContextType.userInfo
  );
  const [selectedSlot, setSelectedSlot] = useState<string>(
    initialAppContextType.selectedSlot
  );
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialAppContextType.selectedDate
  );
  const [timeZone, setTimeZone] = useState<string>(
    initialAppContextType.timeZone
  );

  return (
    <AppContext.Provider
      value={{
        meetingId,
        duration,
        userInfo,
        setMeetingId,
        setDuration,
        setUserInfo,
        selectedDate,
        selectedSlot,
        setSelectedDate,
        setSelectedSlot,
        timeZone,
        setTimeZone,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the context
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
