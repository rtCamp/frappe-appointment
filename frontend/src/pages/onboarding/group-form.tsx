/**
 * Making or changing a group, in a dialog over the page: its name and people, its meeting, and its booking
 * rules, one step each. A new group goes through the steps in order; an existing one can jump to any step.
 * Bookings always go to the owner's own Google Calendar with the owner as organizer, so those aren't choices.
 */
import { useContext, useEffect, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Trash2 } from "lucide-react";
import { FrappeConfig, FrappeContext, useFrappeGetCall } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import {
  APPOINTMENT_GROUP,
  AppointmentGroup,
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE,
  GET_GROUP,
  GroupDetail,
  GroupPerson,
  SessionUser,
  errorText,
} from "./api";
import { BREAKS, LENGTHS, WHOLE_NUMBER } from "./booking-rules";
import { Field, NumberInput, SecondsSelect, fieldClass } from "./form-fields";
import { PeopleList } from "./group-people";
import { Button, ConfirmDialog, Modal, Notice, Switch } from "./ui";
import { PROVIDERS, Provider, isMeetingLink, providersFor } from "./video";

interface Form {
  groupName: string;
  people: GroupPerson[];
  duration: number;
  buffer: number;
  provider: Provider;
  meetLink: string;
  template: string;
  notice: string;
  window: string;
  max: string;
  resched: boolean;
  reschedHours: string;
}

const toForm = (detail: GroupDetail | null, me: GroupPerson): Form => {
  const doc = detail?.doc;
  const windowDays = WHOLE_NUMBER.test(String(doc?.event_availability_window ?? "").trim()) ? Number(doc?.event_availability_window) : 0;
  return {
    groupName: doc?.group_name ?? "",
    people: detail?.people ?? [me],
    duration: doc?.duration_for_event ?? 30 * 60,
    buffer: doc?.minimum_buffer_time ?? 0,
    // The doctype defaults to "Custom" with no link; a new group starts on Google Meet instead.
    provider: (doc ? doc.meet_provider || "None" : "Google Meet") as Provider,
    meetLink: doc?.meet_link ?? "",
    template: doc?.response_email_template ?? "",
    notice: doc?.minimum_notice_before_event ? String(doc.minimum_notice_before_event) : "",
    window: windowDays > 0 ? String(windowDays) : "",
    max: doc?.limit_booking_frequency != null && doc.limit_booking_frequency >= 0 ? String(doc.limit_booking_frequency) : "",
    resched: doc ? !!doc.allow_rescheduling : true,
    reschedHours: doc?.minimum_notice_for_reschedule ? String(doc.minimum_notice_for_reschedule) : "",
  };
};

const STEPS = [
  { label: "People", heading: "Who's in this group?", description: "Name the group and add the people. Guests only see times when everyone required is free." },
  { label: "Meeting", heading: "What's the meeting like?", description: "How long it runs, where it happens, and the email guests get." },
  { label: "Booking rules", heading: "When can guests book?", description: "How soon, how far ahead and how often this group can be booked." },
];
const LAST_STEP = STEPS.length - 1;

type FormErrors = Partial<Record<"groupName" | "people" | "meetLink" | "notice" | "window" | "max" | "reschedHours", string>>;

/** The step each field is on, so a check can send people back to it. */
const STEP_OF: Record<keyof FormErrors, number> = {
  groupName: 0,
  people: 0,
  meetLink: 1,
  notice: 2,
  window: 2,
  max: 2,
  reschedHours: 2,
};

const isBlankOrWholeNumber = (value: string) => !value.trim() || WHOLE_NUMBER.test(value.trim());

