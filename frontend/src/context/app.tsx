/**
 * External dependencies
 */
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useSyncExternalStore,
} from "react";

/**
 * Internal dependencies
 */
import { Profile } from "@/pages/appointment/components/socialProfiles";
import NetworkDisconnect from "@/components/network-disconnect";
import { ThemeProvider } from "@/components/theme-provider";

// Define the types for the userInfo and MeetingProviderTypes
type MeetingProviderTypes = "Google Meet" | "Zoom";

interface UserInfo {
  name: string;
  designation: string;
  organizationName: string;
  userImage: string;
  socialProfiles: Profile[];
  meetingProvider: MeetingProviderTypes;
  banner_image:string;
}

type durationCard = {
  id: string;
  label: string;
  duration: number;
};

export interface slotType {
  start_time: string;
  end_time: string;
}

interface AppContextType {
  meetingId: string;
  duration: number;
  userInfo: UserInfo;
  selectedDate: Date;
  selectedSlot: slotType;
  timeZone: string;
  meetingDurationCards: durationCard[];
  setMeetingId: (id: string) => void;
  setDuration: (duration: number) => void;
  setUserInfo: (userInfo: UserInfo) => void;
  setSelectedDate: (date: Date) => void;
  setSelectedSlot: (slot: slotType) => void;
  setTimeZone: (tz: string) => void;
  setMeetingDurationCards: (duration_card: durationCard[]) => void;
}

// Initial context values
const initialAppContextType: AppContextType = {
  meetingId: "",
  duration: 0,
  selectedDate: new Date(),
  selectedSlot: { end_time: "", start_time: "" },
  timeZone: "",
  meetingDurationCards: [],
  userInfo: {
    name: "",
    designation: "",
    organizationName: "",
    userImage: "",
    socialProfiles: [],
    meetingProvider: "Zoom",
    banner_image:"",
  },
  setMeetingId: () => {},
  setDuration: () => {},
  setUserInfo: () => {},
  setSelectedDate: () => {},
  setSelectedSlot: () => {},
  setTimeZone: () => {},
  setMeetingDurationCards: () => {},
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
  const [duration, setDuration] = useState<number>(
    initialAppContextType.duration
  );
  const [userInfo, setUserInfo] = useState<UserInfo>(
    initialAppContextType.userInfo
  );
  const [selectedSlot, setSelectedSlot] = useState<slotType>(
    initialAppContextType.selectedSlot
  );
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialAppContextType.selectedDate
  );
  const [timeZone, setTimeZone] = useState<string>(
    initialAppContextType.timeZone
  );
  const [meetingDurationCards, setMeetingDurationCards] = useState<
    durationCard[]
  >(initialAppContextType.meetingDurationCards);

  // network

  const getSnapshot = () => {
    return navigator.onLine;
  };

  const subscribe = (callback: () => void) => {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
      window.removeEventListener("online", callback);
      window.removeEventListener("offline", callback);
    };
  };

  const isOnline = useSyncExternalStore(subscribe, getSnapshot);

  if (!isOnline) {
    return <NetworkDisconnect />;
  }

  return (
    <AppContext.Provider
      value={{
        meetingId,
        userInfo,
        duration,
        setMeetingId,
        setDuration,
        setUserInfo,
        selectedDate,
        selectedSlot,
        setSelectedDate,
        setSelectedSlot,
        timeZone,
        setTimeZone,
        meetingDurationCards,
        setMeetingDurationCards,
      }}
    >
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        {children}
      </ThemeProvider>
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
