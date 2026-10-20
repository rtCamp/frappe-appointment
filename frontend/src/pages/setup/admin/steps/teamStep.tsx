/**
 * Team step: who has finished their own setup, the link to send them, and group meetings
 * (Appointment Groups) with a short form for a new one. Everything else on a group is in Desk.
 */
import { useMemo, useRef, useState } from "react";
import { Check, ExternalLink, LoaderCircle, Plus, Search, Users, Video, X } from "lucide-react";

import { errorText } from "../../api";
import { AdminApi, AdminStatus, TeamMember, groupNameToId, zoomReady } from "../api";
import { CopyButton, Field, LinkBox, Notice, StepHeader, Switch } from "../ui";
import { toastSaved } from "../utils";

const PAGE = 8;
const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30];

const minutesLabel = (m: number) =>
  m === 0 ? "No break" : m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)} hr ${m % 60} min`;

const providerLabel = (p: string | null) => (!p || p === "None" ? "No video link" : p === "Custom" ? "Fixed link" : p);

const initial = (name: string) => name.trim()[0]?.toUpperCase() ?? "?";

const memberPill = (m: TeamMember) => {
  if (m.booking_live) return <span className="pill pill-green">Booking page live</span>;
  if (m.availability) return <span className="pill pill-blue">Hours set</span>;
  if (m.calendar_connected) return <span className="pill pill-amber">Needs hours</span>;
  if (m.has_calendar) return <span className="pill pill-amber">Calendar not connected</span>;
  return <span className="pill">Not started</span>;
};

const People = ({ status }: { status: AdminStatus }) => {
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const team = status.team;
  const stats = [
    { n: team.filter((m) => m.calendar_connected).length, label: "calendars connected" },
    { n: team.filter((m) => m.availability).length, label: "with working hours" },
    { n: team.filter((m) => m.booking_live).length, label: "booking pages live" },
  ];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return team.filter(
      (m) =>
        (!pendingOnly || !m.availability) &&
        (!q || m.full_name.toLowerCase().includes(q) || m.user.toLowerCase().includes(q))
    );
  }, [team, query, pendingOnly]);
  const visible = showAll ? rows : rows.slice(0, PAGE);

  return (
    <section className="flex flex-col gap-3">
      <div className="row-text">
        <span className="t-base-medium">People</span>
        <span className="t-p-sm" style={{ color: "var(--ink-gray-5)" }}>
          Everyone connects their own calendar and sets their hours. Send them this link.
        </span>
      </div>
      <LinkBox value={`${window.location.origin}/schedule`} open />

      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl px-3 py-3" style={{ background: "var(--surface-gray-1)" }}>
            <p className="m-0 tabular" style={{ fontSize: 20, fontWeight: 600, color: "var(--ink-gray-9)" }}>
              {s.n}
              <span className="t-sm" style={{ color: "var(--ink-gray-5)" }}>
                {" "}
                / {team.length}
              </span>
            </p>
            <p className="t-sm m-0 mt-1" style={{ color: "var(--ink-gray-6)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 p-3" style={{ borderBottom: "1px solid var(--outline-gray-1)" }}>
          <div className="relative flex-1 min-w-48">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--ink-gray-5)" }}
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search people"
              placeholder="Search by name or email"
              className="input"
              style={{ paddingLeft: 30 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 t-sm" style={{ color: "var(--ink-gray-6)" }}>
            <Switch checked={pendingOnly} onChange={setPendingOnly} label="Only people who haven't finished" />
            Not finished
          </label>
        </div>
        {rows.length === 0 ? (
          <p className="t-p-sm m-0 p-4" style={{ color: "var(--ink-gray-5)" }}>
            No one matches.
          </p>
        ) : (
          <ul className="divide list-none m-0 p-0">
            {visible.map((m) => (
              <li key={m.user} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="avatar" aria-hidden="true">
                  {initial(m.full_name)}
                </span>
                <span className="row-text flex-1">
                  <span className="t-base truncate">{m.full_name}</span>
                  <span className="t-sm truncate" style={{ color: "var(--ink-gray-5)" }}>
                    {m.user}
                  </span>
                </span>
                {memberPill(m)}
              </li>
            ))}
          </ul>
        )}
        {rows.length > PAGE && (
          <div className="p-2" style={{ borderTop: "1px solid var(--outline-gray-1)" }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${rows.length}`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

