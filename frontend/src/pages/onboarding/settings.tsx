/**
 * Settings, opened from the app menu: the booking page (on/off, link, confirmation email), the Google
 * Calendar it reads and writes, and video calls. Switches and pickers save straight away; typed values
 * have a Save button.
 */
import { ReactNode, useContext, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, LoaderCircle, X } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import { AVAILABILITY, Availability, CalendarInfo, GOOGLE_CALENDAR, errorText, isConnected, slotsAsText } from "./api";
import GoogleConnectNotices from "./google-connect-notices";
import OtherCalendar from "./other-calendar";
import SlugField from "./slug-field";
import { Button, Notice, Pill, Switch } from "./ui";
import { useGoogleConnect } from "./use-google-connect";
import { useSlugCheck } from "./use-slug-check";
import VideoPicker from "./video-picker";
import { isEmail, isMeetingLink, providersFor, savedProviderOf } from "./video";

export type SettingsTab = "booking" | "calendar" | "video";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "booking", label: "Booking page" },
  { id: "calendar", label: "Calendar" },
  { id: "video", label: "Video calls" },
];

const EMAIL_TEMPLATE = "Email Template";

/** A setting: what it is on the left, its control on the right. */
const Row = ({ title, description, children, last }: { title: ReactNode; description?: string; children?: ReactNode; last?: boolean }) => (
  <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4", !last && "border-b border-outline-gray-1")}>
    <span className="flex flex-col gap-1 flex-[1_1_200px] min-w-0">
      <span className="text-es-base font-medium text-ink-gray-8">{title}</span>
      {description && <span className="text-es-p-sm text-ink-gray-6">{description}</span>}
    </span>
    {children}
  </div>
);

/** Saves part of the booking page. Every save sends the time slots back as text (see slotsAsText). */
const useAvailabilitySave = (availability: Availability, onChanged: () => Promise<void>) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async (what: string, values: Record<string, unknown>) => {
    setBusy(what);
    setError(null);
    try {
      await db.updateDoc(AVAILABILITY, availability.name, { ...values, appointment_time_slot: slotsAsText(availability) });
      await onChanged();
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, save };
};

