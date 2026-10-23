/**
 * The people in a group: initials, the list (with a required switch and remove for the owner), and a
 * search to add anyone who has set up Appointments.
 */
import { useContext, useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import { GroupPerson, SEARCH_PEOPLE } from "./api";
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

const AddPerson = ({ taken, onAdd }: { taken: string[]; onAdd: (person: GroupPerson) => void }) => {
  const { call } = useContext(FrappeContext) as FrappeConfig;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GroupPerson[] | null>(null);

  useEffect(() => {
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
  }, [call, query]);

  const shown = (results ?? []).filter((p) => !taken.includes(p.availability));

  return (
    <div className="flex flex-col gap-1 p-2 rounded-xl border border-outline-gray-2 bg-surface-base">
      <div className="flex items-center gap-2 h-7 px-2 rounded-lg bg-surface-gray-2">
        <Search className="w-3.5 h-3.5 text-ink-gray-5" aria-hidden="true" />
        <input
          autoFocus
          type="search"
          aria-label="Search people"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="flex-1 min-w-0 h-7 p-0 border-0 outline-none bg-transparent text-es-base text-ink-gray-8 placeholder:text-ink-gray-4"
        />
      </div>
      <div role="listbox" aria-label="People" className="flex flex-col max-h-56 overflow-y-auto">
        {shown.map((p) => (
          <button
            key={p.availability}
            type="button"
            role="option"
            aria-selected="false"
            onClick={() => onAdd({ ...p, is_mandatory: 1 })}
            className="flex items-center gap-2.5 h-9 px-2 rounded-lg border-0 bg-transparent text-left cursor-pointer hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:bg-surface-gray-2"
          >
            <Initial person={p} size="sm" />
            <span className="flex-1 min-w-0 truncate text-es-base text-ink-gray-8">{p.full_name}</span>
            <span className="truncate text-es-sm text-ink-gray-5">{p.user}</span>
          </button>
        ))}
        {results && !shown.length && <span className="px-2 py-2 text-es-p-sm text-ink-gray-5">No one else found.</span>}
      </div>
      <span className="px-2 pt-1 text-es-p-sm text-ink-gray-5">Only people who've set up Appointments can be added.</span>
    </div>
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
  const [adding, setAdding] = useState(false);
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
      {editable &&
        (adding ? (
          <AddPerson
            taken={people.map((p) => p.availability)}
            onAdd={(person) => {
              onChange?.([...people, person]);
              setAdding(false);
            }}
          />
        ) : (
          <Button variant="ghost" className="self-start mt-1" onClick={() => setAdding(true)} disabled={disabled}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add someone
          </Button>
        ))}
      {editable && <span className="text-es-p-sm text-ink-gray-5">The switch marks who's required. Times are offered only when everyone required is free.</span>}
    </div>
  );
};
