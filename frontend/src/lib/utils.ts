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
  // Create a date object
  const date = new Date();

  // Use Intl.DateTimeFormat to get the timezone offset in the format "GMT+hh:mm" or "GMT-hh:mm"
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  });

  // Extract the timezone offset string (e.g., "GMT+05:30")
  const offsetString = formatter
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  if (!offsetString) {
    throw new Error('Unable to determine timezone offset');
  }

  // Parse the offset string to get the offset in minutes
  const [_, sign, hours, minutes] = offsetString.match(/GMT([+-])(\d{2}):(\d{2})/) || [];
  const offsetInMinutes = (sign === '+' ? 1 : -1) * (parseInt(hours, 10) * 60 + parseInt(minutes, 10));

  return offsetInMinutes;
}

export const convertToMinutes = (duration:string) => {
  const [hours, minutes, seconds] = duration.split(":").map(Number);
  return String(hours * 60 + minutes + seconds / 60);
};

export const getLocalTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};