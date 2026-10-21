/**
 * The centred card shown at /schedule before the setup steps: logged out, no desk access,
 * Google not set up on the site, or a load error.
 */
import { ReactNode, useState } from "react";
import { CalendarDays } from "lucide-react";

import { BASE_ROUTE } from "@/lib/constant";

const solidButton =
  "inline-flex items-center justify-center rounded-lg bg-surface-gray-10 px-3 text-ink-base hover:bg-surface-gray-9 focus-visible:outline-none focus-visible:shadow-es-focus";
const subtleButton =
  "inline-flex items-center justify-center rounded-lg bg-surface-gray-2 px-3 text-ink-gray-8 hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:shadow-es-focus";

const GateCard = ({ title, body, children }: { title: string; body: string; children?: ReactNode }) => (
  <div className="espresso font-espresso min-h-screen flex items-center justify-center px-4 py-10 bg-surface-gray-1 text-ink-gray-8">
    <div className="w-full max-w-[420px] flex flex-col gap-6 p-8 rounded-2xl border border-outline-gray-1 bg-surface-base shadow-es-sm">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-md grid place-items-center bg-surface-gray-10 text-ink-base">
          <CalendarDays className="w-4 h-4" aria-hidden="true" />
        </span>
        <span className="text-es-base font-medium">Appointments</span>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-es-title text-ink-gray-9">{title}</h1>
        <p className="m-0 text-es-p-base text-ink-gray-6">{body}</p>
      </div>
      {children}
    </div>
  </div>
);

export const LoginGate = () => (
  <GateCard
    title="Set up your booking page"
    body="Log in to this site first. Then you can connect your calendar, choose when you're free, and get a link people can use to book time with you."
  >
    <div className="flex flex-col gap-2.5">
      <a
        href={`/login?redirect-to=${encodeURIComponent(BASE_ROUTE)}`}
        className={`${solidButton} h-10 rounded-[10px] text-es-lg font-medium`}
      >
        Log in with your ERP account
      </a>
      <span className="text-center text-es-p-sm text-ink-gray-5">
        Same account you use for Desk. You'll come back here after logging in.
      </span>
    </div>
  </GateCard>
);

export const WebsiteUserGate = () => (
  <GateCard
    title="Your account can't set up a booking page"
    body="Only accounts with Desk access can set up a booking page. Ask your admin to give your account Desk access, then come back here."
  />
);

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const NotReadyGate = () => {
  const [copied, setCopied] = useState(false);
  const host = window.location.host;
  const note = `Can you set up Appointments on ${host}? Open ${host}${BASE_ROUTE} as a System Manager and follow the steps. It takes about 10 minutes.`;

  return (
    <GateCard
      title="Appointments isn't ready on this site yet"
      body="A System Manager has to connect the site to Google once before anyone can connect a calendar. When they open this page, it walks them through it."
    >
      <div className="flex flex-col gap-2.5">
        <div className="rounded-[10px] bg-surface-gray-1 px-3.5 py-3 text-es-p-sm text-ink-gray-7">“{note}”</div>
        <button
          type="button"
          className={`${subtleButton} h-8 text-es-base font-medium`}
          onClick={async () => {
            if (await copyText(note)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }
          }}
        >
          {copied ? "Copied" : "Copy a note for your admin"}
        </button>
      </div>
    </GateCard>
  );
};

export const LoadErrorGate = ({ onRetry }: { onRetry: () => void }) => (
  <GateCard
    title="Couldn't load your setup"
    body="Something went wrong while loading your calendar and hours. Check your connection and try again."
  >
    <button type="button" className={`${solidButton} h-8 text-es-base font-medium`} onClick={onRetry}>
      Try again
    </button>
  </GateCard>
);

/** Stand-in until the setup steps exist. */
export const ReadyGate = () => (
  <GateCard
    title="You're all set to start"
    body="Google is set up on this site. Connecting your calendar comes next."
  />
);
