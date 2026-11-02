/**
 * Step 3: the booking page itself, saved to User Appointment Availability: the link (slug),
 * the video call provider (and the Zoom email on the user's Google Calendar), and the
 * meeting types (available_durations). Finishing turns the booking page on.
 */
import { useContext, useState } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import {
  AVAILABILITY,
  Availability,
  CalendarInfo,
  DEFAULT_EMAIL_TEMPLATES,
  GOOGLE_CALENDAR,
  MeetingType,
  NOT_YOURS,
  errorText,
  isNotYours,
  slotsAsText,
  slugify,
} from "../api";
import { Length, customLengthError, lengthSeconds, savedLength } from "../booking-rules";
import { CustomLength, LengthSelect, fieldClass } from "../form-fields";
import SlugField from "../slug-field";
import { Button, Notice, StepHeader } from "../ui";
import { useSlugCheck } from "../use-slug-check";
import VideoPicker from "../video-picker";
import { Provider, isEmail, isMeetingLink, providersFor, savedProviderOf } from "../video";


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
  length: Length;
  /** The saved row, so its breaks, notice and rescheduling settings go back unchanged. */
  saved?: MeetingType;
}

let nextKey = 0;
const row = (title: string, seconds: number, saved?: MeetingType): TypeRow => ({ key: ++nextKey, title, length: savedLength(seconds), saved });

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
  const slugCheck = useSlugCheck(slug, savedSlug);

  const savedProvider = savedProviderOf(availability);
  const providers = providersFor(zoomReady, savedProvider);
  const [provider, setProvider] = useState<Provider>(savedProvider);
  const [meetingLink, setMeetingLink] = useState(availability.meeting_link ?? "");
  const [zoomEmail, setZoomEmail] = useState(calendar.custom_zoom_user_email || user);

  const [types, setTypes] = useState<TypeRow[]>(() =>
    availability.available_durations.length
      ? availability.available_durations.map((d) => row(d.title, d.duration, d))
      : [row("Quick chat", 15 * 60), row("Meeting", 30 * 60)]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setType = (key: number, change: Partial<TypeRow>) =>
    setTypes((current) => current.map((t) => (t.key === key ? { ...t, ...change } : t)));

  const linkOk = slugCheck.ok;
  const meetingLinkOk = provider !== "Custom" || isMeetingLink(meetingLink);
  const zoomEmailOk = provider !== "Zoom" || isEmail(zoomEmail);
  const typesOk = types.length > 0 && types.every((t) => t.title.trim() && !customLengthError(t.length));
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
          return { ...kept, title: t.title.trim(), duration: lengthSeconds(t.length) };
        }),
        appointment_time_slot: slotsAsText(availability),
      });
      await onSaved();
    } catch (err) {
      setError(isNotYours(err) ? NOT_YOURS : errorText(err));
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
        <SlugField id="slug" value={slug} onChange={setSlug} check={slugCheck} />
      </section>

      <VideoPicker
        providers={providers}
        provider={provider}
        onProvider={setProvider}
        meetingLink={meetingLink}
        onMeetingLink={setMeetingLink}
        zoomEmail={zoomEmail}
        onZoomEmail={setZoomEmail}
        zoomOff={zoomOff}
      />

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-es-base font-medium text-ink-gray-8">Meeting types</span>
          <span className="text-es-p-sm text-ink-gray-5">
            Each one is a choice on your booking page. Breaks, notice and rescheduling can be set later.
          </span>
        </div>
        <div className="flex flex-col gap-2 mt-1">
          {types.map((t, i) => (
            <div key={t.key} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label={`Meeting type ${i + 1} name`}
                  value={t.title}
                  onChange={(e) => setType(t.key, { title: e.target.value })}
                  placeholder="Intro call"
                  aria-invalid={!t.title.trim()}
                  className={cn(fieldClass, "flex-1 min-w-0")}
                />
                <LengthSelect
                  id={`setup-length-${t.key}`}
                  label={`Meeting type ${i + 1} length`}
                  value={t.length}
                  onChange={(length) => setType(t.key, { length })}
                  className="w-48 shrink-0"
                />
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
              <CustomLength
                id={`setup-length-${t.key}-custom`}
                value={t.length}
                onChange={(length) => setType(t.key, { length })}
                error={customLengthError(t.length)}
              />
            </div>
          ))}
        </div>
        <Button variant="ghost" className="self-start" onClick={() => setTypes((current) => [...current, row("", 30 * 60)])}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add meeting type
        </Button>
        {!types.every((t) => t.title.trim()) && <span className="text-es-p-sm text-ink-red-7">Give every meeting type a name.</span>}
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
