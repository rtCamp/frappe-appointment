/**
 * /schedule — set up personal (1:1) meetings without Desk.
 * Writes the same two records the Desk flow uses: Google Calendar and User Appointment Availability.
 */
import { ComponentType, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock, ExternalLink, Globe, Lock, LogIn, Share2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/skeleton";
import MetaTags from "@/components/meta-tags";
import NotFound from "@/pages/notFound";
import { cn } from "@/lib/utils";
import { AVAILABILITY, AvailabilityDoc, CalendarInfo, DAYS, errorText, useOnboardingApi } from "./api";
import { Notice, blueButton } from "./ui";
import { readSessionUser } from "./session";
import CalendarStep from "./steps/calendarStep";
import HoursStep from "./steps/hoursStep";
import BookingStep from "./steps/bookingStep";
import DoneStep from "./steps/doneStep";

/** "Mon–Fri", "Mon, Wed, Fri" … */
const summarizeDays = (availability: AvailabilityDoc | null) => {
  const on = DAYS.filter((d) => availability?.appointment_time_slot?.some((r) => r.day === d));
  if (!on.length) return "Not set";
  if (on.length === 7) return "Every day";
  const idx = on.map((d) => DAYS.indexOf(d));
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const short = (d: string) => d.slice(0, 3);
  return consecutive && on.length > 2 ? `${short(on[0])}–${short(on[on.length - 1])}` : on.map(short).join(", ");
};

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  status: string;
  done: boolean;
  locked: boolean;
  lockedHint: string;
};