/** What's wrong with the form, field by field. Empty when it can be saved. */
const checkForm = (form: Form): FormErrors => {
  const errors: FormErrors = {};

  if (!form.groupName.trim()) {
    errors.groupName = "Give the group a name.";
  }

  let someoneRequired = false;
  for (const person of form.people) {
    if (person.is_mandatory) someoneRequired = true;
  }
  if (!someoneRequired) {
    errors.people = "At least one person has to be required.";
  }

  if (form.provider === "Custom" && !isMeetingLink(form.meetLink)) {
    errors.meetLink = "Enter a full link that starts with https://";
  }
  if (!isBlankOrWholeNumber(form.notice)) {
    errors.notice = "Enter a whole number of days.";
  }
  if (!isBlankOrWholeNumber(form.window)) {
    errors.window = "Enter a whole number of days, or leave it blank.";
  }
  if (form.max.trim() && (!WHOLE_NUMBER.test(form.max.trim()) || Number(form.max) < 1)) {
    errors.max = "Enter 1 or more, or leave it blank for no limit.";
  }
  if (form.resched && !isBlankOrWholeNumber(form.reschedHours)) {
    errors.reschedHours = "Enter a whole number of hours.";
  }

  return errors;
};

/** The first step, up to `lastStep`, that has something to fix. -1 when there's nothing. */
const firstStepWithErrors = (errors: FormErrors, lastStep: number) => {
  let first = -1;
  for (const key of Object.keys(errors) as (keyof FormErrors)[]) {
    const step = STEP_OF[key];
    if (step > lastStep) continue;
    if (first === -1 || step < first) first = step;
  }
  return first;
};

/** The video options to offer. A saved choice that's no longer offered (say, Zoom turned off) still shows. */
const videoOptions = (offered: typeof PROVIDERS, current: Provider) => {
  for (const option of offered) {
    if (option.id === current) return offered;
  }
  const saved = PROVIDERS.find((option) => option.id === current);
  if (!saved) return offered;
  return [...offered, saved];
};

/** The steps across the top. Steps up to `reachable` can be clicked. */
const Stepper = ({ step, reachable, showDone, onPick }: { step: number; reachable: number; showDone: boolean; onPick: (step: number) => void }) => (
  <ol aria-label="Steps" className="list-none m-0 p-0 flex items-center gap-2.5">
    {STEPS.map(({ label }, index) => {
      const current = index === step;
      const done = showDone && index < step;
      let mark;
      if (done) {
        mark = (
          <span className="w-5 h-5 rounded-full grid place-items-center bg-surface-gray-10 text-ink-base">
            <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
          </span>
        );
      } else {
        mark = (
          <span
            className={cn(
              "w-5 h-5 rounded-full grid place-items-center border-[1.5px] box-border text-es-xs",
              current ? "border-ink-gray-9 font-medium" : "border-outline-gray-3"
            )}
          >
            {index + 1}
          </span>
        );
      }
      const canPick = !current && index <= reachable;
      return [
        index > 0 && <li key={`line-${index}`} aria-hidden="true" className={cn("flex-1 h-px", index <= step ? "bg-outline-gray-4" : "bg-outline-gray-2")} />,
        <li key={label}>
          <button
            type="button"
            disabled={!canPick}
            aria-current={current ? "step" : undefined}
            onClick={() => onPick(index)}
            className={cn(
              "flex items-center gap-2 p-0 border-0 bg-transparent text-es-sm rounded whitespace-nowrap focus-visible:outline-none focus-visible:shadow-es-focus",
              current ? "font-medium text-ink-gray-9" : index <= reachable ? "text-ink-gray-6" : "text-ink-gray-5",
              canPick ? "cursor-pointer hover:text-ink-gray-8" : "cursor-default"
            )}
          >
            {mark}
            <span className="max-sm:sr-only">{label}</span>
          </button>
        </li>,
      ];
    })}
  </ol>
);

