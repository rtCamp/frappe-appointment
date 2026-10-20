/**
 * Summary: what's set up, what's left, and the link to send the team.
 */
import { Check } from "lucide-react";

import { AdminStatus, googleReady, templatesReady, zoomReady } from "../api";
import { LinkBox, StepHeader } from "../ui";

const DoneStep = ({
  status,
  calendarConnected,
  onGoTo,
}: {
  status: AdminStatus;
  calendarConnected: boolean;
  onGoTo: (step: number) => void;
}) => {
  const people = status.team.filter((m) => m.availability).length;
  const rows = [
    {
      step: 0,
      title: "Google",
      done: googleReady(status),
      detail: googleReady(status) ? "OAuth client saved and turned on" : "Needs an OAuth client",
    },
    {
      step: 1,
      title: "Your calendar",
      done: calendarConnected,
      detail: calendarConnected ? "Connected" : "Not connected",
    },
    {
      step: 2,
      title: "Video calls",
      optional: true,
      done: zoomReady(status),
      detail: zoomReady(status) ? "Zoom is on" : "Google Meet or a fixed link",
    },
    {
      step: 3,
      title: "Emails",
      done: templatesReady(status),
      detail: templatesReady(status) ? "All four defaults set" : "Some emails won't be sent",
    },
    {
      step: 4,
      title: "Group meetings",
      optional: true,
      done: status.groups.length > 0,
      detail: `${status.groups.length} set up · ${people} of ${status.team.length} people have working hours`,
    },
  ];
  const ready = rows.every((r) => r.done || r.optional);

  return (
    <>
      {ready ? (
        <div className="flex flex-col items-center gap-6 text-center pt-4">
          <span
            className="w-12 h-12 rounded-full grid place-items-center"
            style={{ background: "var(--surface-green-2)", color: "var(--ink-green-7)" }}
          >
            <Check className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <StepHeader title="Appointments is ready for your team">
            Send everyone this link. They connect their calendar, choose their hours, and get their own booking page.
          </StepHeader>
          <div className="w-full text-left">
            <LinkBox value={`${window.location.origin}/schedule`} open />
          </div>
        </div>
      ) : (
        <StepHeader title="Almost there">Finish the steps below, or come back to them any time.</StepHeader>
      )}

      <ul className="card divide list-none m-0 p-0">
        {rows.map((r) => (
          <li key={r.title} className="row">
            <span className="flex items-center gap-3 min-w-0">
              {r.done ? (
                <span
                  className="w-5 h-5 rounded-full grid place-items-center shrink-0"
                  style={{ background: "var(--surface-gray-10)", color: "var(--ink-base)" }}
                >
                  <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
                </span>
              ) : (
                <span
                  className="w-5 h-5 rounded-full shrink-0 box-border"
                  style={{ border: `1.5px solid ${r.optional ? "var(--outline-gray-3)" : "var(--outline-gray-5)"}` }}
                  aria-hidden="true"
                />
              )}
              <span className="row-text">
                <span className="t-base-medium">
                  {r.title}
                  {r.optional && (
                    <span className="t-sm" style={{ color: "var(--ink-gray-5)" }}>
                      {" "}
                      · optional
                    </span>
                  )}
                </span>
                <span className="t-sm" style={{ color: "var(--ink-gray-5)" }}>
                  {r.detail}
                </span>
              </span>
            </span>
            <button type="button" className="btn" onClick={() => onGoTo(r.step)}>
              {r.done ? "Edit" : "Open"}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-center gap-2">
        <a href="/schedule" className="btn btn-md btn-solid">
          Set up my booking page
        </a>
        <a href="/desk/appointment-settings" className="btn btn-md">
          Open settings in Desk
        </a>
      </div>
    </>
  );
};

export default DoneStep;
