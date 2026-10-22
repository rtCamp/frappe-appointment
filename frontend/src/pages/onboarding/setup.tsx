/**
 * The setup steps inside the page frame: Calendar, then Hours, then Booking page.
 */
import { useCallback, useContext, useEffect, useState } from "react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import {
  AVAILABILITY,
  Availability,
  CALENDAR_FIELDS,
  CalendarInfo,
  GOOGLE_CALENDAR,
  SessionUser,
  errorText,
  isBookingLive,
  isConnected,
  isNotYours,
  pickCalendar,
} from "./api";
import { Frame } from "./frame";
import { Button, Notice, Stepper } from "./ui";
import CalendarStep from "./steps/calendar";
import HoursStep from "./steps/hours";
import BookingStep from "./steps/booking";
import DoneStep from "./steps/done";

const STEPS = ["Calendar", "Hours", "Booking page"];

const Setup = ({ user, zoomReady }: { user: SessionUser; zoomReady: boolean }) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const [calendars, setCalendars] = useState<CalendarInfo[] | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityNotYours, setAvailabilityNotYours] = useState(false);
  const [timeZone, setTimeZone] = useState(user.timeZone);
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
      // The availability record is named after the user; it may not exist yet, or belong to someone else.
      let saved: Availability | null = null;
      let notYours = false;
      try {
        saved = (await db.getDoc<Availability>(AVAILABILITY, user.name)) as Availability;
      } catch (err) {
        if (isNotYours(err)) notYours = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if ((err as any)?.exc_type !== "DoesNotExistError" && (err as any)?.httpStatus !== 404) throw err;
      }
      setCalendars(list);
      setAvailability(saved);
      setAvailabilityNotYours(notYours);
      // Start at the first unfinished step the first time the page loads.
      setStep(
        (current) =>
          current ??
          (!isConnected(pickCalendar(list)) ? 0 : !saved?.appointment_time_slot.length ? 1 : isBookingLive(saved) ? 3 : 2)
      );
    } catch (err) {
      setLoadError(errorText(err));
    }
  }, [db, user.name]);

  useEffect(() => {
    load();
  }, [load]);

  const calendar = calendars ? pickCalendar(calendars) : null;
  const done = [isConnected(calendar), !!availability?.appointment_time_slot.length, isBookingLive(availability)];

  let content = null;
  if (loadError) {
    content = (
      <Notice
        tone="red"
        title="Couldn't load your setup"
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
        {step < STEPS.length && <Stepper steps={STEPS} current={step} done={done} />}
        {step === 0 && (
          <CalendarStep
            key={calendar?.name ?? "new"}
            user={user.name}
            calendar={calendar}
            onChanged={load}
            onContinue={() => setStep(1)}
          />
        )}
        {step === 1 && calendar && (
          <HoursStep
            key={availability?.name ?? "new"}
            user={user.name}
            timeZone={timeZone}
            calendar={calendar.name}
            availability={availability}
            notYours={availabilityNotYours}
            onSaved={async (saved) => {
              setTimeZone(saved);
              await load();
              setStep(2);
            }}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && calendar && availability && (
          <BookingStep
            user={user.name}
            fullName={user.fullName}
            calendar={calendar}
            availability={availability}
            zoomReady={zoomReady}
            onSaved={async () => {
              await load();
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && availability?.slug && <DoneStep slug={availability.slug} onEdit={() => setStep(0)} />}
      </>
    );
  }

  return (
    <Frame user={user} stepLabel={step !== null && step < STEPS.length ? `Step ${step + 1} of ${STEPS.length}` : undefined}>
      {content}
    </Frame>
  );
};

export default Setup;