const NewGroup = ({
  api,
  status,
  adminUser,
  onCancel,
  onCreated,
}: {
  api: AdminApi;
  status: AdminStatus;
  adminUser: string;
  onCancel?: () => void;
  onCreated: (name: string) => Promise<void>;
}) => {
  const candidates = useMemo(() => status.team.filter((m) => m.availability), [status.team]);
  const zoomOn = zoomReady(status);

  const [groupName, setGroupName] = useState("");
  const [eventCreator, setEventCreator] = useState(
    () => (status.calendars.find((c) => c.user === adminUser) ?? status.calendars[0])?.name ?? ""
  );
  const [members, setMembers] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [provider, setProvider] = useState("Google Meet");
  const [meetLink, setMeetLink] = useState("");
  const [zoomEmail, setZoomEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const creator = status.calendars.find((c) => c.name === eventCreator);
  const needsZoomEmail = provider === "Zoom" && !!creator && !creator.zoom_email;
  const groupId = groupNameToId(groupName);
  const taken = !!groupId && status.groups.some((g) => g.name === groupId);
  const chosen = Object.keys(members);
  const required = chosen.filter((k) => members[k]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((m) => !q || m.full_name.toLowerCase().includes(q) || m.user.toLowerCase().includes(q))
      .slice(0, 20);
  }, [candidates, query]);

  const problem = !groupName.trim()
    ? "Give the group a name."
    : taken
      ? "A group meeting with this name already exists."
      : !eventCreator
        ? "Pick the calendar that creates the events."
        : !chosen.length
          ? "Add at least one person."
          : !required.length
            ? "Mark at least one person as required."
            : provider === "Custom" && !/^https?:\/\/\S+$/.test(meetLink.trim())
              ? "Enter the meeting link, starting with https://"
              : needsZoomEmail && !/^\S+@\S+\.\S+$/.test(zoomEmail.trim())
                ? "Enter the Zoom email for the event calendar."
                : null;

  const nameOf = (availability: string) =>
    candidates.find((m) => m.availability === availability)?.full_name ?? availability;

  const create = async () => {
    if (problem) return;
    setError(null);
    setSaving(true);
    try {
      if (needsZoomEmail) await api.setZoomEmail(eventCreator, zoomEmail.trim());
      await api.createGroup({
        group_name: groupName.trim(),
        event_creator: eventCreator,
        members: chosen.map((user) => ({ user, is_mandatory: members[user] ? 1 : 0 })),
        duration_for_event: minutes * 60,
        minimum_buffer_time: buffer * 60,
        meet_provider: provider,
        meet_link: provider === "Custom" ? meetLink.trim() : null,
        response_email_template: status.templates.group,
      });
      toastSaved("Group created");
      await onCreated(groupId);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card flex flex-col gap-6 p-4">
      <div className="row-text">
        <span className="t-base-medium">New group</span>
        <span className="t-p-sm" style={{ color: "var(--ink-gray-5)" }}>
          Guests only see times when every required person is free.
        </span>
      </div>

      <Field
        label="Group name"
        htmlFor="admin-group-name"
        hint={groupId ? `Link: ${window.location.host}/schedule/gr/${groupId}` : undefined}
        error={taken ? "A group meeting with this name already exists." : undefined}
      >
        <input
          id="admin-group-name"
          className="input"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Interview panel"
          aria-invalid={taken}
        />
      </Field>

      <section className="flex flex-col gap-2.5">
        <div className="row-text">
          <span className="t-base-medium">People</span>
          <span className="t-p-sm" style={{ color: "var(--ink-gray-5)" }}>
            Only people who have set their working hours can be added.
          </span>
        </div>

        <div
          ref={searchRef}
          className="relative"
          onBlur={(e) => {
            if (!searchRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
          }}
        >
          <div
            className="flex items-center gap-2 h-8 px-2.5 rounded-lg"
            style={{ border: "1px solid var(--outline-gray-2)", background: "var(--surface-base)" }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--ink-gray-5)" }} aria-hidden="true" />
            <input
              type="search"
              role="combobox"
              aria-expanded={open}
              aria-controls="admin-group-people"
              aria-label="Search people"
              placeholder={`Search ${candidates.length} people`}
              className="t-base flex-1 min-w-0 h-7 border-0 outline-none bg-transparent"
              style={{ color: "var(--ink-gray-8)" }}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            />
            {open && (
              <button type="button" className="btn t-sm h-6 px-1.5" onClick={() => setOpen(false)}>
                Done
              </button>
            )}
          </div>
          {open && (
            <div id="admin-group-people" role="listbox" aria-label="People" aria-multiselectable="true" className="listbox">
              {results.length === 0 ? (
                <p className="t-p-sm m-0 p-3" style={{ color: "var(--ink-gray-5)" }}>
                  {candidates.length ? "No one matches." : "No one has set their working hours yet."}
                </p>
              ) : (
                results.map((m) => {
                  const added = m.availability! in members;
                  return (
                    <button
                      key={m.user}
                      type="button"
                      role="option"
                      aria-selected={added}
                      className="option"
                      onClick={() =>
                        setMembers((cur) => {
                          const next = { ...cur };
                          if (added) delete next[m.availability!];
                          else next[m.availability!] = true;
                          return next;
                        })
                      }
                    >
                      <span className="avatar" aria-hidden="true">
                        {initial(m.full_name)}
                      </span>
                      <span className="row-text flex-1">
                        <span className="t-base">{m.full_name}</span>
                        <span className="t-sm truncate" style={{ color: "var(--ink-gray-5)" }}>
                          {m.user}
                        </span>
                      </span>
                      {added && (
                        <span className="t-sm inline-flex items-center gap-1" style={{ color: "var(--ink-gray-6)" }}>
                          <Check className="w-3.5 h-3.5" aria-hidden="true" /> Added
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {chosen.length > 0 && (
          <ul className="card divide list-none m-0 p-0">
            {chosen.map((a) => (
              <li key={a} className="flex items-center gap-3 px-3 py-2">
                <span className="avatar" aria-hidden="true">
                  {initial(nameOf(a))}
                </span>
                <span className="t-base flex-1 min-w-0 truncate">{nameOf(a)}</span>
                <span className="t-sm" style={{ color: "var(--ink-gray-6)" }}>
                  Required
                </span>
                <Switch
                  checked={members[a]}
                  onChange={(v) => setMembers((cur) => ({ ...cur, [a]: v }))}
                  label={`${nameOf(a)} is required`}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={`Remove ${nameOf(a)}`}
                  onClick={() =>
                    setMembers((cur) => {
                      const next = { ...cur };
                      delete next[a];
                      return next;
                    })
                  }
                >
                  <X aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Field
        label="Event calendar"
        htmlFor="admin-group-creator"
        hint="Bookings are created on this calendar, and everyone is invited from it."
      >
        <select
          id="admin-group-creator"
          className="input"
          value={eventCreator}
          onChange={(e) => setEventCreator(e.target.value)}
        >
          {!eventCreator && <option value="">Pick a connected calendar</option>}
          {status.calendars.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name === c.user ? c.full_name : `${c.name} (${c.full_name})`}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Length" htmlFor="admin-group-length">
          <select
            id="admin-group-length"
            className="input"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          >
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {minutesLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Break after" htmlFor="admin-group-buffer">
          <select
            id="admin-group-buffer"
            className="input"
            value={buffer}
            onChange={(e) => setBuffer(Number(e.target.value))}
          >
            {BUFFER_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {minutesLabel(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Video call" htmlFor="admin-group-provider">
          <select
            id="admin-group-provider"
            className="input"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="Google Meet">Google Meet</option>
            <option value="Zoom" disabled={!zoomOn}>
              Zoom{zoomOn ? "" : " (turn on in Video calls)"}
            </option>
            <option value="Custom">Fixed link</option>
            <option value="None">No video link</option>
          </select>
        </Field>
      </div>

      {provider === "Custom" && (
        <Field label="Meeting link" htmlFor="admin-group-link">
          <input
            id="admin-group-link"
            type="url"
            className="input"
            value={meetLink}
            onChange={(e) => setMeetLink(e.target.value)}
            placeholder="https://zoom.us/j/1234567890"
          />
        </Field>
      )}
      {needsZoomEmail && (
        <Field
          label="Zoom email for the event calendar"
          htmlFor="admin-group-zoom-email"
          hint="Zoom meetings are created under this licensed Zoom user."
        >
          <input
            id="admin-group-zoom-email"
            type="email"
            className="input"
            value={zoomEmail}
            onChange={(e) => setZoomEmail(e.target.value)}
            placeholder={creator?.user}
          />
        </Field>
      )}

      {error && <Notice tone="red" title="Couldn't create the group">{error}</Notice>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {problem && (groupName || chosen.length > 0) && (
          <span className="t-p-sm mr-auto" style={{ color: "var(--ink-gray-5)" }}>
            {problem}
          </span>
        )}
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn btn-solid" onClick={create} disabled={saving || !!problem}>
          {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          Create group
        </button>
      </div>
    </div>
  );
};

const Groups = ({
  api,
  status,
  adminUser,
  onSaved,
}: {
  api: AdminApi;
  status: AdminStatus;
  adminUser: string;
  onSaved: () => Promise<AdminStatus | undefined>;
}) => {
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const canCreate = status.calendars.length > 0 && status.team.some((m) => m.availability);
  const empty = status.groups.length === 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="row-text">
          <span className="t-base-medium">Group meetings</span>
          <span className="t-p-sm" style={{ color: "var(--ink-gray-5)" }}>
            One link that finds a time when everyone in the group is free. Good for interview panels, client calls and
            reviews.
          </span>
        </div>
        {!empty && !creating && canCreate && (
          <button type="button" className="btn btn-solid" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> New group
          </button>
        )}
      </div>

      {!canCreate && (
        <Notice tone="amber" title="No one can be added yet">
          {status.calendars.length === 0
            ? "A group needs a connected calendar to create its events. Connect yours in the Your calendar step."
            : "People need to set their working hours before they can join a group. Send them the link above."}
        </Notice>
      )}

      {empty && !creating && canCreate && (
        <div
          className="flex flex-col items-center gap-3 px-6 py-12 rounded-xl text-center"
          style={{ border: "1px dashed var(--outline-gray-2)" }}
        >
          <Users className="w-6 h-6" style={{ color: "var(--ink-gray-5)" }} aria-hidden="true" />
          <span className="t-base-medium">No group meetings yet</span>
          <span className="t-p-sm max-w-sm" style={{ color: "var(--ink-gray-5)" }}>
            Pick the people, set the rules once, and share one link.
          </span>
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            New group
          </button>
        </div>
      )}

      {creating && (
        <NewGroup
          api={api}
          status={status}
          adminUser={adminUser}
          onCancel={() => setCreating(false)}
          onCreated={async (name) => {
            setJustCreated(name);
            setCreating(false);
            await onSaved();
          }}
        />
      )}

      {!empty && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {status.groups.map((g) => {
            const link = `${window.location.origin}/schedule/gr/${encodeURIComponent(g.name)}`;
            return (
              <div
                key={g.name}
                className="card flex flex-col gap-4 p-4"
                style={
                  g.name === justCreated
                    ? { borderColor: "var(--outline-gray-4)", boxShadow: "var(--elevation-sm)" }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="row-text">
                    <span className="t-base-medium truncate">{g.group_name}</span>
                    <span className="t-sm flex items-center gap-1.5" style={{ color: "var(--ink-gray-5)" }}>
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      {g.members} {g.members === 1 ? "person" : "people"}
                      <span aria-hidden="true">·</span>
                      <Video className="w-3.5 h-3.5" aria-hidden="true" />
                      {providerLabel(g.meet_provider)}
                    </span>
                  </span>
                  <a
                    href={`/desk/appointment-group/${encodeURIComponent(g.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${g.group_name} in Desk`}
                    title="More options in Desk"
                    className="btn btn-ghost btn-icon"
                  >
                    <ExternalLink aria-hidden="true" />
                  </a>
                </div>
                <div className="linkbox">
                  <span className="t-sm flex-1 min-w-0 truncate" style={{ color: "var(--ink-gray-7)" }} title={link}>
                    …/schedule/gr/{g.name}
                  </span>
                  <CopyButton text={link} label="Copy link" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!empty && (
        <p className="field-hint">Notice periods, booking windows, slot alerts and linking to a doctype are in Desk.</p>
      )}
    </section>
  );
};

const TeamStep = ({
  api,
  status,
  adminUser,
  onSaved,
  onBack,
  onNext,
}: {
  api: AdminApi;
  status: AdminStatus;
  adminUser: string;
  onSaved: () => Promise<AdminStatus | undefined>;
  onBack: () => void;
  onNext: () => void;
}) => (
  <>
    <StepHeader title="Your team">
      See who's ready, and set up group meetings that find a time when everyone needed is free.
    </StepHeader>
    <People status={status} />
    <Groups api={api} status={status} adminUser={adminUser} onSaved={onSaved} />
    <div className="flex justify-between gap-2">
      <button type="button" className="btn btn-md" onClick={onBack}>
        Back
      </button>
      <button type="button" className="btn btn-md btn-solid" onClick={onNext}>
        Continue
      </button>
    </div>
  </>
);

export default TeamStep;
