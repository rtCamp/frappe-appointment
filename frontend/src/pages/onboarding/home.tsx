/**
 * Home, once the booking page is set up: the booking link, the meeting types with their own links,
 * and upcoming bookings. Notices cover a disconnected calendar and a booking page that's turned off.
 */
import { useContext, useEffect, useState } from "react";
import { Check, Clock, Copy, ExternalLink, Info, TriangleAlert, Video } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import {
  Availability,
  Booking,
  EVENT,
  SessionUser,
  durationLabel,
  fromSiteTime,
  providerLabel,
  siteNow,
} from "./api";
import { buttonClass } from "./styles";
import { useCopied } from "./use-copied";

const Home = ({
  user,
  availability,
  calendarConnected,
  onReconnect,
}: {
  user: SessionUser;
  availability: Availability;
  calendarConnected: boolean;
  onReconnect: () => void;
}) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const { copied, copy } = useCopied();

  const link = `${window.location.origin}/schedule/in/${availability.slug}`;
  const on = !!availability.enable_scheduling;

  useEffect(() => {
    let stale = false;
    db.getDocList<Booking>(EVENT, {
      fields: ["name", "subject", "starts_on", "ends_on", "custom_meeting_provider"],
      filters: [
        ["custom_user_calendar", "=", availability.name],
        ["starts_on", ">=", siteNow(user.siteTimeZone)],
        ["status", "!=", "Cancelled"],
      ],
      orderBy: { field: "starts_on", order: "asc" },
      limit: 5,
    })
      .then((list) => !stale && setBookings(list))
      .catch(() => !stale && setBookings([]));
    return () => {
      stale = true;
    };
  }, [db, availability.name, user.siteTimeZone]);

  const inUserZone = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: user.timeZone, ...options }).format(fromSiteTime(value, user.siteTimeZone));
  const time = (value: string) => inUserZone(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <>
      {!calendarConnected && (
        <div role="alert" className="flex gap-2.5 px-3.5 py-3 rounded-xl bg-surface-gray-1">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-px text-ink-amber-7" aria-hidden="true" />
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-es-base font-medium text-ink-gray-8">Google Calendar disconnected</span>
            <span className="text-es-p-sm text-ink-gray-7">
              People can't book you until you reconnect. This usually means the Google sign-in expired.
            </span>
            <div className="flex gap-2 mt-1.5">
              <button type="button" onClick={onReconnect} className={cn(buttonClass("subtle"), "bg-surface-gray-3")}>
                Reconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {!on && (
        <div role="status" className="flex gap-2.5 px-3.5 py-3 rounded-xl bg-surface-gray-1">
          <Info className="w-4 h-4 shrink-0 mt-px text-ink-blue-5" aria-hidden="true" />
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-es-base font-medium text-ink-gray-8">Your booking page is off</span>
            <span className="text-es-p-sm text-ink-gray-7">People can't book you right now. Group meetings you're part of still work.</span>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-es-lg font-semibold text-ink-gray-8">Your booking link</h2>
        <div className={cn("flex items-center gap-2 py-1.5 pr-1.5 pl-3 rounded-xl bg-surface-gray-1", !on && "opacity-[0.55]")}>
          <span className="flex-1 min-w-0 truncate text-es-base text-ink-gray-8" title={link}>
            {link.replace(/^https?:\/\//, "")}
          </span>
          <a href={link} target="_blank" rel="noreferrer" className={buttonClass("ghost")}>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Open
          </a>
          <button
            type="button"
            onClick={() => copy("link", link)}
            className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg border border-outline-gray-2 bg-surface-base text-es-base text-ink-gray-8 shadow-es-sm cursor-pointer hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:shadow-es-focus"
          >
            {copied === "link" ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
            <span aria-live="polite">{copied === "link" ? "Copied" : "Copy link"}</span>
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-es-lg font-semibold text-ink-gray-8">Meeting types</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {availability.available_durations.map((type) => {
            const typeLink = `${link}?type=${encodeURIComponent(type.name ?? "")}`;
            return (
              <div key={type.name} className="flex flex-col gap-3.5 p-4 rounded-xl border border-outline-gray-1 bg-surface-base">
                <div className="flex flex-col gap-1.5">
                  <span className="text-es-base font-medium text-ink-gray-8">{type.title}</span>
                  <span className="flex items-center gap-1.5 text-es-sm text-ink-gray-5">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    {durationLabel(type.duration)}
                    <span aria-hidden="true">·</span>
                    <Video className="w-3.5 h-3.5" aria-hidden="true" />
                    {providerLabel(availability.meeting_provider)}
                  </span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => copy(type.name ?? type.title, typeLink)}
                    aria-label={`Copy link for ${type.title}`}
                    className={buttonClass("subtle")}
                  >
                    {copied === (type.name ?? type.title) ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                    {copied === (type.name ?? type.title) ? "Copied" : "Copy link"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-es-lg font-semibold text-ink-gray-8">Upcoming bookings</h2>
        <div className="flex flex-col border-t border-outline-gray-1">
          {bookings?.length === 0 && (
            <p className="m-0 py-3 text-es-p-sm text-ink-gray-5 border-b border-outline-gray-1">
              No upcoming bookings yet. Share your link to get some.
            </p>
          )}
          {bookings?.map((b) => (
            <div key={b.name} className="flex items-center gap-3 py-3 border-b border-outline-gray-1">
              <span className="w-11 shrink-0 flex flex-col items-center gap-0.5 py-1 rounded-lg bg-surface-gray-1">
                <span className="text-es-xs text-ink-gray-5">{inUserZone(b.starts_on, { weekday: "short" })}</span>
                <span className="text-es-base font-medium tabular-nums text-ink-gray-8">{inUserZone(b.starts_on, { day: "numeric" })}</span>
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-es-base font-medium text-ink-gray-8 truncate">{b.subject}</span>
                <span className="text-es-sm tabular-nums text-ink-gray-5">
                  {time(b.starts_on)}
                  {b.ends_on && ` – ${time(b.ends_on)}`} · {providerLabel(b.custom_meeting_provider)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

export default Home;
