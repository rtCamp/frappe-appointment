/**
 * /schedule/admin — site-wide setup for System Managers: Google, a connected calendar,
 * video calls, default emails and group meetings. People then use /schedule for their own setup.
 * Styled with Espresso (Frappe UI) tokens, scoped to this page in ./espresso.css.
 */
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Flag, KeyRound, Lock, Mail, Users, Video } from "lucide-react";

import MetaTags from "@/components/meta-tags";
import { CalendarInfo, errorText, useOnboardingApi } from "../api";
import { readSessionUser } from "../session";
import { AdminStatus, googleReady, templatesReady, useAdminApi, zoomReady } from "./api";
import { Notice, Stepper } from "./ui";
import GoogleStep from "./steps/googleStep";
import CalendarStep from "./steps/calendarStep";
import ZoomStep from "./steps/zoomStep";
import TemplatesStep from "./steps/templatesStep";
import TeamStep from "./steps/teamStep";
import DoneStep from "./steps/doneStep";
import "./espresso.css";

const STEP_LABELS = ["Google", "Calendar", "Video", "Emails", "Team"];
const SUMMARY = STEP_LABELS.length;

const isConnected = (c: CalendarInfo | null | undefined) => !!c?.custom_is_google_calendar_authorized && !!c?.enable;

/** A centred card for states with no steps: logged out, not an admin, load error. */
const Gate = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="es flex items-center justify-center px-4 py-10" style={{ background: "var(--surface-gray-1)" }}>
    <div
      className="w-full max-w-[420px] flex flex-col gap-6 p-8 rounded-2xl box-border"
      style={{ border: "1px solid var(--outline-gray-1)", background: "var(--surface-base)", boxShadow: "var(--elevation-sm)" }}
    >
      <Brand />
      <h1 className="t-title">{title}</h1>
      {children}
    </div>
  </div>
);

const Brand = ({ subtitle }: { subtitle?: string }) => (
  <div className="flex items-center gap-2">
    <span
      className="w-7 h-7 rounded-md grid place-items-center shrink-0"
      style={{ background: "var(--surface-gray-10)", color: "var(--ink-base)" }}
    >
      <CalendarDays className="w-4 h-4" aria-hidden="true" />
    </span>
    <span className="flex flex-col gap-0.5 min-w-0">
      <span className="t-base-medium">Appointments</span>
      {subtitle && (
        <span className="t-sm truncate" style={{ color: "var(--ink-gray-6)" }}>
          {subtitle}
        </span>
      )}
    </span>
  </div>
);

