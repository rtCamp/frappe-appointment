/**
 * The setup steps inside the page frame: Calendar, then Hours, then Booking page.
 */
import { useCallback, useContext, useEffect, useState } from "react";
import { FrappeConfig, FrappeContext, useFrappeGetCall } from "frappe-react-sdk";

import {
  AVAILABILITY,
  Availability,
  CALENDAR_FIELDS,
  CalendarInfo,
  GOOGLE_CALENDAR,
  IS_CALENDAR_CONNECTED,
  SessionUser,
  errorText,
  isSetUp,
  isConnected,
  isNotYours,
  pickCalendar,
  slotsAsText,
} from "./api";
import { Frame, FrameNav } from "./frame";
import { Button, Notice, Stepper, Switch } from "./ui";
import CalendarStep from "./steps/calendar";
import HoursStep from "./steps/hours";
import BookingStep from "./steps/booking";
import DoneStep from "./steps/done";
import Home from "./home";
import MeetingTypes from "./meeting-types";
import AvailabilityPage from "./availability";
import SettingsDialog, { SettingsTab } from "./settings";
import AdminSetup from "./admin";
import GroupsPage from "./groups";
import GroupPage from "./group-detail";
import GroupForm from "./group-form";

const STEPS = ["Calendar", "Hours", "Booking page"];
const DONE = 3;

/**
 * A setup step (0-2), the done screen (3), or an app section once setup is finished. Group screens carry
 * the group: "group:<name>", "group-edit:<name>".
 */
type View = number | "home" | "types" | "availability" | "guide" | "groups" | "group-new" | `group:${string}` | `group-edit:${string}`;

const SECTION_VIEWS: Record<string, View> = {
  Home: "home",
  "Meeting types": "types",
  Availability: "availability",
  "Group meetings": "groups",
};

