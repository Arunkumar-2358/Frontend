import {
  LayoutDashboard, ListChecks, Users, Upload, PhoneOutgoing, PhoneMissed, ClipboardCheck, CalendarClock, Briefcase,
  CalendarCheck, Scale, Flag, BarChart3, Settings, Bell, UserRound, type LucideIcon,
} from "lucide-react";

export const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/tasks": ListChecks,
  "/notifications": Bell,
  "/leads": Users,
  "/import": Upload,
  "/queue": PhoneOutgoing,
  "/missed-calls": PhoneMissed,
  "/scrutiny": ClipboardCheck,
  "/availability": CalendarClock,
  "/vacancies": Briefcase,
  "/recruitment": CalendarCheck,
  "/evaluations": Scale,
  "/red-flags": Flag,
  "/kpi": BarChart3,
  "/profile": UserRound,
  "/admin": Settings,
};