const AdminSetup = () => {
  const adminApi = useAdminApi();
  const memberApi = useOnboardingApi();
  const sessionUser = useMemo(readSessionUser, []);
  const isSystemManager = !!sessionUser?.roles.includes("System Manager");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const load = useCallback(
    async (opts: { pickStep?: boolean } = {}) => {
      if (!sessionUser || !isSystemManager) return;
      setLoadError(null);
      try {
        const [st, cals] = await Promise.all([adminApi.getStatus(), memberApi.listCalendars(sessionUser.name)]);
        setStatus(st);
        setCalendars(cals);
        const preferred = cals.find(isConnected)?.name ?? cals[0]?.name ?? null;
        setSelectedCalendar((current) => (current && cals.some((c) => c.name === current) ? current : preferred));

        if (opts.pickStep) {
          if (!googleReady(st)) setStep(0);
          else if (!cals.some(isConnected)) setStep(1);
          else if (!templatesReady(st)) setStep(3);
          else if (!st.groups.length) setStep(4);
          else setStep(SUMMARY);
        }
        return st;
      } catch (err) {
        setLoadError(errorText(err));
      } finally {
        setLoading(false);
      }
    },
    [adminApi, memberApi, sessionUser, isSystemManager]
  );

  useEffect(() => {
    if (sessionUser && isSystemManager) load({ pickStep: true });
    else setLoading(false);
  }, [sessionUser, isSystemManager, load]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const reload = useCallback(() => load(), [load]);
  const onConnected = useCallback(
    async (calendar: string) => {
      setSelectedCalendar(calendar);
      await load();
    },
    [load]
  );

  const meta = <MetaTags title="Set up Appointments | Appointment" description="Set up Appointments for your team" />;

  if (!sessionUser) {
    return (
      <>
        {meta}
        <Gate title="Set up Appointments">
          <p className="t-p-base m-0" style={{ color: "var(--ink-gray-6)" }}>
            Log in as a System Manager to set up Appointments for your team.
          </p>
          <a href={`/login?redirect-to=${encodeURIComponent(window.location.pathname)}`} className="btn btn-md btn-solid">
            Log in
          </a>
        </Gate>
      </>
    );
  }
  if (!isSystemManager) {
    return (
      <>
        {meta}
        <Gate title="Only System Managers can set up Appointments">
          <p className="t-p-base m-0" style={{ color: "var(--ink-gray-6)" }}>
            You can still set up your own booking page.
          </p>
          <a href="/schedule" className="btn btn-md btn-solid">
            Set up my booking page
          </a>
        </Gate>
      </>
    );
  }
  if (!loading && (loadError || !status)) {
    return (
      <>
        {meta}
        <Gate title="Couldn't load the setup">
          <p className="t-p-base m-0" style={{ color: "var(--ink-gray-6)" }}>
            {loadError}
          </p>
          <button type="button" className="btn btn-md btn-solid" onClick={() => load({ pickStep: true })}>
            Try again
          </button>
        </Gate>
      </>
    );
  }

  const selected = calendars.find((c) => c.name === selectedCalendar) ?? null;
  const calendarConnected = isConnected(selected);
  const google = !!status && googleReady(status);

  const done = status
    ? [google, calendarConnected, zoomReady(status), templatesReady(status), status.groups.length > 0]
    : [false, false, false, false, false];
  const locked = [false, !google, false, false, !google];
  const icons = [KeyRound, CalendarDays, Video, Mail, Users];
  const navLabels = ["Google", "Your calendar", "Video calls", "Emails", "Your team"];
  const checklist = [
    { label: "Connect Google", done: done[0] },
    { label: "Connect your calendar", done: done[1] },
    { label: "Check the emails", done: done[3] },
    { label: "Create a group meeting", done: done[4] },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  const back = () => setStep((s) => Math.max(0, s - 1));
  const next = () => setStep((s) => Math.min(SUMMARY, s + 1));

  let content: ReactNode = null;
  if (loading || !status) {
    content = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-6 w-64 rounded-lg animate-pulse" style={{ background: "var(--surface-gray-2)" }} />
        <div className="h-4 w-full max-w-md rounded-lg animate-pulse" style={{ background: "var(--surface-gray-2)" }} />
        <div className="h-48 w-full rounded-xl animate-pulse" style={{ background: "var(--surface-gray-1)" }} />
      </div>
    );
  } else if (step === 0) {
    content = <GoogleStep api={adminApi} status={status} onSaved={reload} onNext={next} />;
  } else if (step === 1) {
    content = (
      <CalendarStep
        api={memberApi}
        user={sessionUser.name}
        calendars={calendars}
        selected={selected}
        onSelect={setSelectedCalendar}
        onConnected={onConnected}
        onBack={back}
        onNext={next}
      />
    );
  } else if (step === 2) {
    content = <ZoomStep api={adminApi} status={status} onSaved={reload} onBack={back} onNext={next} />;
  } else if (step === 3) {
    content = <TemplatesStep api={adminApi} status={status} onSaved={reload} onBack={back} onNext={next} />;
  } else if (step === 4) {
    content = (
      <TeamStep
        api={adminApi}
        status={status}
        adminUser={sessionUser.name}
        onSaved={reload}
        onBack={back}
        onNext={next}
      />
    );
  } else {
    content = <DoneStep status={status} calendarConnected={calendarConnected} onGoTo={setStep} />;
  }

  return (
    <>
      {meta}
      <div className="es flex flex-wrap">
        <nav
          aria-label="Setup"
          className="flex flex-col md:sticky md:top-0 md:h-screen"
          style={{ flex: "1 1 224px", background: "var(--surface-sidebar)", borderRight: "1px solid var(--outline-gray-1)" }}
        >
          <div className="h-12 flex items-center px-2.5 max-md:pr-20">
            <Brand subtitle={sessionUser.fullName} />
          </div>

          <div className="flex flex-col gap-0.5 px-2 py-1 max-md:hidden">
            {navLabels.map((label, i) => {
              const Icon = icons[i];
              return (
                <button
                  key={label}
                  type="button"
                  className="nav-item"
                  aria-current={step === i ? "page" : undefined}
                  disabled={!status || locked[i]}
                  title={locked[i] ? "Connect Google first" : undefined}
                  onClick={() => setStep(i)}
                >
                  <Icon aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {locked[i] ? (
                    <Lock className="!w-3.5 !h-3.5" aria-hidden="true" />
                  ) : (
                    done[i] && <Check className="!w-3.5 !h-3.5" style={{ color: "var(--ink-gray-5)" }} aria-label="Done" />
                  )}
                </button>
              );
            })}
            <button
              type="button"
              className="nav-item"
              aria-current={step === SUMMARY ? "page" : undefined}
              disabled={!status}
              onClick={() => setStep(SUMMARY)}
            >
              <Flag aria-hidden="true" />
              <span className="flex-1">Summary</span>
            </button>
          </div>

          <div className="mt-auto p-2 flex flex-col gap-2 max-md:hidden">
            <div
              className="rounded-xl p-3 flex flex-col gap-2.5"
              style={{ border: "1px solid var(--outline-gray-1)", background: "var(--surface-base)" }}
            >
              <div className="flex items-center justify-between">
                <span className="t-sm-medium">Getting started</span>
                <span className="t-xs tabular" style={{ color: "var(--ink-gray-5)" }}>
                  {doneCount} of {checklist.length}
                </span>
              </div>
              <div className="h-1 rounded-2xl overflow-hidden" style={{ background: "var(--surface-gray-2)" }}>
                <div
                  className="h-1 rounded-2xl transition-[width]"
                  style={{ width: `${(doneCount / checklist.length) * 100}%`, background: "var(--surface-gray-10)" }}
                />
              </div>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {checklist.map((c) => (
                  <li
                    key={c.label}
                    className="t-sm flex items-center gap-2"
                    style={{ color: c.done ? "var(--ink-gray-6)" : "var(--ink-gray-8)" }}
                  >
                    {c.done ? (
                      <span
                        className="w-4 h-4 rounded-full grid place-items-center"
                        style={{ background: "var(--surface-gray-10)", color: "var(--ink-base)" }}
                      >
                        <Check className="w-2.5 h-2.5" strokeWidth={3} aria-hidden="true" />
                      </span>
                    ) : (
                      <span
                        className="w-4 h-4 rounded-full box-border"
                        style={{ border: "1.5px solid var(--outline-gray-3)" }}
                        aria-hidden="true"
                      />
                    )}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
            <a href="/schedule" className="nav-item">
              My booking page
            </a>
            <a href="/desk/appointment-settings" className="nav-item">
              Settings in Desk
            </a>
          </div>
        </nav>

        <main className="flex flex-col min-w-0" style={{ flex: "999 1 560px" }}>
          <header
            className="min-h-12 flex items-center justify-between gap-2 pl-5 pr-20 lg:pr-28"
            style={{ borderBottom: "1px solid var(--outline-gray-1)" }}
          >
            <h1 className="t-lg-medium m-0" style={{ color: "var(--ink-gray-9)" }}>
              Set up Appointments
            </h1>
            {step < SUMMARY && (
              <span className="t-sm tabular" style={{ color: "var(--ink-gray-5)" }}>
                Step {step + 1} of {STEP_LABELS.length}
              </span>
            )}
          </header>

          <div className="w-full max-w-[640px] mx-auto px-5 pt-10 pb-12 box-border flex flex-col gap-8">
            {status && step < SUMMARY && <Stepper steps={STEP_LABELS} current={step} done={done} />}
            {status && locked[step] && (
              <Notice tone="amber" title="Connect Google first">
                Calendars can't connect until the Google client is saved.
              </Notice>
            )}
            <div className="flex flex-col gap-8">{content}</div>
          </div>
        </main>
      </div>
    </>
  );
};

export default AdminSetup;