const Setup = () => {
  // The booking pages send visitors here when a link is broken; keep showing them the 404 page.
  const [cameFromBrokenLink] = useState(() => (window.history.state?.idx ?? 0) > 0);

  const api = useOnboardingApi();
  const sessionUser = useMemo(readSessionUser, []);
  const [timeZone, setTimeZone] = useState(sessionUser?.timeZone ?? "");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDoc | null>(null);
  const [availabilityLocked, setAvailabilityLocked] = useState(false);
  const [defaultTemplate, setDefaultTemplate] = useState<string | null>(null);
  const [section, setSection] = useState(0);

  const load = useCallback(
    async (opts: { pickSection?: boolean } = {}) => {
      if (!sessionUser) return;
      setLoadError(null);
      try {
        const [st, cals, templates] = await Promise.all([
          api.getStatus(sessionUser.name),
          api.listCalendars(sessionUser.name),
          api.getDefaultTemplates().catch(() => ({ personal: null })),
        ]);
        let avail: AvailabilityDoc | null = null;
        let locked = false;
        if (st.user_appointment_availability) {
          try {
            avail = await api.getAvailability(st.user_appointment_availability);
          } catch {
            locked = true;
          }
        }
        setCalendars(cals);
        setDefaultTemplate(templates.personal ?? null);
        setAvailability(avail);
        setAvailabilityLocked(locked);

        const preferred =
          (avail && cals.find((c) => c.name === avail?.google_calendar)?.name) ||
          cals.find((c) => c.custom_is_google_calendar_authorized && c.enable)?.name ||
          cals[0]?.name ||
          null;
        setSelectedCalendar((current) => (current && cals.some((c) => c.name === current) ? current : preferred));

        if (opts.pickSection) {
          const cal = cals.find((c) => c.name === preferred);
          const connected = !!cal?.custom_is_google_calendar_authorized && !!cal?.enable;
          if (!connected) setSection(0);
          else if (!avail) setSection(1);
          else if (!avail.enable_scheduling || !avail.slug || !avail.available_durations?.length) setSection(2);
          else setSection(3);
        }
      } catch (err) {
        setLoadError(errorText(err));
      } finally {
        setLoading(false);
      }
    },
    [api, sessionUser]
  );

  useEffect(() => {
    if (cameFromBrokenLink) return;
    if (sessionUser) load({ pickSection: true });
    else setLoading(false);
  }, [cameFromBrokenLink, sessionUser, load]);

  const selected = calendars.find((c) => c.name === selectedCalendar) ?? null;
  const calendarConnected = !!selected?.custom_is_google_calendar_authorized && !!selected?.enable;
  const bookingLive = !!availability?.enable_scheduling && !!availability?.slug;

  const onConnected = useCallback(
    async (calendar: string) => {
      const firstTime = !availability;
      setSelectedCalendar(calendar);
      await load();
      if (firstTime) setSection(1);
    },
    [availability, load]
  );

  if (cameFromBrokenLink) return <NotFound />;

  const nav: NavItem[] = [
    {
      label: "Google Calendar",
      icon: CalendarDays,
      status: calendarConnected ? "Connected" : selected ? "Not connected" : "Not set up",
      done: calendarConnected,
      locked: false,
      lockedHint: "",
    },
    {
      label: "Working hours",
      icon: Clock,
      status: availability ? summarizeDays(availability) : "Not set",
      done: !!availability?.appointment_time_slot?.length,
      locked: !calendarConnected,
      lockedHint: "Connect your calendar first",
    },
    {
      label: "Booking page",
      icon: Globe,
      status: bookingLive ? "Live" : availability?.slug ? "Turned off" : "Not set up",
      done: bookingLive,
      locked: !calendarConnected || !availability,
      lockedHint: "Set your working hours first",
    },
    {
      label: "Share",
      icon: Share2,
      status: bookingLive ? "Your link is ready" : "Not ready yet",
      done: false,
      locked: !calendarConnected || !availability,
      lockedHint: "Set your working hours first",
    },
  ];

  const ready = !!sessionUser && sessionUser.userType === "System User" && !loading && !loadError && !availabilityLocked;
  const deskLink = availability
    ? `/desk/${AVAILABILITY.toLowerCase().replace(/ /g, "-")}/${encodeURIComponent(availability.name)}`
    : "/desk";

  let content;
  if (!sessionUser) {
    content = (
      <div className="flex flex-col gap-6 max-w-md">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Set up your booking page</h1>
          <p className="text-muted-foreground">
            Connect your calendar, choose when you're free, and get a link people can use to book time with you.
          </p>
        </div>
        <Button asChild className={cn(blueButton, "w-fit rounded-full px-6")}>
          <a href={`/login?redirect-to=${encodeURIComponent(window.location.pathname)}`}>
            <LogIn /> Log in to continue
          </a>
        </Button>
      </div>
    );
  } else if (sessionUser.userType !== "System User") {
    content = (
      <Notice tone="amber" title="Your account can't set up a booking page yet">
        Booking pages are for employee accounts. Ask your admin to give your account Desk access, then come back to
        this page.
      </Notice>
    );
  } else if (loading) {
    content = (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-lg" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  } else if (loadError) {
    content = (
      <Notice
        tone="red"
        title="Couldn't load your setup"
        actions={
          <Button size="sm" className={blueButton} onClick={() => load({ pickSection: true })}>
            Try again
          </Button>
        }
      >
        {loadError}
      </Notice>
    );
  } else if (availabilityLocked) {
    content = (
      <Notice tone="amber" title="Your availability was set up by someone else">
        An admin created your availability record, so it can only be changed in Desk. Ask them to update it, or to
        share it with you.
      </Notice>
    );
  } else {
    content = (
      <>
        {section === 0 && (
          <CalendarStep
            api={api}
            user={sessionUser.name}
            calendars={calendars}
            selected={selected}
            onSelect={setSelectedCalendar}
            onConnected={onConnected}
          />
        )}
        {section === 1 && selected && (
          <HoursStep
            key={availability?.name ?? "new"}
            api={api}
            user={sessionUser.name}
            calendar={selected.name}
            timeZone={timeZone}
            availability={availability}
            onSaved={(doc, tz) => {
              const firstTime = !availability;
              setAvailability(doc);
              setTimeZone(tz);
              if (firstTime) setSection(2);
            }}
          />
        )}
        {section === 2 && availability && (
          <BookingStep
            key={availability.name}
            api={api}
            availability={availability}
            fullName={sessionUser.fullName}
            defaultTemplate={defaultTemplate}
            onSaved={(doc) => {
              const wasLive = bookingLive;
              setAvailability(doc);
              if (!wasLive && doc.enable_scheduling) setSection(3);
            }}
          />
        )}
        {section === 3 && availability && <DoneStep availability={availability} onGoTo={setSection} />}
      </>
    );
  }

  return (
    <>
      <MetaTags title="Set up your booking page | Appointment" description="Set up your booking page" />
      <div className="min-h-screen w-full flex max-md:flex-col bg-background">
        {/* Sidebar */}
        <aside className="md:w-72 md:shrink-0 md:h-screen md:sticky md:top-0 flex flex-col md:border-r border-blue-100 dark:border-zinc-800 bg-gradient-to-b from-blue-50 to-transparent dark:from-zinc-900">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 max-md:pr-24">
            <img src="/assets/frappe_appointment/frappe-appointment-logo.png" alt="" className="h-7 w-7" />
            <span className="font-semibold text-lg">Appointments</span>
          </div>

          {sessionUser && (
            <div className="hidden md:flex items-center gap-3 mx-3 mb-4 rounded-xl p-3 bg-white/70 dark:bg-zinc-800/60 border border-blue-100 dark:border-zinc-800">
              <Avatar className="h-10 w-10">
                <AvatarImage src={sessionUser.image ?? undefined} alt="" className="bg-blue-50 dark:bg-zinc-800" />
                <AvatarFallback>{sessionUser.fullName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{sessionUser.fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{sessionUser.name}</p>
              </div>
            </div>
          )}

          {ready && (
            <nav aria-label="Setup sections" className="max-md:border-b border-blue-100 dark:border-zinc-800">
              <ul className="flex md:flex-col gap-1 px-3 max-md:pb-3 max-md:overflow-x-auto">
                {nav.map((item, i) => {
                  const Icon = item.icon;
                  const active = section === i;
                  return (
                    <li key={item.label} className="max-md:shrink-0">
                      <button
                        type="button"
                        disabled={item.locked}
                        aria-current={active ? "page" : undefined}
                        title={item.locked ? item.lockedHint : undefined}
                        onClick={() => setSection(i)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                          active
                            ? "bg-blue-100/70 text-blue-600 dark:bg-blue-800/20 dark:text-blue-400"
                            : "hover:bg-blue-50 dark:hover:bg-zinc-800",
                          item.locked && "opacity-50 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent"
                        )}
                      >
                        <span
                          className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                            item.done
                              ? "bg-blue-500 text-white dark:bg-blue-400 dark:text-zinc-900"
                              : active
                                ? "bg-white text-blue-500 border border-blue-200 dark:bg-zinc-900 dark:border-blue-400/50 dark:text-blue-400"
                                : "bg-white text-muted-foreground border border-blue-100 dark:bg-zinc-900 dark:border-zinc-700"
                          )}
                        >
                          {item.done ? <Check className="h-4 w-4" /> : item.locked ? <Lock className="h-3.5 w-3.5" /> : <Icon className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium whitespace-nowrap">{item.label}</span>
                          <span
                            className={cn(
                              "block text-xs truncate max-md:hidden",
                              active ? "text-blue-500/80 dark:text-blue-400/80" : "text-muted-foreground"
                            )}
                          >
                            {item.locked ? item.lockedHint : item.status}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          {ready && (
            <div className="hidden md:flex flex-col gap-2 mt-auto p-5 text-sm">
              {bookingLive && availability?.slug && (
                <a
                  href={`/schedule/in/${availability.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-blue-500 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> View my booking page
                </a>
              )}
              {sessionUser?.roles.includes("System Manager") && (
                // A full page load, so the broken-link check above doesn't see a history entry.
                <a href="/schedule/admin" className="text-muted-foreground hover:text-foreground hover:underline">
                  Set up Appointments for your team
                </a>
              )}
              <a href={deskLink} className="text-muted-foreground hover:text-foreground hover:underline">
                Open full settings in Desk
              </a>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 py-6 md:px-10 md:py-12">{content}</div>
        </main>
      </div>
    </>
  );
};

export default Setup;
