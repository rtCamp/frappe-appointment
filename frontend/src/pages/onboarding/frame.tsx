/**
 * The page around the setup steps: a sidebar with the app menu and the (still locked) app
 * sections, and a header with the step count.
 */
import { ComponentType, ReactNode, useContext, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  Clock,
  House,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { useTheme } from "@/components/theme-provider";
import { BASE_ROUTE } from "@/lib/constant";
import { cn } from "@/lib/utils";
import { SessionUser } from "./api";

const menuItemClass =
  "flex items-center gap-2 h-7 px-2 rounded-lg text-es-base text-ink-gray-8 no-underline bg-transparent border-0 cursor-pointer text-left w-full hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:bg-surface-gray-2";

const AppMenu = ({ user }: { user: SessionUser }) => {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { call } = useContext(FrappeContext) as FrappeConfig;
  const ref = useRef<HTMLDivElement>(null);

  const isDark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const logout = async () => {
    try {
      await call.post("logout");
    } finally {
      window.location.assign(BASE_ROUTE);
    }
  };

  return (
    <div ref={ref} className="w-full">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 w-full h-10 px-1.5 rounded-lg border-0 text-left cursor-pointer text-inherit",
          "focus-visible:outline-none focus-visible:shadow-es-focus",
          open ? "bg-surface-gray-3" : "bg-transparent hover:bg-surface-gray-3"
        )}
      >
        <span className="w-7 h-7 rounded-md grid place-items-center shrink-0 bg-surface-gray-10 text-ink-base">
          <CalendarDays className="w-4 h-4" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-es-base font-medium text-ink-gray-8">Appointments</span>
          <span className="text-es-sm text-ink-gray-6 truncate">{user.fullName}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-ink-gray-7" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="App menu"
          className="absolute z-20 top-[46px] left-2 w-[232px] p-1 rounded-xl bg-surface-elevation-2 shadow-es-2xl flex flex-col"
        >
          <div className="flex items-center gap-2 p-2">
            <span className="w-7 h-7 rounded-full grid place-items-center shrink-0 bg-surface-blue-2 text-ink-blue-7 text-es-sm font-medium">
              {user.fullName[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 flex flex-col gap-0.5">
              <span className="text-es-base font-medium text-ink-gray-8 truncate">{user.fullName}</span>
              <span className="text-es-sm text-ink-gray-5 truncate">{user.name}</span>
            </span>
          </div>
          <div className="h-px my-1 bg-outline-gray-1" />
          <a role="menuitem" href="/apps" className={menuItemClass}>
            <LayoutGrid className="w-4 h-4 text-ink-gray-6" aria-hidden="true" />
            Apps
          </a>
          <a role="menuitem" href="/desk" className={menuItemClass}>
            <ArrowLeftRight className="w-4 h-4 text-ink-gray-6" aria-hidden="true" />
            Switch to Desk
          </a>
          <button role="menuitem" type="button" className={menuItemClass} onClick={() => {
              setTheme(isDark ? "light" : "dark");
              setOpen(false);
            }}>
            {isDark ? (
              <Sun className="w-4 h-4 text-ink-gray-6" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-ink-gray-6" aria-hidden="true" />
            )}
            Toggle theme
          </button>
          <div className="h-px my-1 bg-outline-gray-1" />
          <button role="menuitem" type="button" className={menuItemClass} onClick={logout}>
            <LogOut className="w-4 h-4 text-ink-gray-6" aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
};

const LOCKED_SECTIONS: { label: string; icon: ComponentType<{ className?: string }> }[] = [
  { label: "Home", icon: House },
  { label: "Meeting types", icon: List },
  { label: "Availability", icon: Clock },
];

export const Frame = ({
  user,
  title = "Getting started",
  stepLabel,
  wide,
  children,
}: {
  user: SessionUser;
  title?: string;
  stepLabel?: string;
  /** 960px instead of 640px, for pages with a side list like the admin guide. */
  wide?: boolean;
  children: ReactNode;
}) => (
  <div className="espresso font-espresso min-h-screen flex flex-wrap bg-surface-base text-ink-gray-8">
    <nav
      aria-label="Main"
      className="relative flex flex-col bg-surface-sidebar border-r border-outline-gray-1"
      style={{ flex: "1 1 224px" }}
    >
      <div className="h-12 flex items-center px-1">
        <AppMenu user={user} />
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-1">
        {LOCKED_SECTIONS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            disabled
            title="Available once you finish setting up"
            className="flex items-center gap-2 h-7 px-2 rounded-lg border-0 bg-transparent text-es-base text-ink-gray-4 cursor-not-allowed"
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span className="flex-1 text-left">{label}</span>
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </nav>

    <main className="flex flex-col min-w-0" style={{ flex: "999 1 560px" }}>
      <header className="min-h-12 flex items-center justify-between gap-2 px-5 border-b border-outline-gray-1">
        <h1 className="m-0 text-es-lg font-semibold text-ink-gray-9">{title}</h1>
        {stepLabel && <span className="text-es-sm tabular-nums text-ink-gray-5">{stepLabel}</span>}
      </header>
      <div
        className={cn(
          "w-full mx-auto px-5 pb-12 box-border flex flex-col",
          wide ? "max-w-[960px] pt-8 gap-7" : "max-w-[640px] pt-10 gap-8"
        )}
      >
        {children}
      </div>
    </main>
  </div>
);
