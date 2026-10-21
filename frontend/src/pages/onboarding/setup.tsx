/**
 * The setup steps inside the page frame: Calendar, then Hours, then Booking page.
 */
import { useCallback, useContext, useEffect, useState } from "react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { CALENDAR_FIELDS, CalendarInfo, GOOGLE_CALENDAR, SessionUser, errorText, isConnected, pickCalendar } from "./api";
import { Frame } from "./frame";
import { Button, Notice, StepHeader, Stepper } from "./ui";
import CalendarStep from "./steps/calendar";

const STEPS = ["Calendar", "Hours", "Booking page"];

/** Stand-in for the steps that aren't built yet. */
const PlaceholderStep = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <>
    <StepHeader title={title}>This step isn't built yet.</StepHeader>
    <div className="flex justify-between gap-2">
      <Button size="md" onClick={onBack}>
        Back
      </Button>
    </div>
  </>
);

const Setup = ({ user }: { user: SessionUser }) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const [calendars, setCalendars] = useState<CalendarInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await db.getDocList<CalendarInfo>(GOOGLE_CALENDAR, {
        fields: CALENDAR_FIELDS as (keyof CalendarInfo)[],
        filters: [["user", "=", user.name]],
        orderBy: { field: "modified", order: "desc" },
        limit: 20,
      });
      setCalendars(list);
      // Start at the first unfinished step the first time the page loads.
      setStep((current) => current ?? (isConnected(pickCalendar(list)) ? 1 : 0));
    } catch (err) {
      setLoadError(errorText(err));
    }
  }, [db, user.name]);

  useEffect(() => {
    load();
  }, [load]);

  const calendar = calendars ? pickCalendar(calendars) : null;
  const done = [isConnected(calendar), false, false];

  let content = null;
  if (loadError) {
    content = (
      <Notice
        tone="red"
        title="Couldn't load your calendar"
        actions={
          <Button variant="solid" onClick={load}>
            Try again
          </Button>
        }
      >
        {loadError}
      </Notice>
    );
  } else if (calendars && step !== null) {
    content = (
      <>
        <Stepper steps={STEPS} current={step} done={done} />
        {step === 0 && (
          <CalendarStep
            key={calendar?.name ?? "new"}
            user={user.name}
            calendar={calendar}
            onChanged={load}
            onContinue={() => setStep(1)}
          />
        )}
        {step === 1 && <PlaceholderStep title="When can people book you?" onBack={() => setStep(0)} />}
        {step === 2 && <PlaceholderStep title="Set up your booking page" onBack={() => setStep(1)} />}
      </>
    );
  }

  return (
    <Frame user={user} stepLabel={step !== null ? `Step ${step + 1} of ${STEPS.length}` : undefined}>
      {content}
    </Frame>
  );
};

export default Setup;
