/**
 * Step 2: the user's time zone and weekly hours, saved to User.time_zone and the
 * User Appointment Availability time slots (one range per weekday).
 */
import { useContext, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { Availability, NOT_YOURS, errorText, isNotYours } from "../api";
import HoursEditor from "../hours-editor";
import { Button, Notice, StepHeader } from "../ui";
import { useHours } from "../use-hours";

const HoursStep = ({
  user,
  timeZone: savedTimeZone,
  calendar,
  availability,
  notYours,
  blocksTimeOff,
  onSaved,
  onBack,
}: {
  user: string;
  timeZone: string;
  calendar: string;
  availability: Availability | null;
  notYours: boolean;
  blocksTimeOff: boolean;
  onSaved: (timeZone: string) => Promise<void>;
  onBack: () => void;
}) => {
  const frappe = useContext(FrappeContext) as FrappeConfig;
  const hours = useHours(availability, savedTimeZone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(notYours ? NOT_YOURS : null);

  const save = async () => {
    // Nothing to write: just move on. (The server rejects any save while, say, a saved Zoom
    // choice is no longer set up, so an unchanged step shouldn't depend on it.)
    if (!hours.changed) return onSaved(hours.timeZone);
    setError(null);
    setSaving(true);
    try {
      await hours.save(frappe, user, calendar);
      await onSaved(hours.timeZone);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError(isNotYours(err) || (err as any)?.exc_type === "DuplicateEntryError" ? NOT_YOURS : errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader title="When can people book you?">
        People can only book inside these hours, never over something already on your calendar.
        {blocksTimeOff && " Holidays and approved leave are blocked too."}
      </StepHeader>

      <HoursEditor hours={hours} heading="label" timeZoneHint="People booking you see times in their own time zone." />

      {error && (
        <Notice tone="red" title="Couldn't save your hours">
          {error}
        </Notice>
      )}

      <div className="flex justify-between gap-2">
        <Button size="md" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="solid"
          size="md"
          onClick={save}
          disabled={saving || notYours || hours.badDays.length > 0 || hours.noDays}
        >
          {saving && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Continue
        </Button>
      </div>
    </>
  );
};

export default HoursStep;
