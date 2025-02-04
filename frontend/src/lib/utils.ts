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

  // Get the timezone offset in minutes using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
  });

  // Extract the timezone offset
  const offsetInHours = parseInt(formatter.format(date), 10) - date.getUTCHours();
  const offsetInMinutes = offsetInHours * 60;

  return offsetInMinutes;
}