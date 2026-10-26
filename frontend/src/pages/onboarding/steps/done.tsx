/**
 * Shown once the booking page is live: the link to share, with open and copy.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

import { Button } from "../ui";

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const DoneStep = ({ slug, onHome }: { slug: string; onHome: () => void }) => {
  const link = `${window.location.origin}/schedule/in/${slug}`;
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    if (!(await copyText(link))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="w-full max-w-[520px] mx-auto flex flex-col items-center gap-6 text-center py-6">
      <span className="w-12 h-12 rounded-full grid place-items-center bg-surface-green-2 text-ink-green-7">
        <Check className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-es-title text-ink-gray-9">You're ready to take bookings</h2>
        <p className="m-0 text-es-p-base text-ink-gray-6">
          Share your link. People pick a time that works for you both, and it lands on your Google Calendar.
        </p>
      </div>

      <div className="w-full flex items-center gap-2 py-1.5 pr-1.5 pl-3 rounded-xl bg-surface-gray-1 text-left box-border">
        <span className="flex-1 min-w-0 truncate text-es-base text-ink-gray-8" title={link}>
          {link.replace(/^https?:\/\//, "")}
        </span>
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          aria-label="Open booking page"
          className="grid place-items-center w-7 h-7 rounded-lg text-ink-gray-7 hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:shadow-es-focus"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg border border-outline-gray-2 bg-surface-base text-es-base text-ink-gray-8 shadow-es-sm cursor-pointer hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:shadow-es-focus"
        >
          {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
          <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
        </button>
      </div>

      <p className="m-0 text-es-p-sm text-ink-gray-5">Tip: open your link in a private window to see exactly what people see.</p>

      <Button variant="solid" size="md" onClick={onHome}>
        Go to Home
      </Button>
    </div>
  );
};

export default DoneStep;
