import {
  User2,
  Briefcase,
  CalendarIcon,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  FileText,
  Video,
  Tag,
  DollarSign,
  Home,
  ShoppingBag,
  ClipboardList,
  Globe,
  Building2,
  Users,
  HeartPulse,
  Lightbulb,
  Hammer,
  LucideIcon,
  LaptopMinimal,
} from "lucide-react";

const iconMap = new Map<string, LucideIcon>([
  // Personal Information
  ["name", User2],
  ["username", User2],
  ["full name", User2],
  ["nickname", User2],

  // Contact Details
  ["email", Mail],
  ["phone", Phone],
  ["mobile", Phone],
  ["contact", Phone],

  // Address & Location
  ["location", MapPin],
  ["address", Home],
  ["city", MapPin],
  ["state", MapPin],
  ["country", Globe],

  // Professional / Work-related
  ["job title", Briefcase],
  ["position", Briefcase],
  ["company", Building2],
  ["organization", Building2],
  ["department", Users],
  ["industry", ShoppingBag],

  // Scheduling & Events
  ["date", CalendarIcon],
  ["time", CalendarIcon],
  ["appointment", CalendarIcon],
  ["meeting", CalendarIcon],
  ["event", CalendarIcon],
  ["schedule", ClipboardList],
  ["interview round", LaptopMinimal],

  // Financial & Transactions
  ["salary", DollarSign],
  ["price", DollarSign],
  ["cost", DollarSign],
  ["budget", DollarSign],
  ["invoice", FileText],

  // Education & Learning
  ["education", GraduationCap],
  ["degree", GraduationCap],
  ["qualification", GraduationCap],
  ["course", GraduationCap],

  // Health & Wellness
  ["health", HeartPulse],
  ["medical", HeartPulse],
  ["doctor", HeartPulse],
  ["hospital", HeartPulse],

  // Skills & Experience
  ["experience", FileText],
  ["expertise", Lightbulb],
  ["skill", Lightbulb],
  ["project", ClipboardList],

  // Tools & Resources
  ["tool", Hammer],
  ["resource", Hammer],

  // Virtual / Online
  ["website", Globe],
  ["platform", Video],
  ["meeting provider", Video],
  ["video call", Video],

]);

export const getIconForKey = (key: string): LucideIcon => {
  const normalizedKey = key.toLowerCase();
  return iconMap.get(normalizedKey) || Tag; // Default to Tag if no matching icon
};

