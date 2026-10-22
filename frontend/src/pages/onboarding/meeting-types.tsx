/**
 * Meeting types: every choice on the booking page with all of its booking rules (the
 * available_durations rows of the user's availability), edited in a side drawer.
 */
import { ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, LoaderCircle, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import {
  AVAILABILITY,
  Availability,
  EVENT,
  MeetingType,
  SessionUser,
  durationLabel,
  errorText,
  siteNow,
  slotsAsText,
} from "./api";
import { Frame, FrameNav } from "./frame";
import { Button, ConfirmDialog, Notice, Pill, Switch } from "./ui";
import { useCopied } from "./use-copied";

/** Choices in seconds, like the Duration fields store them. */
const LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120].map((m) => m * 60);
const BREAKS = [0, 5, 10, 15, 20, 30, 45, 60].map((m) => m * 60);

const WHOLE_NUMBER = /^\d+$/;

const daysLabel = (n: number) => (n === 1 ? "1 day" : `${n} days`);

/** limit_booking_frequency is -1 for no limit. */
const hasLimit = (t: MeetingType) => t.limit_booking_frequency != null && t.limit_booking_frequency >= 0;

interface Form {
  title: string;
  duration: number;
  buffer: number;
  notice: string;
  window: string;
  max: string;
  resched: boolean;
  reschedHours: string;
}

type FormErrors = Partial<Record<keyof Form, string>>;

/** A new type starts from the doctype's defaults. */
const toForm = (t?: MeetingType): Form => ({
  title: t?.title ?? "",
  duration: t?.duration ?? 30 * 60,
  buffer: t?.minimum_buffer_time ?? 0,
  notice: t?.minimum_notice_before_event ? String(t.minimum_notice_before_event) : "",
  window: t?.availability_window && t.availability_window > 0 ? String(t.availability_window) : "",
  max: t && hasLimit(t) ? String(t.limit_booking_frequency) : "",
  resched: t ? !!t.allow_rescheduling : true,
  reschedHours: t?.minimum_notice_for_reschedule ? String(t.minimum_notice_for_reschedule) : "",
});

const check = (f: Form): FormErrors => {
  const errors: FormErrors = {};
  const notWhole = (value: string) => !!value.trim() && !WHOLE_NUMBER.test(value.trim());
  if (!f.title.trim()) errors.title = "Give it a name.";
  if (notWhole(f.notice)) errors.notice = "Enter a whole number of days.";
  if (notWhole(f.window)) errors.window = "Enter a whole number of days, or leave it blank.";
  if (f.max.trim() && (!WHOLE_NUMBER.test(f.max.trim()) || Number(f.max) < 1))
    errors.max = "Enter 1 or more, or leave it blank for no limit.";
  if (f.resched && notWhole(f.reschedHours)) errors.reschedHours = "Enter a whole number of hours.";
  return errors;
};

const fromForm = (f: Form, saved?: MeetingType): MeetingType => ({
  ...(saved?.name ? { name: saved.name } : {}),
  title: f.title.trim(),
  duration: f.duration,
  minimum_buffer_time: f.buffer || null,
  minimum_notice_before_event: f.notice.trim() ? Number(f.notice) : 0,
  availability_window: f.window.trim() ? Number(f.window) : null,
  limit_booking_frequency: f.max.trim() ? Number(f.max) : -1,
  allow_rescheduling: f.resched ? 1 : 0,
  minimum_notice_for_reschedule: WHOLE_NUMBER.test(f.reschedHours.trim()) ? Number(f.reschedHours) : null,
});

/** Only the row's own fields go back; every one of them, since a saved row is rebuilt from what's sent. */
const asRow = (t: MeetingType) => ({
  ...(t.name ? { name: t.name } : {}),
  title: t.title,
  duration: t.duration,
  minimum_buffer_time: t.minimum_buffer_time,
  availability_window: t.availability_window,
  limit_booking_frequency: t.limit_booking_frequency,
  minimum_notice_before_event: t.minimum_notice_before_event,
  allow_rescheduling: t.allow_rescheduling,
  minimum_notice_for_reschedule: t.minimum_notice_for_reschedule,
});

const fieldClass =
  "h-7 px-2 rounded-lg border border-transparent bg-surface-gray-2 text-es-base text-ink-gray-8 placeholder:text-ink-gray-4 hover:bg-surface-gray-3 focus:outline-none focus:bg-surface-base focus:border-outline-gray-4 focus:shadow-es-focus";

