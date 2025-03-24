/**
 * External dependencies.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Error } from "frappe-js-sdk/lib/frappe_app/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getSiteName = () => {
  // eslint-disable-next-line
  // @ts-expect-error
  return window.frappe?.boot?.sitename ?? import.meta.env.VITE_SITE_NAME;
};

export const getErrorMessages = (error: Error) => {
  let eMessages = error?._server_messages
    ? JSON.parse(error?._server_messages)
    : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eMessages = eMessages.map((m: any) => {
    try {
      return JSON.parse(m);
    } catch (e) {
      return e;
    }
  });

  if (eMessages.length === 0) {
    // Get the message from the exception by removing the exc_type
    const index = error?.exception?.indexOf(":");
    if (index) {
      const exception = error?.exception?.slice(index + 1);
      if (exception) {
        eMessages = [
          {
            message: exception,
            title: "Error",
          },
        ];
      }
    }

    if (eMessages.length === 0) {
      eMessages = [
        {
          message: error?.message,
          title: "Error",
        },
      ];
    }
  }
  return eMessages;
};

export function removeHtmlString(data: string) {
  return data.replace(/<\/?[^>]+(>|$)/g, "");
}

export function parseFrappeErrorMsg(error: Error) {
  const messages = getErrorMessages(error);
  let message = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages.forEach((m: any) => {
    message += `${m.message}\n`;
  });
  if (message) {
    return removeHtmlString(message);
  } else {
    return "Something went wrong. Please try again later.";
  }
}

export function getTimeZoneOffsetFromTimeZoneString(timezone: string) {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  });

  const offsetString = formatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (!offsetString) {
    throw new Error("Unable to determine timezone offset");
  }

  // Handle cases where offsetString is just "GMT"
  if (offsetString === "GMT") {
    return 0;
  }

  const match = offsetString.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error(`Unexpected timezone format: ${offsetString}`);
  }

  const [, sign, hours, minutes] = match;
  return (
    (sign === "+" ? 1 : -1) * (parseInt(hours, 10) * 60 + parseInt(minutes, 10))
  );
}

export const getAllSupportedTimeZones = () => {
  return Intl.supportedValuesOf("timeZone") || [];
};

export const convertToMinutes = (duration: string) => {
  const [hours, minutes, seconds] = duration.split(":").map(Number);
  return String(hours * 60 + minutes + seconds / 60);
};

export const getLocalTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const capitalizeWords = (str: string) => {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Map days to numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
export const dayMapping: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

// Convert available days to disabled days
export const disabledDays = (availableDays?: string[]) => {
  if (!availableDays) return []; // Return an empty array if data isn't loaded yet

  return Object.values(dayMapping).filter(
    (dayNumber) => !availableDays.includes(Object.keys(dayMapping)[dayNumber])
  );
};

export const parseDateString = (dateString: string): Date => {
  const datePattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  if (!datePattern.test(dateString)) {
    return new Date();
  }
  const [, year, month, day] = dateString.match(datePattern)!;
  // Create a Date object using the extracted values
  // Note: JavaScript months are 0-based, so we subtract 1 from the month
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  ) {
    return date;
  } else {
    return new Date();
  }
};

// Converts Minute string to Hours and Minutes Format (HH:MM)
export const convertMinutesToTimeFormat = (
  minutes: number | string,
  useAbbrForMin: boolean = false
): string => {
  try {
    const totalMinutes =
      typeof minutes === "string" ? parseInt(minutes, 10) : minutes;
      
    if (isNaN(totalMinutes)) {
      throw new Error("Invalid input: Cannot convert to number");
    }

    // If minutes less than 60, return as is with "Minute" suffix
    if (totalMinutes < 60) {
      return `${totalMinutes} ${useAbbrForMin ? "min" : "Minute"}`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    const hoursStr = hours.toString().padStart(2, "0");
    const minutesStr = mins.toString().padStart(2, "0");

    return `${hoursStr}:${minutesStr} ${useAbbrForMin ? "hr" : "Hour"}`;
  } catch (error) {
    console.log(error);
    return "";
  }
};