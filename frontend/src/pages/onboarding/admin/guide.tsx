/**
 * The Google Cloud guide a System Manager follows once per site: project, consent screen,
 * Calendar API and OAuth client, with this site's own values to copy.
 */
import { ReactNode, useState } from "react";
import { Check, ChevronRight, ExternalLink, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { GoogleSetup } from "../api";
import { buttonClass } from "../styles";
import { Button, CopyValue } from "../ui";

const SCREENSHOTS = "/assets/frappe_appointment/images/google-setup";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const NARROW_SCOPES = [
  "calendar.calendarlist.readonly",
  "calendar.events.freebusy",
  "calendar.events.public.readonly",
  "calendar.calendarlist",
  "calendar.calendars",
  "calendar.calendars.readonly",
  "calendar.events",
  "calendar.events.owned",
  "calendar.events.owned.readonly",
  "calendar.events.readonly",
].map((s) => `https://www.googleapis.com/auth/${s}`);

const STEPS = [
  { title: "Create a Google Cloud project", where: "Google Cloud console", link: "https://console.cloud.google.com/projectcreate", linkLabel: "Open Google Cloud" },
  { title: "Set up the consent screen", where: "What people see when they connect", link: "https://console.cloud.google.com/apis/credentials/consent", linkLabel: "Open consent screen" },
  { title: "Turn on the Calendar API", where: "One click in the API library", link: "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com", linkLabel: "Open Calendar API" },
  { title: "Create OAuth credentials", where: "Gives you a Client ID and secret", link: "https://console.cloud.google.com/apis/credentials", linkLabel: "Open Credentials" },
  { title: "Copy the Client ID and secret", where: "You paste them here next", link: "", linkLabel: "" },
];

const SHOTS: Record<number, { file: string; maxWidth: string; alt: string; caption: string }[]> = {
  0: [{ file: "1-new-project.png", maxWidth: "583px", alt: "Google Cloud New Project form with project name, organization and location filled in", caption: "New project: a name, your organization, and the same organization as the location." }],
  1: [{ file: "2-branding.png", maxWidth: "440px", alt: "Google Cloud Branding page with app name, support email, authorized domain and developer contact filled in", caption: "Branding: app name, support email, authorized domain and developer contact. Then Save." }],
  2: [{ file: "3-calendar-api.png", maxWidth: "610px", alt: "Google Calendar API product page with the Enable button highlighted", caption: "Click Enable on the Google Calendar API page." }],
  3: [
    { file: "4-create-credentials.png", maxWidth: "100%", alt: "Credentials page with Create credentials open and OAuth client ID highlighted", caption: "Create credentials → OAuth client ID." },
    { file: "4-oauth-client.png", maxWidth: "440px", alt: "Create OAuth client ID form with Web application type, JavaScript origin and redirect URI filled in", caption: "Web application, with the origin and redirect URI from above. Then Create." },
  ],
};

const Steps = ({ children, start }: { children: ReactNode; start?: number }) => (
  <ol start={start} className="m-0 pl-5 list-decimal flex flex-col gap-2 text-es-p-base text-ink-gray-7">
    {children}
  </ol>
);

const Strong = ({ children }: { children: ReactNode }) => <span className="font-medium text-ink-gray-8">{children}</span>;

const Hint = ({ children }: { children: ReactNode }) => (
  <div className="flex gap-2.5 px-3.5 py-3 rounded-xl bg-surface-gray-1 text-es-p-sm text-ink-gray-7">
    <Info className="w-4 h-4 shrink-0 mt-0.5 text-ink-blue-5" aria-hidden="true" />
    <span>{children}</span>
  </div>
);

const Guide = ({ setup, onCredentials }: { setup: GoogleSetup; onCredentials: () => void }) => {
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [narrowOpen, setNarrowOpen] = useState(false);
  const step = STEPS[current];
  const insecure = setup.origin.startsWith("http://");

  return (
    <>
      <div className="flex flex-col gap-2 max-w-[640px]">
        <h2 className="m-0 text-es-title text-ink-gray-9">Connect this site to Google</h2>
        <p className="m-0 text-es-p-base text-ink-gray-6">
          Appointments reads and writes calendars through Google. That needs a one-time setup in Google Cloud, which takes
          about 10 minutes. Once it's done, everyone on this site can connect their own calendar.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <ol aria-label="Google Cloud steps" className="list-none m-0 p-0 flex flex-col gap-0.5" style={{ flex: "1 1 240px", maxWidth: 280 }}>
          {STEPS.map((s, i) => {
            const active = i === current;
            const finished = done.has(i) && !active;
            return (
              <li key={s.title}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    "w-full flex items-start gap-2.5 p-2.5 rounded-[10px] border-0 text-left cursor-pointer text-inherit focus-visible:outline-none focus-visible:shadow-es-focus",
                    active ? "bg-surface-elevation-3 shadow-es-sm" : "bg-transparent hover:bg-surface-gray-2"
                  )}
                >
                  {finished ? (
                    <span className="w-5 h-5 mt-px rounded-full grid place-items-center shrink-0 bg-surface-gray-10 text-ink-base">
                      <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "w-5 h-5 mt-px rounded-full grid place-items-center shrink-0 box-border border-[1.5px] text-es-xs",
                        active ? "border-ink-gray-9 text-ink-gray-9 font-medium" : "border-outline-gray-3 text-ink-gray-5"
                      )}
                    >
                      {i + 1}
                    </span>
                  )}
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className={cn("text-es-base font-medium", active || finished ? "text-ink-gray-8" : "text-ink-gray-6")}>{s.title}</span>
                    <span className="text-es-sm text-ink-gray-5">{s.where}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <section aria-live="polite" className="min-w-0 flex flex-col gap-5 p-6 rounded-xl border border-outline-gray-1" style={{ flex: "999 1 420px" }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-es-sm text-ink-gray-5 tabular-nums">Step {current + 1} of {STEPS.length}</span>
              <h3 className="m-0 text-es-lg font-semibold text-ink-gray-9">{step.title}</h3>
            </div>
            {step.link && (
              <a href={step.link} target="_blank" rel="noreferrer" className={buttonClass("subtle")}>
                {step.linkLabel}
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>

          {current === 0 && (
            <>
              <Steps>
                <li>Open the Google Cloud console and sign in with your work Google account.</li>
                <li>
                  Create a new project. Any name works, like <Strong>Appointments</Strong>. Pick your organization as the
                  location.
                </li>
                <li>Make sure the new project is selected in the top bar before you go on.</li>
              </Steps>
              <Hint>Already use Google with Frappe, for Gmail or Drive? You can reuse that project and skip to step 3.</Hint>
            </>
          )}

          {current === 1 && (
            <>
              <Steps>
                <li>
                  Go to <Strong>APIs &amp; Services → OAuth consent screen</Strong>.
                </li>
                <li>
                  Choose who can sign in:
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex gap-2.5 px-3 py-2.5 rounded-[10px] border border-outline-gray-2">
                      <span className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-2">
                          <Strong>Internal</Strong>
                          <span className="inline-flex items-center h-5 px-2 rounded-full bg-surface-green-2 text-ink-green-7 text-es-xs">Recommended</span>
                        </span>
                        <span className="text-es-p-sm">Only people in your Google Workspace. No review from Google needed.</span>
                      </span>
                    </div>
                    <div className="flex gap-2.5 px-3 py-2.5 rounded-[10px] border border-outline-gray-1">
                      <span className="flex flex-col gap-1">
                        <Strong>External</Strong>
                        <span className="text-es-p-sm">
                          Any Google account. Google has to verify the app first, because calendar access is a sensitive
                          permission.
                        </span>
                      </span>
                    </div>
                  </div>
                </li>
                <li>
                  On the Branding page, fill in the app name (people see it when they connect), a support email, your
                  site's domain under Authorized domains, and a developer contact email. Click Save.
                </li>
              </Steps>
              <div className="flex flex-col gap-1.5">
                <span className="text-es-sm text-ink-gray-6">Authorized domain</span>
                <CopyValue value={setup.domain} />
              </div>
              <div className="flex flex-col gap-2 pt-4 border-t border-outline-gray-1">
                <span className="text-es-base font-medium text-ink-gray-8">Add the calendar scope</span>
                <span className="text-es-p-sm text-ink-gray-6">
                  On the Scopes page, click Add or remove scopes, paste this into "Manually add scopes", and save.
                </span>
                <CopyValue value={CALENDAR_SCOPE} />
                <button
                  type="button"
                  aria-expanded={narrowOpen}
                  aria-controls="narrow-scopes"
                  onClick={() => setNarrowOpen((v) => !v)}
                  className="self-start inline-flex items-center gap-1 h-6 p-0 border-0 bg-transparent text-es-sm text-ink-gray-7 cursor-pointer hover:text-ink-gray-9"
                >
                  <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", narrowOpen && "rotate-90")} aria-hidden="true" />
                  Prefer narrower permissions? Use these 10 scopes instead
                </button>
                {narrowOpen && (
                  <div id="narrow-scopes">
                    <CopyValue value={NARROW_SCOPES.join("\n")} wrap />
                  </div>
                )}
              </div>
            </>
          )}

          {current === 2 && (
            <>
              <Steps>
                <li>Open the Google Calendar API page in the API library.</li>
                <li>
                  Check that your project is selected, then click <Strong>Enable</Strong>.
                </li>
              </Steps>
              <Hint>If the button says Manage instead, the API is already on. Move to the next step.</Hint>
            </>
          )}

          {current === 3 && (
            <>
              <Steps>
                <li>
                  Go to <Strong>APIs &amp; Services → Credentials</Strong>.
                </li>
                <li>
                  Click <Strong>Create credentials → OAuth client ID</Strong>.
                </li>
                <li>
                  Set Application type to <Strong>Web application</Strong>.
                </li>
                <li>Paste these two values exactly. They're already filled in for this site.</li>
              </Steps>
              <div className="flex flex-col gap-3.5 p-4 rounded-xl bg-surface-gray-1">
                <div className="flex flex-col gap-1.5">
                  <span className="text-es-sm text-ink-gray-6">Authorized JavaScript origins</span>
                  <CopyValue value={setup.origin} boxed />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-es-sm text-ink-gray-6">Authorized redirect URIs</span>
                  <CopyValue value={setup.redirect_uri} boxed wrap />
                </div>
                {insecure && (
                  <span className="text-es-p-sm text-ink-amber-7">
                    Google only accepts https addresses here. Set up https on the site first if it doesn't have it.
                  </span>
                )}
              </div>
              <Steps start={5}>
                <li>
                  Click Create. Google shows a <Strong>Client ID</Strong> and <Strong>Client secret</Strong>. Keep that
                  window open for the last step.
                </li>
              </Steps>
            </>
          )}

          {current === 4 && (
            <>
              <p className="m-0 text-es-p-base text-ink-gray-7">
                Copy the Client ID and Client secret from Google and paste them on the next screen. That's the last step.
              </p>
              <Hint>
                Lost the window? In Credentials, click the client you just made to see the ID again, and add a new secret
                if you need one.
              </Hint>
            </>
          )}

          {(SHOTS[current] ?? []).map((shot) => (
            <figure key={shot.file} className="m-0 flex flex-col gap-2">
              <img
                src={`${SCREENSHOTS}/${shot.file}`}
                alt={shot.alt}
                className="block w-full h-auto rounded-[10px] border border-outline-gray-1 shadow-es-sm"
                style={{ maxWidth: shot.maxWidth }}
              />
              <figcaption className="text-es-p-sm text-ink-gray-5">{shot.caption}</figcaption>
            </figure>
          ))}

          <div className="flex items-center justify-between gap-2 pt-4 border-t border-outline-gray-1">
            <Button size="md" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}>
              Back
            </Button>
            {current < STEPS.length - 1 ? (
              <Button
                variant="solid"
                size="md"
                onClick={() => {
                  setDone((d) => new Set(d).add(current));
                  setCurrent((c) => c + 1);
                }}
              >
                Done, next step
              </Button>
            ) : (
              <Button variant="solid" size="md" onClick={onCredentials}>
                Paste credentials
              </Button>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default Guide;
