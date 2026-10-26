/**
 * Choosing how booked meetings get a video call: a provider, plus the link or Zoom account it needs.
 */
import { cn } from "@/lib/utils";
import { Notice } from "./ui";
import { Provider, PROVIDERS, isMeetingLink } from "./video";

const fieldClass =
  "h-7 px-2 rounded-lg border border-transparent bg-surface-gray-2 text-es-base text-ink-gray-8 placeholder:text-ink-gray-4 hover:bg-surface-gray-3 focus:outline-none focus:bg-surface-base focus:border-outline-gray-4 focus:shadow-es-focus";

const VideoPicker = ({
  providers,
  provider,
  onProvider,
  meetingLink,
  onMeetingLink,
  zoomEmail,
  onZoomEmail,
  zoomOff,
  hideLegend,
}: {
  providers: typeof PROVIDERS;
  provider: Provider;
  onProvider: (provider: Provider) => void;
  meetingLink: string;
  onMeetingLink: (value: string) => void;
  zoomEmail: string;
  onZoomEmail: (value: string) => void;
  /** Zoom is saved but turned off on the site. */
  zoomOff: boolean;
  /** When a heading already says "Video calls". */
  hideLegend?: boolean;
}) => (
  <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
    <legend className={cn("p-0 mb-2 text-es-base font-medium text-ink-gray-8", hideLegend && "sr-only")}>Video calls</legend>
    <div className="rounded-xl border border-outline-gray-1 overflow-hidden">
      {providers.map((p) => {
        const on = provider === p.id;
        return (
          <label
            key={p.id}
            className={cn(
              "flex items-start gap-2.5 px-3.5 py-3 border-b border-outline-gray-1 last:border-b-0 cursor-pointer",
              on ? "bg-surface-gray-1" : "bg-surface-base"
            )}
          >
            <input
              type="radio"
              name="provider"
              value={p.id}
              checked={on}
              onChange={() => onProvider(p.id)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "shrink-0 mt-px w-4 h-4 rounded-full box-border peer-focus-visible:shadow-es-focus",
                on ? "border-[4.5px] border-surface-gray-10" : "border border-outline-gray-4"
              )}
            />
            <span className="flex flex-col gap-1">
              <span className="text-es-base font-medium text-ink-gray-8">{p.title}</span>
              <span className="text-es-p-sm text-ink-gray-5">{p.description}</span>
            </span>
          </label>
        );
      })}
    </div>
    {provider === "Custom" && (
      <div className="flex flex-col gap-1.5">
        <input
          type="url"
          aria-label="Meeting link"
          value={meetingLink}
          onChange={(e) => onMeetingLink(e.target.value)}
          placeholder="https://zoom.us/j/1234567890"
          className={fieldClass}
        />
        {meetingLink.trim() && !isMeetingLink(meetingLink) && (
          <span className="text-es-p-sm text-ink-red-7">Enter a full link that starts with https://</span>
        )}
      </div>
    )}
    {zoomOff && (
      <Notice tone="amber" title="Zoom is turned off on this site">
        Your booking page was set to Zoom, but an admin has since turned Zoom off. Pick another option to save.
      </Notice>
    )}
    {provider === "Zoom" && !zoomOff && (
      <div className="flex flex-col gap-1.5 mt-1">
        <label htmlFor="zoom-email" className="text-es-sm text-ink-gray-6">
          Zoom email
        </label>
        <input
          id="zoom-email"
          type="email"
          value={zoomEmail}
          onChange={(e) => onZoomEmail(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={fieldClass}
        />
        <span className="text-es-p-sm text-ink-gray-5">
          The Zoom account that hosts your meetings. It needs a Zoom license in your company's account. Usually your
          work email.
        </span>
      </div>
    )}
  </fieldset>
);

export default VideoPicker;
