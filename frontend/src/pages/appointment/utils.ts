

// Helper function to format the timezone offset
export function getTimeZoneOffset(timeZone: string) {
  try {
    const now = new Date();
    const tzString = new Date(now.toLocaleString("en-US", { timeZone }));
    const offsetMinutes = (tzString.getTime() - now.getTime()) / (1000 * 60);
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
    const remainingMinutes = Math.abs(Math.floor(offsetMinutes % 60));
    const sign = offsetMinutes >= 0 ? "+" : "-";
    return `GMT${sign}${String(offsetHours).padStart(2, "0")}:${String(
      remainingMinutes
    ).padStart(2, "0")}`;
  } catch (e) {
    console.log(e);
    return "";
  }
}

// Helper function to get current time in timezone
export function getCurrentTime(timeZone: string) {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (e) {
    console.log(e);
    return "";
  }
}

export const timeZones = [
  "Asia/Tbilisi",
  "Asia/Yerevan",
  "Asia/Kabul",
  "Asia/Tashkent",
  "Asia/Yekaterinburg",
  "Asia/Karachi",
  "Asia/Almaty",
  "Asia/Calcutta",
  "Asia/Colombo",
  "Asia/Katmandu",
  "Asia/Dhaka",
  "Asia/Omsk",
  "Asia/Rangoon",
  "Asia/Bangkok",
  "Asia/Barnaul",
];
