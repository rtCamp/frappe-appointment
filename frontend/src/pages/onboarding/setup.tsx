/**
 * The setup steps inside the page frame: Calendar, then Hours, then Booking page. Once set up, the app's sections.
 * Which one shows comes from the address (see routes.ts).
 */
import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { AppRoute, OpenedFrom, parsePath, paths } from "./routes";

const STEPS = ["Calendar", "Hours", "Booking page"];
const DONE = 3;

/**
 * A setup step (0-2), the done screen (3), or an app section once setup is finished. Group screens carry
 * the group: "group:<name>", "group-edit:<name>".
 */
type View = number | "home" | "types" | "availability" | "guide" | "groups" | "group-new" | `group:${string}` | `group-edit:${string}`;

const viewOf = (route: AppRoute): View => {
  switch (route.screen) {
    case "types":
      return "types";
    case "availability":
      return "availability";
    case "groups":
      return route.isNew ? "group-new" : "groups";
    case "group":
      return route.edit ? `group-edit:${route.name}` : `group:${route.name}`;
    case "setup":
      return route.step;
    case "guide":
    case "credentials":
      return "guide";
    default:
      return "home";
  }
};

const SECTION_PATHS: Record<string, string> = {
  Home: paths.home,
  "Meeting types": paths.types(),
  Availability: paths.availability,
  "Group meetings": paths.groups,
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
    } catch (err) {
      setLoadError(errorText(err));
    }
  }, [db, user.name]);

  useEffect(() => {
    load();
  }, [load]);

  const location = useLocation();
  const navigate = useNavigate();
  const opened = location.state as OpenedFrom | null;
  // index.tsx shows Not found for addresses the app doesn't have.
  const route = parsePath(location.pathname) ?? { screen: "home" };
  // Settings is a dialog over the page it was opened from; opened by its address, over Home.
  const settingsTab: SettingsTab | null = route.screen === "settings" ? route.tab : null;
  const pageRoute = settingsTab ? parsePath(opened?.back?.split("?")[0] ?? "/") ?? { screen: "home" } : route;
  const view = viewOf(pageRoute);

  /** Opens a dialog's address, remembering the page under it. */
  const openOver = (path: string) =>
    navigate(path, { state: { back: opened?.back && settingsTab ? opened.back : location.pathname + location.search } });
  /** Closes a dialog: Back to the page it was opened from, or to `page` when it was opened by its address. */
  const closeTo = (page: string) => (opened?.back ? navigate(-1) : navigate(page, { replace: true }));
  const setView = (next: View) => {
    if (typeof next === "number") return navigate(paths.setup(next));
    if (next === "group-new") return openOver(paths.newGroup);
    if (next.startsWith("group-edit:")) return openOver(paths.group(next.slice(11), true));
    if (next.startsWith("group:")) return navigate(paths.group(next.slice(6)));
    if (next === "guide") return navigate(paths.guide(0));
    navigate(next === "types" ? paths.types() : next === "availability" ? paths.availability : next === "groups" ? paths.groups : paths.home);
  };
  const openSettings = (tab: SettingsTab) => openOver(paths.settings(tab));

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
  const firstUnfinished = !done[0] ? 0 : !done[1] ? 1 : 2;

  // Until setup is finished, the app's sections aren't there yet: go to the first unfinished step. A step further
  // than that can't open yet either.
  const loaded = !!calendars;
  const admin = pageRoute.screen === "guide" || pageRoute.screen === "credentials";
  useEffect(() => {
    if (!loaded || loadError) return;
    if (step !== null) {
      if (step === -1) navigate(setUp ? paths.home : paths.setup(firstUnfinished), { replace: true });
      else if (!setUp && step > firstUnfinished) navigate(paths.setup(firstUnfinished), { replace: true });
    } else if (!setUp && !admin) {
      navigate(paths.setup(firstUnfinished), { replace: true });
    }
  }, [loaded, loadError, setUp, firstUnfinished, step, admin, navigate]);

  // A meeting type opens in the editor by its id; one that's gone shows the list.
  const editRoute = pageRoute.screen === "types" ? pageRoute.edit : undefined;
  const savedTypes = availability?.available_durations ?? [];
  const editingType =
    editRoute === "new" ? "new" : editRoute ? savedTypes.find((t) => t.name === editRoute)?.name ?? null : null;
  const unknownType = !!availability && !!editRoute && !editingType;
  useEffect(() => {
    if (unknownType) navigate(paths.types(), { replace: true });
  }, [unknownType, navigate]);

  /** The sidebar and the Settings menu item, once setup is finished. */
  const appNav = (current?: string): FrameNav =>
    setUp
      ? {
          openSections: Object.keys(SECTION_PATHS),
          current,
          onOpen: (section) => location.pathname !== SECTION_PATHS[section] && navigate(SECTION_PATHS[section]),
          onSettings: () => openSettings("booking"),
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
          onReconnect={() => openSettings("calendar")}
        />
      </>
    );
  } else if (calendars && step !== null && step >= 0) {
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
        {step === DONE && availability?.slug && <DoneStep slug={availability.slug} onHome={() => navigate(paths.home)} />}
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
            onSaved={(saved) => navigate(paths.group(saved), { replace: true })}
            onCancel={() => closeTo(paths.groups)}
            onDeleted={() => navigate(paths.groups, { replace: true })}
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
          onBack={() => navigate(paths.groups)}
          onEdit={() => setView(`group-edit:${name}`)}
          onReconnect={() => openSettings("calendar")}
          calendarVersion={calendar?.modified}
        />
        {editing && (
          <GroupForm
            user={user}
            name={name}
            zoomReady={zoomReady}
            onSaved={() => closeTo(paths.group(name))}
            onCancel={() => closeTo(paths.group(name))}
            onDeleted={() => navigate(paths.groups, { replace: true })}
          />
        )}
      </>
    );
  } else if (view === "guide") {
    page = <AdminSetup user={user} nav={appNav()} onDone={() => navigate(paths.home)} />;
  } else if (view === "types" && availability && !loadError) {
    page = (
      <MeetingTypes
        user={user}
        availability={availability}
        nav={appNav("Meeting types")}
        editing={editingType}
        onEdit={(name) =>
          (name ? openOver(paths.types(name)) : closeTo(paths.types()))
        }
        onChanged={load}
      />
    );
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
          onTab={(tab) => navigate(paths.settings(tab), { replace: true, state: location.state })}
          onChanged={load}
          onSiteChanged={onStatusChanged}
          onOpenGuide={() => navigate(paths.guide(0), { replace: true })}
          onClose={() => closeTo(paths.home)}
        />
      )}
    </>
  );
};

export default Setup;
