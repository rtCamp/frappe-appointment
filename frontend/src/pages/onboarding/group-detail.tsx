/**
 * One group: its link, its bookings (upcoming or past), its people and rules. The person who made it can
 * change who's in it and its availability alerts here; everyone else sees it read-only.
 */
import { ReactNode, useContext, useEffect, useState } from "react";
import { ChevronDown, Info, LoaderCircle } from "lucide-react";
import { FrappeConfig, FrappeContext, useFrappeGetCall } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import {
  APPOINTMENT_GROUP,
  CalendarProblem,
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE,
  GET_CALENDAR_PROBLEMS,
  GET_GROUP,
  GET_GROUP_BOOKINGS,
  GroupBooking,
  GroupDetail,
  GroupPerson,
  SessionUser,
  durationLabel,
  errorText,
  fromSiteTime,
  groupLink,
  providerLabel,
} from "./api";
import { WHOLE_NUMBER, daysLabel } from "./booking-rules";
import { fieldClass } from "./form-fields";
import { Frame, FrameNav } from "./frame";
import { Initial, PeopleList } from "./group-people";
import { Button, LinkBar, Notice, Switch } from "./ui";

const Section = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) => (
  <section className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2">
      <h2 className="m-0 text-es-lg font-semibold text-ink-gray-8">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

/** The group's people who are in a booking, at most four, for the little avatars. */
const peopleInBooking = (booking: GroupBooking, people: GroupPerson[]) => {
  const found: GroupPerson[] = [];
  for (const email of booking.members) {
    const person = people.find((p) => p.availability === email);
    if (person && found.length < 4) found.push(person);
  }
  return found;
};

/** "From 1 day ahead, up to 14 days after", from the group's notice and booking window. */
const bookableLabel = (doc: GroupDetail["doc"]) => {
  const start = doc.minimum_notice_before_event ? `From ${daysLabel(doc.minimum_notice_before_event)} ahead` : "From the same day";

  const windowText = String(doc.event_availability_window ?? "").trim();
  const windowDays = WHOLE_NUMBER.test(windowText) ? Number(windowText) : 0;
  if (windowDays > 0) return `${start}, up to ${daysLabel(windowDays)} after`;
  return `${start}, no end`;
};

/** Who's shown as organiser: you, the owner by name, or whoever an admin set. */
const organizerLabel = (detail: GroupDetail, me: string) => {
  const organizer = detail.doc.event_organizer;
  if (!organizer) return "None";
  if (organizer === me) return "You";
  if (organizer === detail.doc.owner) return detail.owner_name;
  return organizer;
};

const Bookings = ({ user, group, people }: { user: SessionUser; group: string; people: GroupPerson[] }) => {
  const [past, setPast] = useState(false);
  const { data, isLoading } = useFrappeGetCall<{ message: GroupBooking[] }>(GET_GROUP_BOOKINGS, { group, past: past ? 1 : 0 }, undefined, {
    revalidateOnFocus: false,
  });
  const bookings = data?.message ?? [];
  const inZone = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: user.timeZone, ...options }).format(fromSiteTime(value, user.siteTimeZone));
  const time = (value: string) => inZone(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <Section
      title="Bookings"
      action={
        <div role="group" aria-label="Which bookings" className="flex gap-0.5 p-0.5 rounded-lg bg-surface-gray-2">
          {[
            { id: false, label: "Upcoming" },
            { id: true, label: "Past" },
          ].map((v) => (
            <button
              key={v.label}
              type="button"
              aria-pressed={past === v.id}
              onClick={() => setPast(v.id)}
              className={cn(
                "h-6 px-2.5 rounded-md border-0 text-es-sm cursor-pointer focus-visible:outline-none focus-visible:shadow-es-focus",
                past === v.id ? "bg-surface-elevation-3 shadow-es-sm text-ink-gray-9" : "bg-transparent text-ink-gray-6"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col border-t border-outline-gray-1">
        {!isLoading && bookings.length === 0 && (
          <p className="m-0 py-3 text-es-p-sm text-ink-gray-5 border-b border-outline-gray-1">
            {past ? "No past bookings." : "No upcoming bookings yet. Share the group's link to get some."}
          </p>
        )}
        {bookings.map((b) => (
          <div key={b.name} className="flex items-center gap-3 py-3 border-b border-outline-gray-1">
            <span className="w-11 shrink-0 flex flex-col items-center gap-0.5 py-1 rounded-lg bg-surface-gray-1">
              <span className="text-es-xs text-ink-gray-5">{inZone(b.starts_on, { weekday: "short" })}</span>
              <span className="text-es-base font-medium tabular-nums text-ink-gray-8">{inZone(b.starts_on, { day: "numeric" })}</span>
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="truncate text-es-base font-medium text-ink-gray-8">{b.subject}</span>
              <span className="truncate text-es-sm tabular-nums text-ink-gray-5">
                {time(b.starts_on)}
                {b.ends_on && ` – ${time(b.ends_on)}`} · {b.guests.length ? b.guests.join(", ") : "No guest details"}
                {b.status === "Cancelled" && " · Cancelled"}
              </span>
            </span>
            <span className="flex pl-1.5">
              {peopleInBooking(b, people).map((p) => (
                <Initial key={p.availability} person={p} size="sm" ring />
              ))}
            </span>
          </div>
        ))}
      </div>
      <span className="text-es-p-sm text-ink-gray-5">Everyone who booked through the group's link, with the details they entered. Times are in your time zone.</span>
    </Section>
  );
};

const Alerts = ({ detail, onSaved }: { detail: GroupDetail; onSaved: () => Promise<unknown> }) => {
  const { call, db } = useContext(FrappeContext) as FrappeConfig;
  const doc = detail.doc;
  const [threshold, setThreshold] = useState(String(doc.min_slot_threshold ?? 2));
  const [email, setEmail] = useState(doc.email_address_to_send ?? "");
  const [template, setTemplate] = useState(doc.availability_email_template ?? "");
  const [templates, setTemplates] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.getDocList<{ name: string }>(EMAIL_TEMPLATE, { fields: ["name"], orderBy: { field: "name", order: "asc" }, limit: 500 })
      .then((list) => setTemplates(list.map((t) => t.name)))
      .catch(() => setTemplates([]));
  }, [db]);

  const save = async (values: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await db.updateDoc(APPOINTMENT_GROUP, doc.name, values);
      await onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // Turning alerts on fills in what the daily alert needs: the default alert email and the owner's address.
  const toggle = async (on: boolean) => {
    if (!on) return save({ send_email_alerts: 0 });
    const fallback = template || (await call.get(DEFAULT_EMAIL_TEMPLATES)).message?.availability || "";
    setTemplate(fallback);
    setEmail(email || detail.doc.owner);
    return save({ send_email_alerts: 1, availability_email_template: fallback, email_address_to_send: email || detail.doc.owner });
  };

  const thresholdOk = /^-?\d+$/.test(threshold.trim());
  const changed =
    threshold.trim() !== String(doc.min_slot_threshold ?? 2) || email.trim() !== (doc.email_address_to_send ?? "") || template !== (doc.availability_email_template ?? "");

  return (
    <section className="flex flex-col gap-3 p-4 rounded-xl border border-outline-gray-1">
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-1">
          <h2 className="m-0 text-es-base font-medium text-ink-gray-8">Availability alerts</h2>
          <span className="text-es-p-sm text-ink-gray-5">
            A daily email when the group is running low on free times, to the required people and the address below.
          </span>
        </span>
        <Switch checked={!!doc.send_email_alerts} onChange={toggle} label="Availability alerts" disabled={busy} />
      </div>
      {!!doc.send_email_alerts && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="alert-threshold" className="text-es-sm text-ink-gray-6">
              Alert when free slots drop below
            </label>
            <input
              id="alert-threshold"
              type="text"
              inputMode="numeric"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              aria-invalid={!thresholdOk}
              className={cn(fieldClass, "w-24 tabular-nums", !thresholdOk && "border-ink-red-7")}
            />
            <span className="text-es-p-sm text-ink-gray-5">-1 sends it every day.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="alert-email" className="text-es-sm text-ink-gray-6">
              Also email
            </label>
            <input id="alert-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="alert-template" className="text-es-sm text-ink-gray-6">
              Alert email
            </label>
            <span className="relative">
              <select
                id="alert-template"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className={cn(fieldClass, "w-full pr-7 appearance-none truncate cursor-pointer")}
              >
                {!template && <option value="">Choose an email</option>}
                {(template && !templates.includes(template) ? [template, ...templates] : templates).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
            </span>
          </div>
          <Button
            variant="solid"
            className="self-start"
            onClick={() =>
              save({ min_slot_threshold: Number(threshold.trim()), email_address_to_send: email.trim(), availability_email_template: template })
            }
            disabled={!changed || !thresholdOk || !email.trim() || !template || busy}
          >
            {busy && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </div>
      )}
      {error && (
        <Notice tone="red" title="Couldn't save the alerts">
          {error}
        </Notice>
      )}
    </section>
  );
};

/** "you", "Ana Lima (ana@example.com)", joined as "you and Ana Lima (...)". */
const problemNames = (problems: CalendarProblem[]) => {
  const names = problems.map((p) => (p.is_me ? "you" : `${p.full_name} (${p.user})`));
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/** Warns when a calendar the group's booking page needs no longer works, so guests can't book. */
const CalendarProblems = ({ group, onReconnect }: { group: string; onReconnect: () => void }) => {
  const { data } = useFrappeGetCall<{ message: CalendarProblem[] }>(GET_CALENDAR_PROBLEMS, { group }, undefined, { revalidateOnFocus: false });
  const problems = data?.message ?? [];
  if (!problems.length) return null;

  const mine = problems.some((p) => p.is_me);
  const others = problems.some((p) => !p.is_me);
  let fix = "Reconnect it to let guests book again.";
  if (others) fix = mine ? "Each of you needs to reconnect it in Settings → Calendar." : "They need to reconnect it in Settings → Calendar.";

  return (
    <Notice
      tone="amber"
      title="Guests can't book this group right now"
      actions={mine && <Button onClick={onReconnect}>Reconnect your calendar</Button>}
    >
      Google no longer accepts the calendar sign-in for {problemNames(problems)}, so the booking page can't show free times. {fix}
    </Notice>
  );
};

const GroupPage = ({
  user,
  name,
  nav,
  onBack,
  onEdit,
  onReconnect,
}: {
  user: SessionUser;
  name: string;
  nav: FrameNav;
  onBack: () => void;
  onEdit: () => void;
  /** Opens Settings at the calendar, to reconnect your own Google Calendar. */
  onReconnect: () => void;
}) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const { data, error, mutate } = useFrappeGetCall<{ message: GroupDetail }>(GET_GROUP, { group: name }, undefined, { revalidateOnFocus: false });
  const [saving, setSaving] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const detail = data?.message;
  const doc = detail?.doc;
  const link = groupLink(name);

  const savePeople = async (people: GroupPerson[]) => {
    setSaving(true);
    setPeopleError(null);
    try {
      await db.updateDoc(APPOINTMENT_GROUP, name, { members: people.map((p) => ({ user: p.availability, is_mandatory: p.is_mandatory })) });
      await mutate();
    } catch (err) {
      setPeopleError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const title = (
    <>
      <button
        type="button"
        onClick={onBack}
        className="p-0 border-0 bg-transparent text-es-lg font-semibold text-ink-gray-5 cursor-pointer hover:text-ink-gray-8 focus-visible:outline-none focus-visible:shadow-es-focus rounded"
      >
        Group meetings
      </button>
      <span aria-hidden="true" className="text-ink-gray-4">
        /
      </span>
      <span className="truncate">{doc?.group_name ?? name}</span>
    </>
  );


  return (
    <Frame
      user={user}
      title={title}
      width="home"
      {...nav}
      headerAction={detail?.can_edit && <Button onClick={onEdit}>Edit</Button>}
    >
      {error && (
        <Notice tone="red" title="Couldn't open this group" actions={<Button onClick={onBack}>Back to groups</Button>}>
          {errorText(error)}
        </Notice>
      )}
      {detail && doc && (
        <>
          <CalendarProblems group={name} onReconnect={onReconnect} />
          {!detail.can_edit && (
            <Notice tone="blue" icon={<Info className="w-4 h-4 shrink-0 mt-px text-ink-blue-5" aria-hidden="true" />} title="You're in this group">
              {detail.owner_name} made it, so only they can change it. You can share its link and see its bookings.
            </Notice>
          )}
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex-[999_1_480px] min-w-0 flex flex-col gap-7">
              <LinkBar link={link} />
              <Bookings user={user} group={name} people={detail.people} />
            </div>

            <aside aria-label="About this group" className="flex-[1_1_300px] min-w-0 flex flex-col gap-7">
              <Section title="People">
                <PeopleList
                  people={detail.people}
                  owner={doc.owner}
                  me={user.name}
                  onChange={detail.is_owner || detail.can_edit ? savePeople : undefined}
                  disabled={saving}
                />
                {peopleError && (
                  <Notice tone="red" title="Couldn't change the people">
                    {peopleError}
                  </Notice>
                )}
              </Section>

              <Section title="Details">
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-es-base">
                  <dt className="text-ink-gray-5">Length</dt>
                  <dd className="m-0">
                    {durationLabel(doc.duration_for_event)}
                    {doc.minimum_buffer_time ? `, ${durationLabel(doc.minimum_buffer_time)} break` : ""}
                  </dd>
                  <dt className="text-ink-gray-5">Video</dt>
                  <dd className="m-0">{providerLabel(doc.meet_provider)}</dd>
                  <dt className="text-ink-gray-5">Bookable</dt>
                  <dd className="m-0">{bookableLabel(doc)}</dd>
                  <dt className="text-ink-gray-5">Max per day</dt>
                  <dd className="m-0">{doc.limit_booking_frequency != null && doc.limit_booking_frequency >= 0 ? doc.limit_booking_frequency : "No limit"}</dd>
                  <dt className="text-ink-gray-5">Reschedule</dt>
                  <dd className="m-0">
                    {!doc.allow_rescheduling
                      ? "Off"
                      : doc.minimum_notice_for_reschedule
                        ? `Until ${doc.minimum_notice_for_reschedule} hrs before`
                        : "Any time"}
                  </dd>
                  <dt className="text-ink-gray-5">Calendar</dt>
                  <dd className="m-0 break-all">{doc.event_creator}</dd>
                  <dt className="text-ink-gray-5">Organiser</dt>
                  <dd className="m-0 break-all">{organizerLabel(detail, user.name)}</dd>
                </dl>
              </Section>

              {detail.is_owner && <Alerts detail={detail} onSaved={mutate} />}
            </aside>
          </div>
        </>
      )}
    </Frame>
  );
};

export default GroupPage;
