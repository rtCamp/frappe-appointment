/**
 * Group meetings: the groups you made, and the groups other people added you to (view only).
 */
import { useFrappeGetCall } from "frappe-react-sdk";
import { Check, Copy, Plus } from "lucide-react";

import { GET_GROUPS, GroupSummary, SessionUser, durationLabel, errorText, groupLink, providerLabel } from "./api";
import { Frame, FrameNav } from "./frame";
import { Initial } from "./group-people";
import { peopleLine } from "./group-utils";
import { Button, Notice, Pill } from "./ui";
import { useCopied } from "./use-copied";

const upcomingLabel = (n: number) => (n === 0 ? "No upcoming bookings" : `${n} upcoming`);

const LinkBox = ({ name, copied, onCopy }: { name: string; copied: boolean; onCopy: () => void }) => (
  <div className="flex items-center gap-2 py-1 pr-1 pl-2.5 rounded-[10px] bg-surface-gray-1">
    <span className="flex-1 min-w-0 truncate text-es-sm text-ink-gray-7">…/schedule/gr/{name}</span>
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy link for ${name}`}
      className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2 rounded-lg border border-outline-gray-2 bg-surface-base text-es-base text-ink-gray-8 shadow-es-sm cursor-pointer hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:shadow-es-focus"
    >
      {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
      {copied ? "Copied" : "Copy link"}
    </button>
  </div>
);

const Card = ({
  group,
  me,
  mine,
  copied,
  onCopy,
  onOpen,
}: {
  group: GroupSummary;
  me: string;
  mine: boolean;
  copied: boolean;
  onCopy: () => void;
  onOpen: () => void;
}) => {
  const myRow = group.members.find((p) => p.user === me);
  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl border border-outline-gray-1 bg-surface-base">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onOpen}
            className="p-0 border-0 bg-transparent text-left text-es-base font-medium text-ink-gray-8 cursor-pointer hover:underline focus-visible:outline-none focus-visible:shadow-es-focus rounded"
          >
            {group.group_name}
          </button>
          <span className="text-es-sm text-ink-gray-5">
            {durationLabel(group.duration_for_event)} · {providerLabel(group.meet_provider)} · {upcomingLabel(group.upcoming)}
          </span>
        </div>
        {!mine && <Pill>View only</Pill>}
      </div>
      {mine ? (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex pl-1.5">
            {group.members.slice(0, 5).map((p) => (
              <Initial key={p.availability} person={p} ring />
            ))}
          </span>
          <span className="min-w-0 truncate text-es-sm text-ink-gray-6">{peopleLine(group.members)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 min-w-0">
          <Initial person={{ user: group.owner, full_name: group.owner_name }} />
          <span className="min-w-0 truncate text-es-sm text-ink-gray-6">
            Made by {group.owner_name} · you're {myRow?.is_mandatory ? "required" : "optional"}
          </span>
        </div>
      )}
      <LinkBox name={group.name} copied={copied} onCopy={onCopy} />
    </div>
  );
};

const GroupsPage = ({
  user,
  nav,
  onOpen,
  onNew,
}: {
  user: SessionUser;
  nav: FrameNav;
  onOpen: (name: string) => void;
  onNew: () => void;
}) => {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: { mine: GroupSummary[]; others: GroupSummary[] } }>(
    GET_GROUPS,
    undefined,
    undefined,
    { revalidateOnFocus: false }
  );
  const { copied, copy } = useCopied();
  const mine = data?.message.mine ?? [];
  const others = data?.message.others ?? [];

  const grid = "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]";

  return (
    <Frame
      user={user}
      title="Group meetings"
      width="home"
      {...nav}
      headerAction={
        <Button variant="solid" onClick={onNew}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          New group
        </Button>
      }
    >
      <p className="m-0 text-es-p-base text-ink-gray-6">One link that finds a time when everyone in the group is free.</p>

      {error && (
        <Notice tone="red" title="Couldn't load your groups" actions={<Button onClick={() => mutate()}>Try again</Button>}>
          {errorText(error)}
        </Notice>
      )}

      {!isLoading && !error && (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="m-0 text-es-lg font-semibold text-ink-gray-8">Your groups</h2>
              <span className="text-es-sm tabular-nums text-ink-gray-5">{mine.length}</span>
            </div>
            {mine.length ? (
              <div className={grid}>
                {mine.map((g) => (
                  <Card key={g.name} group={g} me={user.name} mine copied={copied === g.name} onCopy={() => copy(g.name, groupLink(g.name))} onOpen={() => onOpen(g.name)} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5 px-6 py-10 rounded-xl border border-dashed border-outline-gray-2 text-center">
                <span className="text-es-base font-medium text-ink-gray-8">You haven't made a group yet</span>
                <span className="max-w-[380px] text-es-p-sm text-ink-gray-5">
                  Pick the people, set the rules once, and share one link. Only people who've set up Appointments can be added.
                </span>
                <Button onClick={onNew}>New group</Button>
              </div>
            )}
          </section>

          {others.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <h2 className="m-0 text-es-lg font-semibold text-ink-gray-8">Groups you're in</h2>
                  <span className="text-es-sm tabular-nums text-ink-gray-5">{others.length}</span>
                </div>
                <span className="text-es-p-sm text-ink-gray-5">
                  Other people added you to these. You can see them and share their link; only the person who made a group can change it.
                </span>
              </div>
              <div className={grid}>
                {others.map((g) => (
                  <Card key={g.name} group={g} me={user.name} mine={false} copied={copied === g.name} onCopy={() => copy(g.name, groupLink(g.name))} onOpen={() => onOpen(g.name)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Frame>
  );
};

export default GroupsPage;