const Setup = ({
  user: sessionUser,
  zoomReady,
  blocksTimeOff,
  onStatusChanged,
}: {
  user: SessionUser;
  zoomReady: boolean;
  blocksTimeOff: boolean;
  /** Reloads the onboarding status, e.g. once an admin turns Zoom on. */
  onStatusChanged: () => void;
}) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const [calendars, setCalendars] = useState<CalendarInfo[] | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityNotYours, setAvailabilityNotYours] = useState(false);
  const [timeZone, setTimeZone] = useState(sessionUser.timeZone);
  // The boot data's time zone goes stale once the user changes it here.
  const user = { ...sessionUser, timeZone };
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [toggling, setToggling] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

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
      // The first time the page loads: Home once setup is finished, else the first unfinished step.
      setView(
        (current) =>
          current ??
          (isSetUp(saved) ? "home" : !isConnected(pickCalendar(list, saved)) ? 0 : !saved?.appointment_time_slot.length ? 1 : 2)
      );
    } catch (err) {
      setLoadError(errorText(err));
    }
  }, [db, user.name]);

  useEffect(() => {
    load();
  }, [load]);

  const calendar = calendars ? pickCalendar(calendars, availability) : null;
  // A calendar can look connected after Google stopped accepting its sign-in, so Home asks the server. Asked again
  // whenever the record changes, like after reconnecting.
  const { data: googleAccepts } = useFrappeGetCall<{ message: boolean }>(
    IS_CALENDAR_CONNECTED,
    { calendar: calendar?.name },
    view === "home" && isConnected(calendar) ? `${IS_CALENDAR_CONNECTED}:${calendar?.name}:${calendar?.modified}` : null,
    { revalidateOnFocus: false }
  );
  const done = [isConnected(calendar), !!availability?.appointment_time_slot.length, isSetUp(availability)];
  const setUp = isSetUp(availability);
  const step = typeof view === "number" ? view : null;

  /** The sidebar and the Settings menu item, once setup is finished. */
  const appNav = (current?: string): FrameNav =>
    setUp
      ? {
          openSections: Object.keys(SECTION_VIEWS),
          current,
          onOpen: (section) => setView(SECTION_VIEWS[section]),
          onSettings: () => setSettingsTab("booking"),
        }
      : {};

  /** The Accepting bookings switch: the booking page's enable_scheduling. */
  const setAccepting = async (on: boolean) => {
    if (!availability) return;
    setHomeError(null);
    setToggling(true);
    try {
      await db.updateDoc(AVAILABILITY, availability.name, {
        enable_scheduling: on ? 1 : 0,
        appointment_time_slot: slotsAsText(availability),
      });
      await load();
    } catch (err) {
      setHomeError(errorText(err));
    } finally {
      setToggling(false);
    }
  };

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
  } else if (calendars && view === "home" && availability) {
    content = (
      <>
        {homeError && (
          <Notice tone="red" title="Couldn't change your booking page">
            {homeError}
          </Notice>
        )}
        <Home
          user={user}
          availability={availability}
          calendarConnected={isConnected(calendar) && googleAccepts?.message !== false}
          onReconnect={() => setSettingsTab("calendar")}
        />
      </>
    );
  } else if (calendars && step !== null) {
    content = (
      <>
        {step < DONE && <Stepper steps={STEPS} current={step} done={done} />}
        {step === 0 && (
          <CalendarStep
            key={calendar?.name ?? "new"}
            user={user.name}
            calendar={calendar}
            onChanged={load}
            onContinue={() => setView(1)}
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
            blocksTimeOff={blocksTimeOff}
            onSaved={async (saved) => {
              setTimeZone(saved);
              await load();
              setView(2);
            }}
            onBack={() => setView(0)}
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
              setView(DONE);
            }}
            onBack={() => setView(1)}
          />
        )}
        {step === DONE && availability?.slug && <DoneStep slug={availability.slug} onHome={() => setView("home")} />}
      </>
    );
  }

  let page;
  const groupView = typeof view === "string" && view.startsWith("group");
  if (setUp && (view === "groups" || view === "group-new")) {
    // A new group is made in a dialog over the list.
    page = (
      <>
        <GroupsPage user={user} nav={appNav("Group meetings")} onOpen={(name) => setView(`group:${name}`)} onNew={() => setView("group-new")} />
        {view === "group-new" && (
          <GroupForm
            user={user}
            name={null}
            zoomReady={zoomReady}
            onSaved={(saved) => setView(`group:${saved}`)}
            onCancel={() => setView("groups")}
            onDeleted={() => setView("groups")}
          />
        )}
      </>
    );
  } else if (setUp && groupView && (view.startsWith("group:") || view.startsWith("group-edit:"))) {
    // A group is changed in a dialog over its page.
    const editing = view.startsWith("group-edit:");
    const name = view.slice(view.indexOf(":") + 1);
    page = (
      <>
        <GroupPage
          key={name}
          user={user}
          name={name}
          nav={appNav("Group meetings")}
          onBack={() => setView("groups")}
          onEdit={() => setView(`group-edit:${name}`)}
          onReconnect={() => setSettingsTab("calendar")}
          calendarVersion={calendar?.modified}
        />
        {editing && (
          <GroupForm
            user={user}
            name={name}
            zoomReady={zoomReady}
            onSaved={() => setView(`group:${name}`)}
            onCancel={() => setView(`group:${name}`)}
            onDeleted={() => setView("groups")}
          />
        )}
      </>
    );
  } else if (view === "guide") {
    page = <AdminSetup user={user} startAt="guide" nav={appNav()} onDone={() => setView("home")} />;
  } else if (view === "types" && availability && !loadError) {
    page = <MeetingTypes user={user} availability={availability} nav={appNav("Meeting types")} onChanged={load} />;
  } else if (view === "availability" && availability && !loadError) {
    page = (
      <AvailabilityPage
        user={user}
        timeZone={timeZone}
        availability={availability}
        blocksTimeOff={blocksTimeOff}
        nav={appNav("Availability")}
        onSaved={async (saved) => {
          setTimeZone(saved);
          await load();
        }}
      />
    );
  } else if (view === "home" && availability) {
    page = (
      <Frame
        user={user}
        title="Home"
        width="home"
        {...appNav("Home")}
        headerAction={
          <label className="inline-flex items-center gap-2.5 cursor-pointer">
            <span className="text-es-base text-ink-gray-7">Accepting bookings</span>
            <Switch
              size="md"
              checked={!!availability.enable_scheduling}
              onChange={setAccepting}
              label="Accepting bookings"
              disabled={toggling}
            />
          </label>
        }
      >
        {content}
      </Frame>
    );
  } else {
    page = (
      <Frame
        user={user}
        stepLabel={step !== null && step < DONE ? `Step ${step + 1} of ${STEPS.length}` : undefined}
        {...appNav()}
      >
        {content}
      </Frame>
    );
  }

  return (
    <>
      {page}
      {settingsTab && setUp && availability && (
        <SettingsDialog
          user={user}
          availability={availability}
          calendar={calendar}
          zoomReady={zoomReady}
          tab={settingsTab}
          onTab={setSettingsTab}
          onChanged={load}
          onSiteChanged={onStatusChanged}
          onOpenGuide={() => {
            setSettingsTab(null);
            setView("guide");
          }}
          onClose={() => setSettingsTab(null)}
        />
      )}
    </>
  );
};

export default Setup;
