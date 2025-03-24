// Helper function to format the timezone offset
export const getTimeZoneOffset = (timeZone: string): string => {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });

    const parts = formatter.formatToParts(now);
    let offsetPart = parts.find((part) => part.type === "timeZoneName")?.value;

    if (!offsetPart) return "";

    // Ensure "GMT" has an explicit offset (e.g., "GMT+00:00")
    if (offsetPart === "GMT") {
      offsetPart = "GMT+00:00";
    }

    // Extract offset sign and numbers using regex
    const match = offsetPart.match(/GMT([+-]?)(\d+)?(?::(\d+))?/);
    if (!match) return "";

    const sign = match[1] || "+";
    const hours = match[2] ? match[2].padStart(2, "0") : "00";
    const minutes = match[3] ? match[3].padStart(2, "0") : "00";

    return `GMT${sign}${hours}:${minutes}`;
  } catch (e) {
    console.error(e);
    return "";
  }
};

// Helper function to get current time in timezone
export const getCurrentTime = (timeZone: string) => {
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