const BookingTab = ({ availability, onChanged }: { availability: Availability; onChanged: () => Promise<void> }) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const { busy, error, save } = useAvailabilitySave(availability, onChanged);
  const savedSlug = availability.slug ?? "";
  const [slug, setSlug] = useState(savedSlug);
  const slugCheck = useSlugCheck(slug, savedSlug);
  const [templates, setTemplates] = useState<string[] | null>(null);

  useEffect(() => {
    db.getDocList<{ name: string }>(EMAIL_TEMPLATE, { fields: ["name"], orderBy: { field: "name", order: "asc" }, limit: 500 })
      .then((list) => setTemplates(list.map((t) => t.name)))
      .catch(() => setTemplates([]));
  }, [db]);

  const template = availability.response_email_template ?? "";
  const options = templates && template && !templates.includes(template) ? [template, ...templates] : templates ?? [];

  return (
    <>
      <Row title="Accept bookings" description="Turn off to hide your booking page. Group meetings you're part of still work.">
        <Switch
          checked={!!availability.enable_scheduling}
          onChange={(on) => save("accepting", { enable_scheduling: on ? 1 : 0 })}
          label="Accept bookings"
          disabled={busy === "accepting"}
        />
      </Row>

      <div className="flex flex-col gap-1.5 py-4 border-b border-outline-gray-1">
        <label htmlFor="settings-slug" className="text-es-base font-medium text-ink-gray-8">
          Booking link
        </label>
        <span className="text-es-p-sm text-ink-gray-6">Changing it stops your old link from working.</span>
        <div className="flex flex-col gap-1.5 mt-1.5">
          <SlugField
            id="settings-slug"
            value={slug}
            onChange={setSlug}
            check={slugCheck}
            action={
              <Button
                variant="solid"
                onClick={() => save("slug", { slug: slug.trim() })}
                disabled={slug.trim() === savedSlug || !slugCheck.ok || busy === "slug"}
              >
                {busy === "slug" && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Save
              </Button>
            }
          />
        </div>
      </div>

      <Row title="Confirmation email" description="The email people get after they book." last>
        <span className="relative w-[220px] max-w-full">
          <select
            aria-label="Confirmation email"
            value={template}
            disabled={!templates || busy === "template"}
            onChange={(e) => save("template", { response_email_template: e.target.value })}
            className="w-full h-7 pl-2 pr-7 appearance-none truncate rounded-lg border border-transparent bg-surface-gray-2 text-es-base text-ink-gray-8 cursor-pointer hover:bg-surface-gray-3 focus:outline-none focus:border-outline-gray-4 focus:shadow-es-focus disabled:cursor-wait"
          >
            {!template && (
              <option value="" disabled>
                Choose an email
              </option>
            )}
            {options.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
        </span>
      </Row>

      {error && (
        <Notice tone="red" title="Couldn't save your booking page">
          {error}
        </Notice>
      )}
    </>
  );
};

const CalendarTab = ({
  user,
  calendar,
  onChanged,
}: {
  user: string;
  calendar: CalendarInfo | null;
  onChanged: () => Promise<void>;
}) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const google = useGoogleConnect({ user, calendar, onChanged });
  const connected = isConnected(calendar);

  // A blank calendar ID means the main calendar; the server stores the user's email for it.
  const savedCalendarId = calendar?.google_calendar_id && calendar.google_calendar_id !== user ? calendar.google_calendar_id : "";
  const [calendarId, setCalendarId] = useState(savedCalendarId);
  const [otherOpen, setOtherOpen] = useState(!!savedCalendarId);
  const ignoreAllDay = calendar ? !!calendar.custom_ignore_all_day_events : true;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveCalendar = async (what: string, values: Record<string, unknown>) => {
    if (!calendar) return;
    setBusy(what);
    setError(null);
    try {
      await db.updateDoc(GOOGLE_CALENDAR, calendar.name, values);
      await onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 border-b border-outline-gray-1">
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0 bg-surface-gray-2 text-ink-gray-7">
            <CalendarDays className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-1 min-w-0">
            <span className="flex items-center gap-2 text-es-base font-medium text-ink-gray-8">
              Google Calendar
              {google.waiting ? (
                <Pill>Waiting for Google</Pill>
              ) : connected ? (
                <Pill tone="green">Connected</Pill>
              ) : (
                <Pill tone="amber">Not connected</Pill>
              )}
            </span>
            <span className="text-es-sm text-ink-gray-5 truncate">{calendar?.google_calendar_id || user}</span>
          </span>
        </span>
        <Button
          variant={connected ? "subtle" : "solid"}
          onClick={() => google.connect({ ignoreAllDay, calendarId: savedCalendarId, savedCalendarId })}
          disabled={google.busy || google.waiting}
        >
          {google.busy && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {connected ? "Reconnect" : "Connect"}
        </Button>
      </div>

      <Row title="Ignore all-day events" description="Holidays and reminders on your calendar won't hide your free time.">
        <Switch
          checked={ignoreAllDay}
          onChange={(on) => saveCalendar("all-day", { custom_ignore_all_day_events: on ? 1 : 0 })}
          label="Ignore all-day events"
          disabled={!calendar || busy === "all-day"}
        />
      </Row>

      <div className="flex flex-col gap-3 py-3">
        <OtherCalendar
          user={user}
          value={calendarId}
          onChange={setCalendarId}
          open={otherOpen}
          onToggle={() => setOtherOpen((v) => !v)}
          action={
            <Button
              variant="solid"
              className="self-start"
              onClick={() => saveCalendar("calendar-id", { google_calendar_id: calendarId.trim() })}
              disabled={!calendar || calendarId.trim() === savedCalendarId || busy === "calendar-id"}
            >
              {busy === "calendar-id" && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          }
        />
      </div>

      <GoogleConnectNotices user={user} google={google} />
      {error && (
        <Notice tone="red" title="Couldn't save your calendar settings">
          {error}
        </Notice>
      )}
    </>
  );
};

const VideoTab = ({
  user,
  availability,
  calendar,
  zoomReady,
  onChanged,
}: {
  user: string;
  availability: Availability;
  calendar: CalendarInfo | null;
  zoomReady: boolean;
  onChanged: () => Promise<void>;
}) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const { busy, error, save } = useAvailabilitySave(availability, onChanged);
  const [zoomError, setZoomError] = useState<string | null>(null);
  const savedProvider = savedProviderOf(availability);
  const savedLink = availability.meeting_link ?? "";
  const savedZoomEmail = calendar?.custom_zoom_user_email || user;
  const [provider, setProvider] = useState(savedProvider);
  const [meetingLink, setMeetingLink] = useState(savedLink);
  const [zoomEmail, setZoomEmail] = useState(savedZoomEmail);

  const zoomOff = provider === "Zoom" && !zoomReady;
  const changed =
    provider !== savedProvider ||
    (provider === "Custom" && meetingLink.trim() !== savedLink) ||
    (provider === "Zoom" && zoomEmail.trim() !== (calendar?.custom_zoom_user_email ?? ""));
  const valid =
    (provider !== "Custom" || isMeetingLink(meetingLink)) && (provider !== "Zoom" || (isEmail(zoomEmail) && !!calendar)) && !zoomOff;

  const submit = async () => {
    setZoomError(null);
    if (provider === "Zoom" && calendar && zoomEmail.trim() !== (calendar.custom_zoom_user_email ?? "")) {
      try {
        await db.updateDoc(GOOGLE_CALENDAR, calendar.name, { custom_zoom_user_email: zoomEmail.trim() });
      } catch (err) {
        setZoomError(errorText(err));
        return;
      }
    }
    await save("video", { meeting_provider: provider, meeting_link: provider === "Custom" ? meetingLink.trim() : "" });
  };

  return (
    <div className="flex flex-col gap-3 pt-3">
      <span className="text-es-p-sm text-ink-gray-6">Added to every meeting people book with you.</span>
      <VideoPicker
        hideLegend
        providers={providersFor(zoomReady, savedProvider)}
        provider={provider}
        onProvider={setProvider}
        meetingLink={meetingLink}
        onMeetingLink={setMeetingLink}
        zoomEmail={zoomEmail}
        onZoomEmail={setZoomEmail}
        zoomOff={zoomOff}
      />
      {(error || zoomError) && (
        <Notice tone="red" title="Couldn't save your video calls">
          {error || zoomError}
        </Notice>
      )}
      <div className="flex justify-end">
        <Button variant="solid" onClick={submit} disabled={!changed || !valid || !!busy}>
          {busy && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Save
        </Button>
      </div>
    </div>
  );
};

const SettingsDialog = ({
  user,
  availability,
  calendar,
  zoomReady,
  tab,
  onTab,
  onChanged,
  onClose,
}: {
  user: string;
  availability: Availability;
  calendar: CalendarInfo | null;
  zoomReady: boolean;
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Escape closes Settings before anything open underneath it, like the Meeting types drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const title = TABS.find((t) => t.id === tab)?.label;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6 max-sm:p-0 bg-black/30"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="espresso font-espresso w-[860px] max-w-full h-[600px] max-sm:h-full max-h-full flex max-sm:flex-col overflow-hidden rounded-2xl max-sm:rounded-none bg-surface-elevation-1 text-ink-gray-8 shadow-es-2xl outline-none"
      >
        <nav
          aria-label="Settings"
          className="w-[220px] max-sm:w-full shrink-0 flex flex-col max-sm:flex-row max-sm:items-center gap-0.5 px-2 py-3 max-sm:py-2 max-sm:overflow-x-auto bg-surface-sidebar border-r max-sm:border-r-0 max-sm:border-b border-outline-gray-1 box-border"
        >
          <h2 id="settings-title" className="m-0 mb-2 px-2 py-1 text-es-lg font-semibold text-ink-gray-9 max-sm:sr-only">
            Settings
          </h2>
          <span className="flex items-center h-7 px-2 text-es-sm text-ink-gray-5 max-sm:hidden">Your booking page</span>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={t.id === tab ? "page" : undefined}
              onClick={() => onTab(t.id)}
              className={cn(
                "flex items-center h-7 px-2 rounded-lg border-0 text-es-base text-left whitespace-nowrap cursor-pointer",
                "focus-visible:outline-none focus-visible:shadow-es-focus",
                t.id === tab
                  ? "bg-surface-elevation-3 shadow-es-sm text-ink-gray-8"
                  : "bg-transparent text-ink-gray-6 hover:bg-surface-gray-3"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 px-6 pt-5 max-sm:px-4 max-sm:pt-4">
            <h3 className="m-0 text-es-title text-ink-gray-8">{title}</h3>
            <Button variant="ghost" className="w-7 px-0" aria-label="Close" onClick={onClose}>
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pt-2 pb-8 max-sm:px-4 flex flex-col">
            {tab === "booking" && <BookingTab availability={availability} onChanged={onChanged} />}
            {tab === "calendar" && <CalendarTab user={user} calendar={calendar} onChanged={onChanged} />}
            {tab === "video" && (
              <VideoTab user={user} availability={availability} calendar={calendar} zoomReady={zoomReady} onChanged={onChanged} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
