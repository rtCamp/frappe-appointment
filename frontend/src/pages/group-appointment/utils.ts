/**
 * External dependencies
 */
import {
  User2,
  Briefcase,
  CalendarIcon,
  Video,
  Tag,
  LucideIcon,
  LaptopMinimal,
} from "lucide-react";

const iconMap = new Map<string, LucideIcon>([
  // Personal Information
  ["name", User2],

  // Professional / Work-related
  ["job title", Briefcase],
  ["position", Briefcase],

  // Scheduling & Events
  ["date", CalendarIcon],
  ["time", CalendarIcon],
  ["interview round", LaptopMinimal],

  // Virtual / Online
  ["meeting provider", Video],
  ["video call", Video],
]);

export const getIconForKey = (key: string): LucideIcon => {
  const normalizedKey = key.toLowerCase();
  return iconMap.get(normalizedKey) || Tag; // Default to Tag if no matching icon
};
