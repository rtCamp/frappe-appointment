/**
 * Booking page section: on/off, link (slug), video call provider and meeting types
 * (Appointment Slot Duration rows) on the User Appointment Availability record.
 */
import { useEffect, useState } from "react";
import { ChevronDown, Clock, Link2, LoaderCircle, Plus, Trash2, Undo2, Video, VideoOff } from "lucide-react";

import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Switch } from "@/components/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/select";
import { cn } from "@/lib/utils";
import { AvailabilityDoc, DurationRow, OnboardingApi, errorText, slotsAsText } from "../api";
import {
  Box,
  Field,
  Notice,
  Section,
  blueButton,
  blueFocus,
  blueGhostButton,
  blueOutlineButton,
  blueSwitch,
  panel,
  toastSaved,
} from "../ui";

const SLUG_REGEX = /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/;
const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 60];

const minutesLabel = (m: number) =>
  m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)} hr ${m % 60} min`;

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "");

type TypeRow = {
  key: string;
  name?: string;
  title: string;
  minutes: number;
  buffer: number;
  noticeDays: string;
  windowDays: string;
  maxPerDay: string;
  allowReschedule: boolean;
  rescheduleNoticeHours: string;
  removed: boolean;
  expanded: boolean;
};

let keySeq = 0;
const newKey = () => `row-${++keySeq}`;

const toRow = (d: DurationRow): TypeRow => ({
  key: newKey(),
  name: d.name,
  title: d.title ?? "",
  minutes: Math.round((Number(d.duration) || 1800) / 60),
  buffer: Math.round((Number(d.minimum_buffer_time) || 0) / 60),
  noticeDays: d.minimum_notice_before_event ? String(d.minimum_notice_before_event) : "",
  windowDays: d.availability_window ? String(d.availability_window) : "",
  maxPerDay:
    d.limit_booking_frequency !== null && d.limit_booking_frequency !== undefined && Number(d.limit_booking_frequency) >= 0
      ? String(d.limit_booking_frequency)
      : "",
  allowReschedule: d.allow_rescheduling === undefined ? true : !!d.allow_rescheduling,
  rescheduleNoticeHours: d.minimum_notice_for_reschedule ? String(d.minimum_notice_for_reschedule) : "",
  removed: false,
  expanded: false,
});

const blankRow = (title = "Meeting", minutes = 30): TypeRow => ({
  key: newKey(),
  title,
  minutes,
  buffer: 0,
  noticeDays: "",
  windowDays: "",
  maxPerDay: "",
  allowReschedule: true,
  rescheduleNoticeHours: "",
  removed: false,
  expanded: false,
});

const intOrZero = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const MinutesSelect = ({
  id,
  value,
  options,
  zeroLabel,
  onChange,
}: {
  id: string;
  value: number;
  options: number[];
  zeroLabel?: string;
  onChange: (v: number) => void;
}) => (
  <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
    <SelectTrigger id={id} className={cn("focus:ring-blue-400")}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {(options.includes(value) ? options : [value, ...options]).map((m) => (
        <SelectItem key={m} value={String(m)}>
          {m === 0 && zeroLabel ? zeroLabel : minutesLabel(m)}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const BookingStep = ({
  api,
  availability,
  fullName,
  defaultTemplate,
  onSaved,
}: {
  api: OnboardingApi;
  availability: AvailabilityDoc;
  fullName: string;
  defaultTemplate: string | null;
  onSaved: (doc: AvailabilityDoc) => void;
}) => {
  const savedSlug = availability.slug ?? "";
  const [enabled, setEnabled] = useState(availability.enable_scheduling ? true : !availability.slug);
  const [slug, setSlug] = useState(savedSlug || slugify(fullName) || "");
  const [slugState, setSlugState] = useState<{ checking: boolean; available: boolean | null; suggestion: string | null }>({
    checking: false,
    available: null,
    suggestion: null,
  });
  const [provider, setProvider] = useState<string>(
    availability.meeting_provider && availability.meeting_provider !== "None"
      ? availability.meeting_provider
      : availability.slug
        ? "None"
        : "Google Meet"
  );
  const [meetingLink, setMeetingLink] = useState(availability.meeting_link ?? "");
  const [rows, setRows] = useState<TypeRow[]>(() =>
    availability.available_durations?.length
      ? availability.available_durations.map(toRow)
      : [blankRow("Quick chat", 15), blankRow("Meeting", 30)]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = window.location.origin;
  const slugFormatOk = SLUG_REGEX.test(slug);

  // Live slug availability (the user's own saved slug always counts as available).
  useEffect(() => {
    if (!slug || !slugFormatOk) {
      setSlugState({ checking: false, available: null, suggestion: null });
      return;
    }
    if (slug === savedSlug) {
      setSlugState({ checking: false, available: true, suggestion: null });
      return;
    }
    let cancelled = false;
    setSlugState((s) => ({ ...s, checking: true }));
    const id = window.setTimeout(async () => {
      try {
        const res = await api.isSlugAvailable(slug);
        if (!cancelled) setSlugState({ checking: false, available: res.is_available, suggestion: res.suggested_slug });
      } catch {
        if (!cancelled) setSlugState({ checking: false, available: null, suggestion: null });
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [slug, slugFormatOk, savedSlug, api]);

  const patchRow = (key: string, patch: Partial<TypeRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (row: TypeRow) => {
    if (row.name) patchRow(row.key, { removed: true, expanded: false });
    else setRows((prev) => prev.filter((r) => r.key !== row.key));
  };

  const liveRows = rows.filter((r) => !r.removed);

  const slugError = !slug
    ? "Choose a link name."
    : !slugFormatOk
      ? "Use small letters, numbers and single hyphens, like jane-doe."
      : slugState.available === false
        ? `That link is taken.${slugState.suggestion ? ` Try ${slugState.suggestion}.` : ""}`
        : null;

  const save = async () => {
    setError(null);
    if (enabled && slugError) return setError(slugError);
    if (enabled && slugState.checking) return setError("Still checking your link. Try again in a moment.");
    if (enabled && provider === "Custom" && !/^https?:\/\//i.test(meetingLink.trim()))
      return setError("Add the full meeting link, starting with https://");
    if (enabled && liveRows.length === 0) return setError("Add at least one meeting type.");
    if (liveRows.some((r) => !r.title.trim())) return setError("Give every meeting type a name.");

    const durations: DurationRow[] = liveRows.map((r) => ({
      ...(r.name ? { name: r.name } : {}),
      title: r.title.trim(),
      duration: r.minutes * 60,
      minimum_buffer_time: r.buffer * 60,
      minimum_notice_before_event: intOrZero(r.noticeDays),
      availability_window: intOrZero(r.windowDays),
      limit_booking_frequency: r.maxPerDay.trim() === "" ? -1 : intOrZero(r.maxPerDay),
      allow_rescheduling: r.allowReschedule ? 1 : 0,
      minimum_notice_for_reschedule: intOrZero(r.rescheduleNoticeHours),
    }));

    setSaving(true);
    try {
      const doc = await api.updateAvailability(availability.name, {
        appointment_time_slot: slotsAsText(availability.appointment_time_slot),
        enable_scheduling: enabled ? 1 : 0,
        slug: slug || null,
        meeting_provider: provider,
        meeting_link: provider === "Custom" ? meetingLink.trim() : availability.meeting_link,
        response_email_template: availability.response_email_template || defaultTemplate || null,
        available_durations: durations,
      });
      toastSaved(enabled ? "Booking page is live" : "Booking page saved");
      onSaved(doc);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const providers = [
    { value: "Google Meet", title: "Google Meet", desc: "A new Meet link for every booking", icon: Video },
    { value: "Custom", title: "My own link", desc: "The same Zoom, Teams or Meet room each time", icon: Link2 },
    { value: "None", title: "No video link", desc: "For phone calls or in-person meetings", icon: VideoOff },
  ];
  if (provider === "Zoom") {
    providers.splice(1, 0, { value: "Zoom", title: "Zoom", desc: "A new Zoom meeting for every booking", icon: Video });
  }

  return (
    <Section
      title="Booking page"
      description="Choose your link and the kinds of meetings people can book. You can change any of this later."
    >
      <Box className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="setup-enabled" className="text-base">
            Let people book time with me
          </Label>
          <p className="text-sm text-muted-foreground">
            Turn this off to hide your booking page. Team meetings you're part of keep working.
          </p>
        </div>
        <Switch id="setup-enabled" checked={enabled} onCheckedChange={setEnabled} className={blueSwitch} />
      </Box>

      <Box className={cn("flex flex-col gap-8 transition-opacity", !enabled && "opacity-60")}>
        <Field
          label="Your link"
          htmlFor="setup-slug"
          error={slug && slugError ? slugError : undefined}
          description={
            slugState.checking ? (
              "Checking…"
            ) : slugState.available && slug ? (
              <span className="text-green-600 dark:text-green-400">This link is yours.</span>
            ) : undefined
          }
        >
          <div className="flex w-full items-stretch">
            <span
              className="hidden sm:flex items-center rounded-l-md border border-r-0 border-input bg-blue-50 dark:bg-zinc-800 px-3 text-sm text-muted-foreground whitespace-nowrap max-w-[55%] overflow-hidden text-ellipsis"
              title={`${origin}/schedule/in/`}
            >
              {origin.replace(/^https?:\/\//, "")}/schedule/in/
            </span>
            <Input
              id="setup-slug"
              value={slug}
              placeholder="jane-doe"
              aria-invalid={!!(slug && slugError)}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              className={cn("sm:rounded-l-none", blueFocus, slug && slugError && "border-red-400")}
            />
          </div>
          {slugState.available === false && slugState.suggestion && (
            <Button
              size="sm"
              variant="ghost"
              className={cn(blueGhostButton, "w-fit px-2")}
              onClick={() => setSlug(slugState.suggestion as string)}
            >
              Use {slugState.suggestion}
            </Button>
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <Label>Video calls</Label>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Video calls">
            {providers.map((p) => {
              const Icon = p.icon;
              const active = provider === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setProvider(p.value)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                    active
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-800/10 dark:border-blue-400"
                      : "border-blue-100 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-400/60"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active ? "text-blue-500 dark:text-blue-400" : "text-muted-foreground")} />
                  <span className="text-sm font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.desc}</span>
                </button>
              );
            })}
          </div>
          {provider === "Custom" && (
            <Input
              value={meetingLink}
              placeholder="https://zoom.us/j/1234567890"
              aria-label="Meeting link"
              onChange={(e) => setMeetingLink(e.target.value)}
              className={cn("mt-1", blueFocus)}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Meeting types</Label>
          <p className="text-sm text-muted-foreground">Each one shows up as a choice on your booking page.</p>
          <div className="flex flex-col gap-3 mt-1">
            {rows.map((row) =>
              row.removed ? (
                <div key={row.key} className={cn(panel, "flex items-center gap-3 p-4 border border-dashed border-blue-100 dark:border-zinc-700")}>
                  <p className="flex-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{row.title || "Untitled"}</span> will be removed when
                    you save. Reschedule links already sent for it will stop working.
                  </p>
                  <Button size="sm" variant="ghost" className={blueGhostButton} onClick={() => patchRow(row.key, { removed: false })}>
                    <Undo2 /> Undo
                  </Button>
                </div>
              ) : (
                <div key={row.key} className="rounded-xl border border-blue-100 dark:border-zinc-800 p-4">
                  <div className="grid grid-cols-[1fr,auto] sm:grid-cols-[1fr,170px,auto] gap-3 items-end">
                    <Field label="Name" htmlFor={`${row.key}-title`}>
                      <Input
                        id={`${row.key}-title`}
                        value={row.title}
                        placeholder="Intro call"
                        onChange={(e) => patchRow(row.key, { title: e.target.value })}
                        className={blueFocus}
                      />
                    </Field>
                    <Field label="Length" htmlFor={`${row.key}-len`} className="max-sm:order-3 max-sm:col-span-2">
                      <MinutesSelect
                        id={`${row.key}-len`}
                        value={row.minutes}
                        options={DURATION_OPTIONS}
                        onChange={(minutes) => patchRow(row.key, { minutes })}
                      />
                    </Field>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${row.title || "meeting type"}`}
                      title="Remove"
                      disabled={liveRows.length <= 1}
                      onClick={() => removeRow(row)}
                      className="text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <button
                    type="button"
                    aria-expanded={row.expanded}
                    onClick={() => patchRow(row.key, { expanded: !row.expanded })}
                    className="mt-3 inline-flex items-center gap-1 text-sm text-blue-500 dark:text-blue-400 hover:underline"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", row.expanded && "rotate-180")} />
                    {row.expanded ? "Fewer options" : "More options"}
                  </button>
                  {row.expanded && (
                    <div className="grid gap-5 sm:grid-cols-2 mt-4 pt-4 border-t border-blue-50 dark:border-zinc-800">
                      <Field label="Break between meetings" htmlFor={`${row.key}-buf`} description="Kept free before and after your other events.">
                        <MinutesSelect
                          id={`${row.key}-buf`}
                          value={row.buffer}
                          options={BUFFER_OPTIONS}
                          zeroLabel="No break"
                          onChange={(buffer) => patchRow(row.key, { buffer })}
                        />
                      </Field>
                      <Field label="Earliest booking (days from today)" htmlFor={`${row.key}-notice`} description="0 lets people book you for today.">
                        <Input
                          id={`${row.key}-notice`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          placeholder="0"
                          value={row.noticeDays}
                          onChange={(e) => patchRow(row.key, { noticeDays: e.target.value })}
                          className={blueFocus}
                        />
                      </Field>
                      <Field label="How far ahead (days)" htmlFor={`${row.key}-window`} description="Leave empty for no limit.">
                        <Input
                          id={`${row.key}-window`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          placeholder="No limit"
                          value={row.windowDays}
                          onChange={(e) => patchRow(row.key, { windowDays: e.target.value })}
                          className={blueFocus}
                        />
                      </Field>
                      <Field label="Most bookings per day" htmlFor={`${row.key}-max`} description="Leave empty for no limit.">
                        <Input
                          id={`${row.key}-max`}
                          type="number"
                          min={1}
                          inputMode="numeric"
                          placeholder="No limit"
                          value={row.maxPerDay}
                          onChange={(e) => patchRow(row.key, { maxPerDay: e.target.value })}
                          className={blueFocus}
                        />
                      </Field>
                      <div className="sm:col-span-2 flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`${row.key}-resched`}>Let people reschedule</Label>
                          <p className="text-sm text-muted-foreground">They get a reschedule link in their confirmation email.</p>
                        </div>
                        <Switch
                          id={`${row.key}-resched`}
                          checked={row.allowReschedule}
                          onCheckedChange={(v) => patchRow(row.key, { allowReschedule: v })}
                          className={blueSwitch}
                        />
                      </div>
                      {row.allowReschedule && (
                        <Field
                          label="Stop rescheduling this many hours before"
                          htmlFor={`${row.key}-rnotice`}
                          description="Leave empty to allow it any time."
                        >
                          <Input
                            id={`${row.key}-rnotice`}
                            type="number"
                            min={0}
                            inputMode="numeric"
                            placeholder="Any time"
                            value={row.rescheduleNoticeHours}
                            onChange={(e) => patchRow(row.key, { rescheduleNoticeHours: e.target.value })}
                            className={blueFocus}
                          />
                        </Field>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
          <Button
            variant="outline"
            className={cn(blueOutlineButton, "w-fit mt-1")}
            onClick={() => setRows((prev) => [...prev, blankRow("", 30)])}
          >
            <Plus /> Add meeting type
          </Button>
        </div>
      </Box>

      {error && <Notice tone="red" title="Couldn't save your booking page">{error}</Notice>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-4 w-4" /> {liveRows.length} meeting type{liveRows.length === 1 ? "" : "s"}
        </p>
        <Button className={blueButton} onClick={save} disabled={saving}>
          {saving && <LoaderCircle className="animate-spin" />}
          {enabled ? "Save and publish" : "Save"}
        </Button>
      </div>
    </Section>
  );
};

export default BookingStep;
