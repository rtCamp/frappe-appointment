/**
 * The people in a group: initials, the list (with a required switch and remove for the owner), and a
 * popover to pick several people at once from everyone who has set up Appointments.
 */
import { useContext, useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";
import * as Popover from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";
import { GroupPerson, SEARCH_PEOPLE } from "./api";
import { buttonClass } from "./styles";
import { Button, Switch } from "./ui";

const TINTS = [
  "bg-surface-blue-2 text-ink-blue-7",
  "bg-surface-green-2 text-ink-green-7",
  "bg-surface-amber-2 text-ink-amber-7",
  "bg-surface-gray-3 text-ink-gray-7",
];

/** A stable tint per person, so the same person looks the same everywhere. */
const tintFor = (user: string) => {
  let sum = 0;
  for (let i = 0; i < user.length; i++) {
    sum += user.charCodeAt(i);
  }
  return TINTS[sum % TINTS.length];
};

/** What a person is in the group, under their name. */
const roleLabel = (person: GroupPerson, owner: string) => {
  if (person.user === owner) return "Made the group · required";
  if (person.is_mandatory) return "Required";
  return "Optional";
};

export const Initial = ({ person, size = "md", ring }: { person: { user: string; full_name: string }; size?: "sm" | "md"; ring?: boolean }) => (
  <span
    title={person.full_name}
    aria-hidden="true"
    className={cn(
      "shrink-0 rounded-full grid place-items-center font-medium box-border",
      size === "sm" ? "w-[22px] h-[22px] text-[11px]" : "w-7 h-7 text-es-xs",
      ring && "border-2 border-surface-base -ml-1.5 first:ml-0",
      tintFor(person.user)
    )}
  >
    {(person.full_name || person.user)[0]?.toUpperCase()}
  </span>
);

const plural = (n: number) => (n === 1 ? "1 person" : `${n} people`);

/**
 * "Add people": a popover to search and pick several people at once. People already in the group show as Added.
 * X, Escape or a click outside closes it, but with people picked it asks first.
 */
const AddPeople = ({
  taken,
  disabled,
  onAdd,
}: {
  taken: string[];
  disabled?: boolean;
  onAdd: (people: GroupPerson[]) => void;
}) => {
  const { call } = useContext(FrappeContext) as FrappeConfig;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GroupPerson[] | null>(null);
  const [picked, setPicked] = useState<GroupPerson[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    const id = window.setTimeout(async () => {
      try {
        const { message } = await call.get(SEARCH_PEOPLE, { txt: query });
        if (!stale) setResults(message);
      } catch {
        if (!stale) setResults([]);
      }
    }, 250);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
  }, [call, query, open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setPicked([]);
    setConfirming(false);
  };

  /** Closing would drop the people picked so far, so that asks first. */
  const requestClose = () => (picked.length ? setConfirming(true) : close());

  const isPicked = (p: GroupPerson) => picked.some((x) => x.availability === p.availability);
  const toggle = (p: GroupPerson) => {
    setConfirming(false);
    setPicked((current) => (isPicked(p) ? current.filter((x) => x.availability !== p.availability) : [...current, p]));
  };

  const add = () => {
    // New people join as required; the switch in the list changes that.
    onAdd(picked.map((p) => ({ ...p, is_mandatory: 1 })));
    close();
  };

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : requestClose())}>
      <Popover.Trigger className={cn(buttonClass("ghost"), "self-start mt-1")} disabled={disabled}>
        <Plus className="w-4 h-4" aria-hidden="true" />
        Add people
      </Popover.Trigger>
      {/* Not in a portal: it stays inside the group dialog, so Escape closes only the popover. */}
      <Popover.Content
        align="start"
        sideOffset={6}
        collisionPadding={8}
        aria-label="Add people"
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          if (confirming) setConfirming(false);
          else requestClose();
        }}
        onInteractOutside={(e) => {
          e.preventDefault();
          requestClose();
        }}
        className="z-20 w-[400px] max-w-[calc(100vw-32px)] flex flex-col rounded-xl border border-outline-gray-1 bg-surface-elevation-2 shadow-es-2xl"
      >
        <div className="flex items-center justify-between gap-2 h-10 pl-3 pr-1.5">
          <span className="text-es-sm font-medium text-ink-gray-8">Add people</span>
          <Button variant="ghost" className="w-7 px-0 text-ink-gray-6" aria-label="Close" onClick={requestClose}>
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>

        {picked.length > 0 && (
          <ul aria-label="Selected" className="m-0 px-3 pb-2 list-none flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <li key={p.availability} className="inline-flex items-center gap-1.5 h-6 px-0.5 rounded-full bg-surface-gray-2">
                <Initial person={p} size="sm" />
                <span className="text-es-sm text-ink-gray-8">{p.full_name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${p.full_name}`}
                  onClick={() => toggle(p)}
                  className="grid place-items-center w-5 h-5 p-0 border-0 rounded-full bg-transparent text-ink-gray-5 cursor-pointer hover:bg-surface-gray-3 hover:text-ink-gray-8 focus-visible:outline-none focus-visible:shadow-es-focus"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="px-2 pb-2">
          <div className="flex items-center gap-2 h-8 px-2 rounded-lg bg-surface-gray-2">
            <Search className="w-3.5 h-3.5 text-ink-gray-5" aria-hidden="true" />
            <input
              autoFocus
              type="search"
              aria-label="Search people"
              aria-controls="add-people-results"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
              className="flex-1 min-w-0 h-7 p-0 border-0 outline-none bg-transparent text-es-base text-ink-gray-8 placeholder:text-ink-gray-4"
            />
          </div>
        </div>

        <div id="add-people-results" role="group" aria-label="People" className="flex flex-col max-h-[272px] overflow-y-auto px-1.5 pb-1.5">
          {(results ?? []).map((p) => {
            const added = taken.includes(p.availability);
            return (
              <label
                key={p.availability}
                className={cn("flex items-center gap-2.5 min-h-11 px-2 py-1 rounded-lg", added ? "cursor-default" : "cursor-pointer hover:bg-surface-gray-2")}
              >
                <input
                  type="checkbox"
                  checked={added || isPicked(p)}
                  disabled={added}
                  onChange={() => toggle(p)}
                  aria-label={added ? `${p.full_name} is already in the group` : `Add ${p.full_name}`}
                  className="w-3.5 h-3.5 shrink-0 accent-[var(--ink-gray-9)] cursor-pointer disabled:cursor-default"
                />
                <span className={cn(added && "opacity-50")}>
                  <Initial person={p} />
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-px">
                  <span className={cn("truncate text-es-base font-medium", added ? "text-ink-gray-5" : "text-ink-gray-8")}>{p.full_name}</span>
                  <span className={cn("truncate text-es-xs", added ? "text-ink-gray-4" : "text-ink-gray-5")}>{p.user}</span>
                </span>
                {added && <span className="shrink-0 text-es-xs text-ink-gray-5">Added</span>}
              </label>
            );
          })}
          {results && !results.length && (
            <div className="flex flex-col items-center gap-1.5 px-3 py-5 text-center">
              <span className="text-es-base font-medium text-ink-gray-8">{query.trim() ? `No one found for “${query.trim()}”` : "No one found"}</span>
              <span className="text-es-p-sm text-ink-gray-5">Only people who've set up Appointments show up here.</span>
            </div>
          )}
        </div>

        {confirming ? (
          <div role="alertdialog" aria-labelledby="add-people-confirm" className="flex flex-wrap items-center justify-between gap-2 py-2 pr-2 pl-3 border-t border-outline-gray-1">
            <span id="add-people-confirm" className="text-es-base font-medium text-ink-gray-8">
              Discard {plural(picked.length)} selected?
            </span>
            <span className="flex gap-2">
              <Button autoFocus onClick={() => setConfirming(false)}>
                Keep picking
              </Button>
              <Button className="bg-surface-red-2 text-ink-red-7 hover:bg-surface-red-3" onClick={close}>
                Discard
              </Button>
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 py-2 pr-2 pl-3 border-t border-outline-gray-1">
            {picked.length ? (
              <Button variant="ghost" className="h-6 px-1.5 -ml-1.5 text-es-sm text-ink-gray-6" onClick={() => setPicked([])}>
                Clear
              </Button>
            ) : (
              <span className="text-es-p-sm text-ink-gray-5">Pick one or more.</span>
            )}
            <Button variant="solid" disabled={!picked.length} onClick={add}>
              {picked.length ? `Add ${plural(picked.length)}` : "Add people"}
            </Button>
          </div>
        )}
      </Popover.Content>
    </Popover.Root>
  );
};

/** The group's people. With `onChange`, the owner can mark who's required, remove people and add more. */
export const PeopleList = ({
  people,
  owner,
  me,
  onChange,
  disabled,
}: {
  people: GroupPerson[];
  owner: string;
  me: string;
  onChange?: (people: GroupPerson[]) => void;
  disabled?: boolean;
}) => {
  const editable = !!onChange;
  const setRequired = (availability: string, required: boolean) => {
    const isMandatory: 0 | 1 = required ? 1 : 0;
    const updated = people.map((person) => {
      if (person.availability !== availability) return person;
      return { ...person, is_mandatory: isMandatory };
    });
    onChange?.(updated);
  };

  const removePerson = (availability: string) => {
    const remaining = people.filter((person) => person.availability !== availability);
    onChange?.(remaining);
  };

  return (
    <div className="flex flex-col gap-1">
      {people.map((p) => {
        const isOwner = p.user === owner;
        return (
          <div key={p.availability} className="flex items-center gap-2.5 min-h-9">
            <Initial person={p} />
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="truncate text-es-base text-ink-gray-8">
                {p.full_name}
                {p.user === me && " (you)"}
              </span>
              <span className="text-es-sm text-ink-gray-5">
                {roleLabel(p, owner)}
              </span>
            </span>
            {editable && !isOwner && (
              <>
                <Switch
                  checked={!!p.is_mandatory}
                  onChange={(on) => setRequired(p.availability, on)}
                  label={`${p.full_name} is required`}
                  disabled={disabled}
                />
                <Button
                  variant="ghost"
                  className="w-7 px-0"
                  aria-label={`Remove ${p.full_name}`}
                  onClick={() => removePerson(p.availability)}
                  disabled={disabled}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </Button>
              </>
            )}
          </div>
        );
      })}
      {editable && (
        <AddPeople taken={people.map((p) => p.availability)} disabled={disabled} onAdd={(added) => onChange?.([...people, ...added])} />
      )}
      {editable && <span className="text-es-p-sm text-ink-gray-5">The switch marks who's required. Times are offered only when everyone required is free.</span>}
    </div>
  );
};
