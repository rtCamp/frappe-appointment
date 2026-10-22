/**
 * Step 3: the booking page itself, saved to User Appointment Availability: the link (slug),
 * the video call provider (and the Zoom email on the user's Google Calendar), and the
 * meeting types (available_durations). Finishing turns the booking page on.
 */
import { useContext, useEffect, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import {
  AVAILABILITY,
  Availability,
  CalendarInfo,
  DEFAULT_EMAIL_TEMPLATES,
  GOOGLE_CALENDAR,
  IS_SLUG_AVAILABLE,
  MeetingType,
  SLUG_PATTERN,
  errorText,
  isNotYours,
  slotsAsText,
  slugify,
} from "../api";
import { Button, Notice, StepHeader } from "../ui";

type Provider = "Google Meet" | "Zoom" | "Custom" | "None";

const PROVIDERS: { id: Provider; title: string; description: string }[] = [
  { id: "Google Meet", title: "Google Meet", description: "A new Meet link for every booking." },
  { id: "Zoom", title: "Zoom", description: "A new Zoom meeting for every booking." },
  { id: "Custom", title: "My own link", description: "The same Zoom, Teams or Meet room each time." },
  { id: "None", title: "No video link", description: "For phone calls or meeting in person." },
];

const LENGTHS = [15, 30, 45, 60, 90, 120];
const minutesLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)} hr ${m % 60} min`);

/** Values a new meeting type starts with: the doctype's defaults. */
const NEW_TYPE_DEFAULTS = {
  minimum_buffer_time: null,
  availability_window: null,
  limit_booking_frequency: -1,
  minimum_notice_before_event: 0,
  allow_rescheduling: 1 as const,
  minimum_notice_for_reschedule: null,
};

interface TypeRow {
  key: number;
  title: string;
  minutes: number;
  /** The saved row, so its breaks, notice and rescheduling settings go back unchanged. */
  saved?: MeetingType;
}

let nextKey = 0;
const row = (title: string, minutes: number, saved?: MeetingType): TypeRow => ({ key: ++nextKey, title, minutes, saved });

type SlugState = "same" | "checking" | "available" | "taken" | "invalid" | "empty";

const fieldClass =
  "h-7 px-2 rounded-lg border border-transparent bg-surface-gray-2 text-es-base text-ink-gray-8 placeholder:text-ink-gray-4 hover:bg-surface-gray-3 focus:outline-none focus:bg-surface-base focus:border-outline-gray-4 focus:shadow-es-focus";

const BookingStep = ({
  user,
  fullName,
  calendar,
  availability,
  zoomReady,
  onSaved,
  onBack,
}: {
  user: string;
  fullName: string;
  calendar: CalendarInfo;
  availability: Availability;
  zoomReady: boolean;
  onSaved: () => Promise<void>;
  onBack: () => void;
}) => {
  const { call, db } = useContext(FrappeContext) as FrappeConfig;
  const savedSlug = availability.slug ?? "";

  const [slug, setSlug] = useState(savedSlug || slugify(fullName) || slugify(user.split("@")[0]));
  const [slugState, setSlugState] = useState<SlugState>("checking");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // Frappe fills an unset Select with its first option ("None"), so a booking page that was never set up
  // starts on Google Meet instead. A link alone doesn't mean it was set up: new records fetch the username.
  const setUpBefore = !!availability.enable_scheduling || availability.available_durations.length > 0;
  const savedProvider = (setUpBefore ? availability.meeting_provider || "Google Meet" : "Google Meet") as Provider;
  // Zoom stays selectable if it's already saved, so turning Zoom off on the site doesn't silently change it.
  const providers = PROVIDERS.filter((p) => p.id !== "Zoom" || zoomReady || savedProvider === "Zoom");
  const [provider, setProvider] = useState<Provider>(savedProvider);
  const [meetingLink, setMeetingLink] = useState(availability.meeting_link ?? "");
  const [zoomEmail, setZoomEmail] = useState(calendar.custom_zoom_user_email || user);

  const [types, setTypes] = useState<TypeRow[]>(() =>
    availability.available_durations.length
      ? availability.available_durations.map((d) => row(d.title, Math.round(d.duration / 60), d))
      : [row("Quick chat", 15), row("Meeting", 30)]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check the link as it's typed. The server counts the user's own saved link as taken, so skip that one.
  useEffect(() => {
    const value = slug.trim();
    if (!value) return setSlugState("empty");
    if (!SLUG_PATTERN.test(value)) return setSlugState("invalid");
    if (value === savedSlug) return setSlugState("same");
    setSlugState("checking");
    let stale = false;
    const id = window.setTimeout(async () => {
      try {
        const { message } = await call.get(IS_SLUG_AVAILABLE, { slug: value });
        if (stale) return;
        setSuggestion(message.suggested_slug ?? null);
        setSlugState(message.is_available ? "available" : "taken");
      } catch {
        if (!stale) setSlugState("available");
      }
    }, 400);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
  }, [slug, savedSlug, call]);

  const setType = (key: number, change: Partial<TypeRow>) =>
    setTypes((current) => current.map((t) => (t.key === key ? { ...t, ...change } : t)));

  const linkOk = slugState === "same" || slugState === "available";
  const meetingLinkOk = provider !== "Custom" || /^https?:\/\/\S+$/.test(meetingLink.trim());
  const zoomEmailOk = provider !== "Zoom" || /^\S+@\S+\.\S+$/.test(zoomEmail.trim());
  const typesOk = types.length > 0 && types.every((t) => t.title.trim());
  const zoomOff = provider === "Zoom" && !zoomReady;
  const canFinish = linkOk && meetingLinkOk && zoomEmailOk && typesOk && !zoomOff;

  const finish = async () => {
    setError(null);
    setSaving(true);
    try {
      if (provider === "Zoom" && zoomEmail.trim() !== (calendar.custom_zoom_user_email ?? "")) {
        await db.updateDoc(GOOGLE_CALENDAR, calendar.name, { custom_zoom_user_email: zoomEmail.trim() });
      }
      // New records get the site's default confirmation email, as the Desk form does.
      const template =
        availability.response_email_template || (await call.get(DEFAULT_EMAIL_TEMPLATES)).message?.personal || null;
      await db.updateDoc(AVAILABILITY, availability.name, {
        enable_scheduling: 1,
        slug: slug.trim(),
        meeting_provider: provider,
        meeting_link: provider === "Custom" ? meetingLink.trim() : "",
        response_email_template: template,
        available_durations: types.map((t) => {
          const kept = t.saved
            ? {
                name: t.saved.name,
                minimum_buffer_time: t.saved.minimum_buffer_time,
                availability_window: t.saved.availability_window,
                limit_booking_frequency: t.saved.limit_booking_frequency,
                minimum_notice_before_event: t.saved.minimum_notice_before_event,
                allow_rescheduling: t.saved.allow_rescheduling,
                minimum_notice_for_reschedule: t.saved.minimum_notice_for_reschedule,
              }
            : NEW_TYPE_DEFAULTS;
          return { ...kept, title: t.title.trim(), duration: t.minutes * 60 };
        }),
        appointment_time_slot: slotsAsText(availability),
      });
      await onSaved();
    } catch (err) {
      setError(
        isNotYours(err)
          ? "Your availability was created by someone else in Desk, so you can't change it here. Ask your admin to fix it."
          : errorText(err)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader title="Set up your booking page">
        Choose your link and the kinds of meetings people can book. You can change all of this later.
      </StepHeader>

      <section className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-es-base font-medium text-ink-gray-8">
          Booking link
        </label>
        <div className="flex w-full">
          <span className="inline-flex items-center h-7 px-2 rounded-l-lg border border-r-0 border-outline-gray-2 bg-surface-gray-1 text-es-base text-ink-gray-5 whitespace-nowrap max-sm:hidden">
            {window.location.host}/schedule/in/
          </span>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={slugState === "taken" || slugState === "invalid"}
            aria-describedby="slug-status"
            className="flex-1 min-w-0 h-7 px-2 rounded-r-lg max-sm:rounded-l-lg border border-outline-gray-2 bg-surface-base text-es-base text-ink-gray-8 focus:outline-none focus:border-outline-gray-4 focus:shadow-es-focus"
          />
        </div>
        <span id="slug-status" aria-live="polite" className="min-h-5 text-es-p-sm">
          {(slugState === "available" || slugState === "same") && (
            <span className="inline-flex items-center gap-1.5 text-ink-green-7">
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              This link is available
            </span>
          )}
          {slugState === "checking" && <span className="text-ink-gray-5">Checking…</span>}
          {slugState === "taken" && (
            <span className="text-ink-red-7">
              Someone already has this link.
              {suggestion && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setSlug(suggestion)}
                    className="p-0 border-0 bg-transparent text-ink-blue-link underline cursor-pointer"
                  >
                    Use {suggestion}
                  </button>
                </>
              )}
            </span>
          )}
          {slugState === "invalid" && (
            <span className="text-ink-red-7">Use lowercase letters, numbers and single hyphens, without a hyphen at either end.</span>
          )}
          {slugState === "empty" && <span className="text-ink-red-7">Choose a link.</span>}
        </span>
      </section>

      <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
        <legend className="p-0 mb-2 text-es-base font-medium text-ink-gray-8">Video calls</legend>
        <div className="rounded-xl border border-outline-gray-1 overflow-hidden">
          {providers.map((p) => {
            const on = provider === p.id;
            return (
              <label
                key={p.id}
                className={cn(
                  "flex items-start gap-2.5 px-3.5 py-3 border-b border-outline-gray-1 last:border-b-0 cursor-pointer",
                  on ? "bg-surface-gray-1" : "bg-surface-base"
                )}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.id}
                  checked={on}
                  onChange={() => setProvider(p.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 mt-px w-4 h-4 rounded-full box-border peer-focus-visible:shadow-es-focus",
                    on ? "border-[4.5px] border-surface-gray-10" : "border border-outline-gray-4"
                  )}
                />
                <span className="flex flex-col gap-1">
                  <span className="text-es-base font-medium text-ink-gray-8">{p.title}</span>
                  <span className="text-es-p-sm text-ink-gray-5">{p.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {provider === "Custom" && (
          <div className="flex flex-col gap-1.5">
            <input
              type="url"
              aria-label="Meeting link"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/1234567890"
              className={fieldClass}
            />
            {meetingLink.trim() && !meetingLinkOk && (
              <span className="text-es-p-sm text-ink-red-7">Enter a full link that starts with https://</span>
            )}
          </div>
        )}
        {zoomOff && (
          <Notice tone="amber" title="Zoom is turned off on this site">
            Your booking page was set to Zoom, but an admin has since turned Zoom off. Pick another option to save.
          </Notice>
        )}
        {provider === "Zoom" && !zoomOff && (
          <div className="flex flex-col gap-1.5 mt-1">
            <label htmlFor="zoom-email" className="text-es-sm text-ink-gray-6">
              Zoom email
            </label>
            <input
              id="zoom-email"
              type="email"
              value={zoomEmail}
              onChange={(e) => setZoomEmail(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={fieldClass}
            />
            <span className="text-es-p-sm text-ink-gray-5">
              The Zoom account that hosts your meetings. It needs a Zoom license in your company's account. Usually your
              work email.
            </span>
          </div>
        )}
      </fieldset>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-es-base font-medium text-ink-gray-8">Meeting types</span>
          <span className="text-es-p-sm text-ink-gray-5">
            Each one is a choice on your booking page. Breaks, notice and rescheduling can be set later.
          </span>
        </div>
        <div className="flex flex-col gap-2 mt-1">
          {types.map((t, i) => (
            <div key={t.key} className="flex items-center gap-2">
              <input
                type="text"
                aria-label={`Meeting type ${i + 1} name`}
                value={t.title}
                onChange={(e) => setType(t.key, { title: e.target.value })}
                placeholder="Intro call"
                aria-invalid={!t.title.trim()}
                className={cn(fieldClass, "flex-1 min-w-0")}
              />
              <span className="relative w-28 shrink-0">
                <select
                  aria-label={`Meeting type ${i + 1} length`}
                  value={t.minutes}
                  onChange={(e) => setType(t.key, { minutes: Number(e.target.value) })}
                  className={cn(fieldClass, "w-full pr-7 appearance-none tabular-nums cursor-pointer")}
                >
                  {(LENGTHS.includes(t.minutes) ? LENGTHS : [t.minutes, ...LENGTHS]).map((m) => (
                    <option key={m} value={m}>
                      {minutesLabel(m)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
              </span>
              <Button
                variant="ghost"
                className="w-7 px-0"
                aria-label={`Remove meeting type ${i + 1}`}
                disabled={types.length === 1}
                onClick={() => setTypes((current) => current.filter((x) => x.key !== t.key))}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" className="self-start" onClick={() => setTypes((current) => [...current, row("", 30)])}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add meeting type
        </Button>
        {!typesOk && <span className="text-es-p-sm text-ink-red-7">Give every meeting type a name.</span>}
      </section>

      {error && (
        <Notice tone="red" title="Couldn't save your booking page">
          {error}
        </Notice>
      )}

      <div className="flex justify-between gap-2 pt-2 border-t border-outline-gray-1">
        <Button size="md" onClick={onBack}>
          Back
        </Button>
        <Button variant="solid" size="md" onClick={finish} disabled={saving || !canFinish}>
          {saving && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Finish setup
        </Button>
      </div>
    </>
  );
};

export default BookingStep;