const Field = ({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
    <label htmlFor={id} className="text-es-sm text-ink-gray-6">
      {label}
    </label>
    {children}
    {error ? (
      <span role="alert" className="text-es-p-sm text-ink-red-7">
        {error}
      </span>
    ) : (
      hint && <span className="text-es-p-sm text-ink-gray-5">{hint}</span>
    )}
  </div>
);

const SecondsSelect = ({
  id,
  value,
  choices,
  none,
  onChange,
  className,
}: {
  id: string;
  value: number;
  choices: number[];
  /** Label for 0. */
  none?: string;
  onChange: (value: number) => void;
  className?: string;
}) => (
  <span className={cn("relative", className)}>
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(fieldClass, "w-full pr-7 appearance-none tabular-nums cursor-pointer")}
    >
      {(choices.includes(value) ? choices : [...choices, value].sort((a, b) => a - b)).map((s) => (
        <option key={s} value={s}>
          {s === 0 && none ? none : durationLabel(s)}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
  </span>
);

const NumberInput = ({
  id,
  value,
  placeholder,
  error,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  error?: string;
  onChange: (value: string) => void;
}) => (
  <input
    id={id}
    type="text"
    inputMode="numeric"
    value={value}
    placeholder={placeholder}
    aria-invalid={!!error}
    onChange={(e) => onChange(e.target.value)}
    className={cn(fieldClass, "tabular-nums", error && "border-ink-red-7")}
  />
);

const Editor = ({
  saved,
  typeLink,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  saved?: MeetingType;
  typeLink?: string;
  canDelete: boolean;
  onSave: (type: MeetingType) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}) => {
  const [form, setForm] = useState(() => toForm(saved));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopied();
  const nameRef = useRef<HTMLInputElement>(null);

  const errors = tried ? check(form) : {};
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const save = async () => {
    setTried(true);
    if (Object.keys(check(form)).length) return;
    setError(null);
    setSaving(true);
    try {
      await onSave(fromForm(form, saved));
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  };

  return (
    <aside
      aria-label={saved ? `Edit ${saved.title}` : "New meeting type"}
      className="fixed inset-y-0 right-0 z-30 w-[440px] max-w-full flex flex-col bg-surface-elevation-1 border-l border-outline-gray-1 shadow-es-lg"
    >
      <div className="min-h-12 flex items-center justify-between gap-2 px-5 border-b border-outline-gray-1">
        <h2 className="m-0 text-es-lg font-semibold text-ink-gray-9 truncate">{saved ? saved.title : "New meeting type"}</h2>
        <Button variant="ghost" className="w-7 px-0" aria-label="Close" onClick={onClose}>
          <X className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-7">
        <div className="flex flex-col gap-4">
          <Field id="mt-name" label="Name" error={errors.title}>
            <input
              ref={nameRef}
              id="mt-name"
              type="text"
              value={form.title}
              placeholder="Intro call"
              aria-invalid={!!errors.title}
              onChange={(e) => set({ title: e.target.value })}
              className={cn(fieldClass, errors.title && "border-ink-red-7")}
            />
          </Field>
          <Field id="mt-length" label="Length">
            <SecondsSelect id="mt-length" value={form.duration} choices={LENGTHS} onChange={(duration) => set({ duration })} className="w-40" />
          </Field>
        </div>

        <section className="flex flex-col gap-4">
          <h3 className="m-0 text-es-base font-medium text-ink-gray-8">Scheduling</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field id="mt-break" label="Break between meetings">
              <SecondsSelect id="mt-break" value={form.buffer} choices={BREAKS} none="No break" onChange={(buffer) => set({ buffer })} />
            </Field>
            <Field id="mt-max" label="Max per day" error={errors.max}>
              <NumberInput id="mt-max" value={form.max} placeholder="No limit" error={errors.max} onChange={(max) => set({ max })} />
            </Field>
            <Field id="mt-notice" label="Earliest booking" hint="Days from today. 0 allows same-day bookings." error={errors.notice}>
              <NumberInput id="mt-notice" value={form.notice} placeholder="0" error={errors.notice} onChange={(notice) => set({ notice })} />
            </Field>
            <Field id="mt-window" label="Book up to" hint="Days ahead, counted from the earliest booking day." error={errors.window}>
              <NumberInput id="mt-window" value={form.window} placeholder="No limit" error={errors.window} onChange={(window) => set({ window })} />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-es-base font-medium text-ink-gray-8">Rescheduling</h3>
          <div className="flex items-center justify-between gap-4">
            <span className="flex flex-col gap-1">
              <span className="text-es-base text-ink-gray-8">Let people reschedule</span>
              <span className="text-es-p-sm text-ink-gray-5">They get a reschedule link in their confirmation email.</span>
            </span>
            <Switch checked={form.resched} onChange={(resched) => set({ resched })} label="Let people reschedule" />
          </div>
          {form.resched && (
            <Field id="mt-resched" label="Stop rescheduling" hint="Hours before the meeting." error={errors.reschedHours} className="w-1/2">
              <NumberInput
                id="mt-resched"
                value={form.reschedHours}
                placeholder="Any time"
                error={errors.reschedHours}
                onChange={(reschedHours) => set({ reschedHours })}
              />
            </Field>
          )}
        </section>

        {typeLink && (
          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-es-base font-medium text-ink-gray-8">Direct link</h3>
            <span className="text-es-p-sm text-ink-gray-5">Skips the meeting choice and goes straight to picking a time.</span>
            <div className="flex items-center gap-2 py-1 pr-1 pl-2.5 rounded-[10px] bg-surface-gray-1">
              <span className="flex-1 min-w-0 truncate text-es-sm text-ink-gray-7" title={typeLink}>
                {typeLink.replace(/^https?:\/\//, "")}
              </span>
              <button
                type="button"
                onClick={() => copy("drawer", typeLink)}
                className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2 rounded-lg border border-outline-gray-2 bg-surface-base text-es-base text-ink-gray-8 shadow-es-sm cursor-pointer hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:shadow-es-focus"
              >
                {copied === "drawer" ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                <span aria-live="polite">{copied === "drawer" ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </section>
        )}

        {error && (
          <Notice tone="red" title="Couldn't save this meeting type">
            {error}
          </Notice>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-outline-gray-1">
        {saved ? (
          <Button
            className="bg-surface-red-2 text-ink-red-7 hover:bg-surface-red-3"
            onClick={onDelete}
            disabled={!canDelete}
            title={canDelete ? undefined : "Your booking page needs at least one meeting type."}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="solid" onClick={save} disabled={saving}>
            {saving && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </div>
      </div>
    </aside>
  );
};

/** The row's "More actions" menu. */
const RowMenu = ({
  title,
  link,
  canDelete,
  onEdit,
  onDelete,
}: {
  title: string;
  link: string;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const itemClass =
    "flex items-center gap-2 h-7 px-2 rounded-lg text-es-base text-ink-gray-8 no-underline bg-transparent border-0 cursor-pointer text-left w-full hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:bg-surface-gray-2 disabled:cursor-not-allowed disabled:text-ink-gray-4 disabled:hover:bg-transparent";

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        variant="ghost"
        className="w-7 px-0 text-ink-gray-6"
        aria-label={`More actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
      </Button>
      {open && (
        <div role="menu" className="absolute z-20 right-0 top-8 w-48 p-1 rounded-xl bg-surface-elevation-2 shadow-es-2xl flex flex-col text-left">
          <button role="menuitem" type="button" className={itemClass} onClick={() => (setOpen(false), onEdit())}>
            <Pencil className="w-4 h-4 text-ink-gray-6" aria-hidden="true" />
            Edit
          </button>
          <a role="menuitem" href={link} target="_blank" rel="noreferrer" className={itemClass} onClick={() => setOpen(false)}>
            <ExternalLink className="w-4 h-4 text-ink-gray-6" aria-hidden="true" />
            Open booking page
          </a>
          <div className="h-px my-1 bg-outline-gray-1" />
          <button
            role="menuitem"
            type="button"
            className={cn(itemClass, "text-ink-red-7")}
            disabled={!canDelete}
            title={canDelete ? undefined : "Your booking page needs at least one meeting type."}
            onClick={() => (setOpen(false), onDelete())}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

const MeetingTypes = ({
  user,
  availability,
  nav,
  onChanged,
}: {
  user: SessionUser;
  availability: Availability;
  nav: FrameNav;
  /** Reloads the availability after a save. */
  onChanged: () => Promise<void>;
}) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  // The row being edited (by name), "new", or nothing.
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MeetingType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useCopied();

  const types = availability.available_durations;
  const link = `${window.location.origin}/schedule/in/${availability.slug}`;
  const typeLink = (t: MeetingType) => `${link}?type=${encodeURIComponent(t.name ?? "")}`;
  const selected = editing && editing !== "new" ? types.find((t) => t.name === editing) : undefined;
  const canDelete = types.length > 1;

  // Escape closes the drawer, unless the delete dialog is open on top of it.
  useEffect(() => {
    if (!editing || deleting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setEditing(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, deleting]);

  const saveTypes = (list: MeetingType[]) =>
    db.updateDoc(AVAILABILITY, availability.name, {
      available_durations: list.map(asRow),
      appointment_time_slot: slotsAsText(availability),
    });

  const save = async (type: MeetingType) => {
    await saveTypes(type.name ? types.map((t) => (t.name === type.name ? type : t)) : [...types, type]);
    await onChanged();
    setEditing(null);
  };

  const askDelete = (t: MeetingType) => {
    setDeleteError(null);
    setDeleting(t);
  };

  const remove = async (t: MeetingType) => {
    setBusy(true);
    setDeleteError(null);
    try {
      // Bookings point at their meeting type, and fail to save (reschedule, cancel) once it's gone.
      const upcoming = await db.getCount(EVENT, [
        ["custom_user_calendar", "=", availability.name],
        ["custom_appointment_slot_duration", "=", t.name ?? ""],
        ["starts_on", ">=", siteNow(user.siteTimeZone)],
        ["status", "!=", "Cancelled"],
      ]);
      if (upcoming) {
        setDeleteError(
          `${upcoming === 1 ? "1 upcoming booking is" : `${upcoming} upcoming bookings are`} for ${t.title}, and deleting it would break ${upcoming === 1 ? "it" : "them"}. Delete it once ${upcoming === 1 ? "it's" : "they're"} over.`
        );
        return;
      }
      await saveTypes(types.filter((x) => x.name !== t.name));
      await onChanged();
      setDeleting(null);
      setEditing(null);
    } catch (err) {
      setDeleteError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const cell = "px-3 tabular-nums text-ink-gray-7 whitespace-nowrap";

  return (
    <Frame
      user={user}
      title="Meeting types"
      width="full"
      {...nav}
      headerAction={
        <Button variant="solid" onClick={() => setEditing("new")}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          New meeting type
        </Button>
      }
    >
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="h-8 text-es-sm text-ink-gray-5 text-left border-b border-outline-gray-1">
              <th scope="col" className="pr-3 font-[420]">Name</th>
              <th scope="col" className="px-3 font-[420]">Length</th>
              <th scope="col" className="px-3 font-[420]">Break</th>
              <th scope="col" className="px-3 font-[420]">Earliest booking</th>
              <th scope="col" className="px-3 font-[420]">Book up to</th>
              <th scope="col" className="px-3 font-[420]">Max per day</th>
              <th scope="col" className="px-3 font-[420]">Rescheduling</th>
              <th scope="col" className="w-[72px]">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr
                key={t.name}
                onClick={() => setEditing(t.name ?? null)}
                className={cn(
                  "h-11 text-es-base border-b border-outline-gray-1 cursor-pointer",
                  editing === t.name ? "bg-surface-gray-2" : "hover:bg-surface-gray-1"
                )}
              >
                <td className="pr-3">
                  <button
                    type="button"
                    onClick={(e) => (e.stopPropagation(), setEditing(t.name ?? null))}
                    className="p-0 border-0 bg-transparent text-es-base font-medium text-ink-gray-8 cursor-pointer text-left rounded focus-visible:outline-none focus-visible:shadow-es-focus"
                  >
                    {t.title}
                  </button>
                </td>
                <td className={cell}>{durationLabel(t.duration)}</td>
                <td className={cell}>{t.minimum_buffer_time ? durationLabel(t.minimum_buffer_time) : "No break"}</td>
                <td className={cell}>{t.minimum_notice_before_event ? daysLabel(t.minimum_notice_before_event) : "Same day"}</td>
                <td className={cell}>{t.availability_window && t.availability_window > 0 ? daysLabel(t.availability_window) : "No limit"}</td>
                <td className={cell}>{hasLimit(t) ? t.limit_booking_frequency : "No limit"}</td>
                <td className="px-3">
                  <Pill tone={t.allow_rescheduling ? "green" : "gray"}>{t.allow_rescheduling ? "Allowed" : "Off"}</Pill>
                </td>
                <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    className="w-7 px-0 text-ink-gray-6"
                    aria-label={`Copy link for ${t.title}`}
                    title={copied === t.name ? "Copied" : "Copy link"}
                    onClick={() => copy(t.name ?? t.title, typeLink(t))}
                  >
                    {copied === t.name ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  </Button>
                  <RowMenu
                    title={t.title}
                    link={typeLink(t)}
                    canDelete={canDelete}
                    onEdit={() => setEditing(t.name ?? null)}
                    onDelete={() => askDelete(t)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>

      {editing && (editing === "new" || selected) && (
        <Editor
          key={editing}
          saved={selected}
          typeLink={selected ? typeLink(selected) : undefined}
          canDelete={canDelete}
          onSave={save}
          onDelete={() => selected && askDelete(selected)}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.title}?`}
          confirmLabel="Delete"
          busy={busy}
          error={deleteError}
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        >
          It disappears from your booking page, and its direct link stops working.
        </ConfirmDialog>
      )}
    </Frame>
  );
};

export default MeetingTypes;