const GroupForm = ({
  user,
  name,
  zoomReady,
  onSaved,
  onCancel,
  onDeleted,
}: {
  user: SessionUser;
  /** The group to change, or null for a new one. */
  name: string | null;
  zoomReady: boolean;
  onSaved: (name: string) => void;
  onCancel: () => void;
  onDeleted: () => void;
}) => {
  const { call, db } = useContext(FrappeContext) as FrappeConfig;
  const { data, error: loadError, mutate } = useFrappeGetCall<{ message: GroupDetail }>(GET_GROUP, name ? { group: name } : undefined, name ? undefined : null, {
    revalidateOnFocus: false,
  });
  const detail = name ? data?.message ?? null : null;
  const me: GroupPerson = { availability: user.name, user: user.name, full_name: user.fullName, is_mandatory: 1 };
  const isNew = !name;

  const [form, setForm] = useState<Form | null>(name ? null : toForm(null, me));
  const [templates, setTemplates] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  // A new group only reaches a step through the ones before it.
  const [furthest, setFurthest] = useState(isNew ? 0 : LAST_STEP);
  // Errors show on the steps someone has tried to leave or save.
  const [checkedUpTo, setCheckedUpTo] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (detail && !form) setForm(toForm(detail, me));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  useEffect(() => {
    db.getDocList<{ name: string }>(EMAIL_TEMPLATE, { fields: ["name"], orderBy: { field: "name", order: "asc" }, limit: 500 })
      .then((list) => setTemplates(list.map((t) => t.name)))
      .catch(() => setTemplates([]));
    // New groups start on the site's default group confirmation email, as the Desk form does.
    if (!name) {
      call
        .get(DEFAULT_EMAIL_TEMPLATES)
        .then(({ message }) => setForm((f) => (f && !f.template ? { ...f, template: message?.group ?? "" } : f)))
        .catch(() => undefined);
    }
  }, [db, call, name]);

  if (!form) {
    return (
      <Modal titleId="group-form-title" title={name} footer={<Button onClick={onCancel}>Close</Button>} onClose={onCancel}>
        {loadError ? (
          <Notice tone="red" title="Couldn't open this group">
            {errorText(loadError)}
          </Notice>
        ) : (
          <LoaderCircle className="w-5 h-5 mx-auto animate-spin text-ink-gray-5" aria-label="Loading" />
        )}
      </Modal>
    );
  }

  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const owner = detail?.doc.owner ?? user.name;
  const savedProvider = (detail?.doc.meet_provider || "None") as Provider;
  const providers = providersFor(zoomReady, detail ? savedProvider : "Google Meet");
  const errors = checkForm(form);
  const shown = (key: keyof FormErrors) => (STEP_OF[key] <= checkedUpTo ? errors[key] : undefined);

  const goTo = (next: number) => {
    setStep(next);
    if (next > furthest) setFurthest(next);
  };

  const next = () => {
    if (step > checkedUpTo) setCheckedUpTo(step);
    if (firstStepWithErrors(errors, step) === -1) goTo(step + 1);
  };

  const save = async () => {
    setCheckedUpTo(LAST_STEP);
    const stepToFix = firstStepWithErrors(errors, LAST_STEP);
    if (stepToFix !== -1) {
      setStep(stepToFix);
      return;
    }
    setError(null);
    setSaving(true);
    const values: Partial<AppointmentGroup> = {
      group_name: form.groupName.trim(),
      members: form.people.map((p) => ({ user: p.availability, is_mandatory: p.is_mandatory })),
      duration_for_event: form.duration,
      minimum_buffer_time: form.buffer || null,
      meet_provider: form.provider,
      meet_link: form.provider === "Custom" ? form.meetLink.trim() : "",
      response_email_template: form.template || null,
      minimum_notice_before_event: form.notice.trim() ? Number(form.notice) : 0,
      event_availability_window: form.window.trim() ? String(Number(form.window)) : "0",
      limit_booking_frequency: form.max.trim() ? Number(form.max) : -1,
      allow_rescheduling: form.resched ? 1 : 0,
      minimum_notice_for_reschedule: WHOLE_NUMBER.test(form.reschedHours.trim()) ? Number(form.reschedHours) : null,
    };
    try {
      if (name) {
        await db.updateDoc(APPOINTMENT_GROUP, name, values);
        // The group's page reads the same request, so this shows it the saved values.
        await mutate();
        onSaved(name);
      } else {
        const created = await db.createDoc(APPOINTMENT_GROUP, values);
        onSaved(created.name);
      }
    } catch (err) {
      setError(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.exc_type === "DuplicateEntryError"
          ? "A group with this link already exists. Go back to People and try a different name."
          : errorText(err)
      );
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!name) return;
    setDeleteError(null);
    try {
      await db.deleteDoc(APPOINTMENT_GROUP, name);
      onDeleted();
    } catch (err) {
      setDeleteError(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.exc_type === "LinkExistsError"
          ? "This group has bookings, so it can't be deleted. Its bookings would lose their group."
          : errorText(err)
      );
    }
  };

  const saveButton = (
    <Button variant="solid" size="md" onClick={save} disabled={saving}>
      {saving && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {isNew ? "Create group" : "Save"}
    </Button>
  );

  let footer;
  if (isNew) {
    footer = (
      <>
        {step === 0 ? (
          <Button size="md" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button size="md" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < LAST_STEP ? (
          <Button variant="solid" size="md" onClick={next}>
            Continue
          </Button>
        ) : (
          saveButton
        )}
      </>
    );
  } else {
    footer = (
      <>
        {detail?.can_edit ? (
          <Button className="bg-surface-red-2 text-ink-red-7 hover:bg-surface-red-3" onClick={() => setDeleting(true)}>
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Delete group
          </Button>
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button size="md" onClick={onCancel}>
            Cancel
          </Button>
          {saveButton}
        </span>
      </>
    );
  }

  const slug = form.groupName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const { heading, description } = STEPS[step];

  return (
    <Modal
      titleId="group-form-title"
      title={isNew ? "New group" : detail?.doc.group_name ?? name}
      aside={
        isNew && (
          <span className="text-es-sm text-ink-gray-5 tabular-nums">
            Step {step + 1} of {STEPS.length}
          </span>
        )
      }
      footer={footer}
      onClose={onCancel}
      className="w-[640px] max-sm:w-full"
    >
      <Stepper step={step} reachable={furthest} showDone={isNew} onPick={goTo} />

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-es-title font-semibold text-ink-gray-9">{heading}</h3>
        <p className="m-0 text-es-p-base text-ink-gray-6">{description}</p>
      </div>

      {step === 0 && (
        <>
          <Field id="group-name" label="Group name" error={shown("groupName")}>
            <input
              id="group-name"
              type="text"
              value={form.groupName}
              onChange={(e) => set({ groupName: e.target.value })}
              placeholder="Design review"
              aria-invalid={!!shown("groupName")}
              className={cn(fieldClass, shown("groupName") && "border-ink-red-7")}
            />
          </Field>
          <div className="flex flex-col gap-1">
            <span className="text-es-sm text-ink-gray-6">Link</span>
            <span className="text-es-base text-ink-gray-8 break-all">
              {window.location.host}/schedule/gr/{name ?? (slug || "…")}
            </span>
            <span className="text-es-p-sm text-ink-gray-5">
              {name ? "Set when the group was made. Renaming the group doesn't change it." : "Made from the name. It doesn't change later, even if you rename the group."}
            </span>
          </div>
          <section className="flex flex-col gap-2.5">
            <span className="text-es-base font-medium text-ink-gray-8">People</span>
            <PeopleList people={form.people} owner={owner} me={user.name} onChange={(people) => set({ people })} />
            {shown("people") && <span className="text-es-p-sm text-ink-red-7">{shown("people")}</span>}
          </section>
        </>
      )}

      {step === 1 && (
        <>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <Field id="group-length" label="Length">
              <SecondsSelect id="group-length" value={form.duration} choices={LENGTHS} onChange={(duration) => set({ duration })} />
            </Field>
            <Field id="group-break" label="Break between meetings">
              <SecondsSelect id="group-break" value={form.buffer} choices={BREAKS} none="No break" onChange={(buffer) => set({ buffer })} />
            </Field>
            <Field id="group-video" label="Video calls">
              <span className="relative">
                <select
                  id="group-video"
                  value={form.provider}
                  onChange={(e) => set({ provider: e.target.value as Provider })}
                  className={cn(fieldClass, "w-full pr-7 appearance-none cursor-pointer")}
                >
                  {videoOptions(providers, form.provider).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
              </span>
            </Field>
            <Field id="group-template" label="Confirmation email" hint={user.isSystemManager ? undefined : "Only a System Manager can change it."}>
              {!user.isSystemManager ? (
                <span id="group-template" className="h-7 flex items-center min-w-0 truncate text-es-base text-ink-gray-8">
                  {form.template || "None"}
                </span>
              ) : (
                <span className="relative">
                  <select
                    id="group-template"
                    value={form.template}
                    onChange={(e) => set({ template: e.target.value })}
                    className={cn(fieldClass, "w-full pr-7 appearance-none truncate cursor-pointer")}
                  >
                    {!form.template && <option value="">Choose an email</option>}
                    {(form.template && !templates.includes(form.template) ? [form.template, ...templates] : templates).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
                </span>
              )}
            </Field>
          </div>
          {form.provider === "Custom" && (
            <Field id="group-meet-link" label="Meeting link" error={shown("meetLink")}>
              <input
                id="group-meet-link"
                type="url"
                value={form.meetLink}
                onChange={(e) => set({ meetLink: e.target.value })}
                placeholder="https://zoom.us/j/1234567890"
                className={cn(fieldClass, shown("meetLink") && "border-ink-red-7")}
              />
            </Field>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-es-sm text-ink-gray-6">Calendar and organiser</span>
            <span className="text-es-base text-ink-gray-8">
              {owner === user.name ? "Your Google Calendar, with you as the organiser" : `${detail?.doc.event_creator}, organised by ${detail?.doc.event_organizer ?? "—"}`}
            </span>
            <span className="text-es-p-sm text-ink-gray-5">Bookings are added to this calendar, and invites come from it.</span>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <Field id="group-notice" label="Earliest booking" hint="Days from today. 0 allows same-day bookings." error={shown("notice")}>
              <NumberInput id="group-notice" value={form.notice} placeholder="0" error={shown("notice")} onChange={(notice) => set({ notice })} />
            </Field>
            <Field id="group-window" label="Book up to" hint="Days ahead, counted from the earliest booking day." error={shown("window")}>
              <NumberInput id="group-window" value={form.window} placeholder="No limit" error={shown("window")} onChange={(window) => set({ window })} />
            </Field>
            <Field id="group-max" label="Max per day" error={shown("max")}>
              <NumberInput id="group-max" value={form.max} placeholder="No limit" error={shown("max")} onChange={(max) => set({ max })} />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex flex-col gap-1">
              <span className="text-es-base text-ink-gray-8">Let people reschedule</span>
              <span className="text-es-p-sm text-ink-gray-5">They get a reschedule link in their confirmation email.</span>
            </span>
            <Switch checked={form.resched} onChange={(resched) => set({ resched })} label="Let people reschedule" />
          </div>
          {form.resched && (
            <Field id="group-resched" label="Stop rescheduling" hint="Hours before the meeting." error={shown("reschedHours")} className="w-1/2 max-sm:w-full">
              <NumberInput id="group-resched" value={form.reschedHours} placeholder="Any time" error={shown("reschedHours")} onChange={(reschedHours) => set({ reschedHours })} />
            </Field>
          )}
        </>
      )}

      {error && (
        <Notice tone="red" title="Couldn't save the group">
          {error}
        </Notice>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${detail?.doc.group_name ?? name}?`}
          confirmLabel="Delete"
          error={deleteError}
          onConfirm={remove}
          onCancel={() => setDeleting(false)}
        >
          Its link stops working for everyone.
        </ConfirmDialog>
      )}
    </Modal>
  );
};

export default GroupForm;
