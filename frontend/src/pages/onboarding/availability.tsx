/**
 * Availability: the time zone and weekly hours once setup is finished, saved at the end of the page, next to the
 * hours. Leaving with unsaved changes asks first, whether by the sidebar, a link or Back.
 */
import { useContext, useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import { Check, LoaderCircle } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { Availability, SessionUser, errorText } from "./api";
import { Frame, FrameNav } from "./frame";
import HoursEditor from "./hours-editor";
import { Button, ConfirmDialog, Notice } from "./ui";
import { paths } from "./routes";
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

  // Settings opens over this page, which stays as it is, so only going somewhere else asks.
  const leaving = useBlocker(
    ({ nextLocation }) => dirty && nextLocation.pathname !== paths.availability && !nextLocation.pathname.startsWith("/settings/")
  );

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

      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty ? (
          <>
            <span className="text-es-sm text-ink-gray-5">Unsaved changes</span>
            {/* Puts back what's saved without asking: only what was just typed is lost. */}
            <Button onClick={() => (hours.discard(), setError(null))} disabled={saving}>
              Discard
            </Button>
          </>
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
      </div>

      {leaving.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          confirmLabel="Discard changes"
          onConfirm={() => leaving.proceed()}
          onCancel={() => leaving.reset()}
        >
          Your changes to your hours haven't been saved.
        </ConfirmDialog>
      )}
    </Frame>
  );
};

export default AvailabilityPage;
