/**
 * Availability: the time zone and weekly hours once setup is finished, saved from the header.
 * Leaving for another section with unsaved changes asks first.
 */
import { useContext, useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { Availability, SessionUser, errorText } from "./api";
import { Frame, FrameNav } from "./frame";
import HoursEditor from "./hours-editor";
import { Button, ConfirmDialog, Notice } from "./ui";
import { useHours } from "./use-hours";

const AvailabilityPage = ({
  user,
  timeZone,
  availability,
  blocksTimeOff,
  nav,
  onSaved,
}: {
  user: SessionUser;
  timeZone: string;
  availability: Availability;
  blocksTimeOff: boolean;
  nav: FrameNav;
  /** Reloads the availability once the new hours are saved. */
  onSaved: (timeZone: string) => Promise<void>;
}) => {
  const frappe = useContext(FrappeContext) as FrappeConfig;
  const hours = useHours(availability, timeZone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Where someone tried to go with unsaved changes, waiting for them to confirm.
  const [leaving, setLeaving] = useState<(() => void) | null>(null);

  const dirty = hours.changed;
  const valid = !hours.badDays.length && !hours.noDays;

  // Reloads and closing the tab get the browser's own prompt.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (dirty) setSaved(false);
  }, [dirty]);

  const askFirst = (go: () => void) => (dirty ? setLeaving(() => go) : go());
  const { onOpen } = nav;

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await hours.save(frappe, user.name, availability.google_calendar);
      await onSaved(hours.timeZone);
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Frame
      user={user}
      title="Availability"
      width="page"
      {...nav}
      onOpen={onOpen && ((section) => section !== "Availability" && askFirst(() => onOpen(section)))}
      headerAction={
        <span className="flex items-center gap-2">
          {dirty ? (
            <span className="text-es-sm text-ink-gray-5">Unsaved changes</span>
          ) : (
            saved && (
              <span role="status" className="inline-flex items-center gap-1 text-es-sm text-ink-gray-5">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                Saved
              </span>
            )
          )}
          <Button variant={dirty && valid ? "solid" : "subtle"} onClick={save} disabled={!dirty || !valid || saving}>
            {saving && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </span>
      }
    >
      <HoursEditor
        hours={hours}
        heading="h2"
        timeZoneHint="Your hours are in this time zone. People booking you see times in their own."
        footnote={blocksTimeOff ? "Holidays from your holiday list and approved leave are blocked automatically." : undefined}
      />

      {error && (
        <Notice tone="red" title="Couldn't save your hours">
          {error}
        </Notice>
      )}

      {leaving && (
        <ConfirmDialog
          title="Leave without saving?"
          confirmLabel="Discard changes"
          onConfirm={() => {
            const go = leaving;
            setLeaving(null);
            go();
          }}
          onCancel={() => setLeaving(null)}
        >
          Your changes to your hours haven't been saved.
        </ConfirmDialog>
      )}
    </Frame>
  );
};

export default AvailabilityPage;
