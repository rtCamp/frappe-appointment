/**
 * Video calls step (optional): a Zoom Server-to-Server OAuth app's credentials in
 * Appointment Settings. Google Meet and fixed links need nothing here.
 */
import { useState } from "react";
import { LoaderCircle, Video } from "lucide-react";

import { errorText } from "../../api";
import { AdminApi, AdminStatus, zoomReady } from "../api";
import { ExtLink, Field, LinkBox, Notice, StepHeader, Switch } from "../ui";
import { toastSaved } from "../utils";

const ZOOM_SCOPES = [
  "meeting:write:meeting:admin",
  "meeting:update:meeting:admin",
  "meeting:delete:meeting:admin",
  "meeting:write:meeting:master",
  "meeting:update:meeting:master",
  "meeting:delete:meeting:master",
];

type Check = { ok: boolean; message: string } | null;

const ZoomStep = ({
  api,
  status,
  onSaved,
  onBack,
  onNext,
}: {
  api: AdminApi;
  status: AdminStatus;
  onSaved: () => Promise<AdminStatus | undefined>;
  onBack: () => void;
  onNext: () => void;
}) => {
  const [enable, setEnable] = useState(status.zoom.enable);
  const [accountId, setAccountId] = useState(status.zoom.account_id);
  const [clientId, setClientId] = useState(status.zoom.client_id);
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<Check>(null);

  const dirty =
    enable !== status.zoom.enable ||
    accountId.trim() !== status.zoom.account_id ||
    clientId.trim() !== status.zoom.client_id ||
    !!clientSecret;
  const missing = enable && (!accountId.trim() || !clientId.trim() || (!status.zoom.has_client_secret && !clientSecret));

  const test = async () => {
    setTesting(true);
    setCheck(null);
    try {
      setCheck(await api.testZoom());
    } catch (err) {
      setCheck({ ok: false, message: errorText(err) });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setError(null);
    setCheck(null);
    setSaving(true);
    try {
      await api.saveAppointmentSettings({
        enable_zoom: enable ? 1 : 0,
        zoom_account_id: accountId.trim(),
        zoom_client_id: clientId.trim(),
        ...(clientSecret ? { zoom_client_secret: clientSecret.trim() } : {}),
      });
      setClientSecret("");
      toastSaved(enable ? "Zoom settings saved" : "Zoom turned off");
      await onSaved();
    } catch (err) {
      setError(errorText(err));
      return;
    } finally {
      setSaving(false);
    }
    // Fetching a token right away catches wrong credentials and replaces any token from old ones.
    if (enable) await test();
  };

  return (
    <>
      <StepHeader title="Video calls">
        Optional. Meetings can get a Google Meet link or a fixed link with no setup. Turn on Zoom if people should get
        Zoom links.
      </StepHeader>

      <div className="card divide">
        <div className="row">
          <span className="flex items-center gap-3 min-w-0">
            <span className="ico">
              <Video aria-hidden="true" />
            </span>
            <span className="row-text">
              <span className="t-base-medium">Zoom</span>
              <span className="t-p-sm" style={{ color: "var(--ink-gray-6)" }}>
                A Zoom account admin creates a Server-to-Server OAuth app once.
              </span>
            </span>
          </span>
          <Switch checked={enable} onChange={setEnable} label="Use Zoom" />
        </div>

        {enable && (
          <div className="flex flex-col gap-5 p-4">
            <ol className="t-p-sm m-0 pl-5 flex flex-col gap-2.5" style={{ color: "var(--ink-gray-6)" }}>
              <li>
                In the Zoom App Marketplace, choose Develop, then Build App, then{" "}
                <span style={{ color: "var(--ink-gray-8)" }}>Server-to-Server OAuth</span>.{" "}
                <ExtLink href="https://marketplace.zoom.us/develop/create">Open Zoom</ExtLink>
              </li>
              <li className="flex flex-col gap-2">
                Add these scopes, then activate the app.
                <LinkBox value={ZOOM_SCOPES.join(" ")} />
              </li>
              <li>Copy the app credentials below.</li>
            </ol>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Account ID" htmlFor="admin-zoom-account">
                <input
                  id="admin-zoom-account"
                  className="input"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Client ID" htmlFor="admin-zoom-client">
                <input
                  id="admin-zoom-client"
                  className="input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </div>
            <Field
              label="Client secret"
              htmlFor="admin-zoom-secret"
              hint={status.zoom.has_client_secret ? "Saved. Type a new one only to replace it." : undefined}
            >
              <input
                id="admin-zoom-secret"
                className="input"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={status.zoom.has_client_secret ? "••••••••" : undefined}
                autoComplete="new-password"
              />
            </Field>
            <p className="field-hint">
              Meetings are created for the Zoom email on each person's Google Calendar, so that email needs a Zoom
              license in this account. You can set it for a group's calendar when you create the group.
            </p>
          </div>
        )}
      </div>

      {error && <Notice tone="red" title="Couldn't save">{error}</Notice>}
      {check && (
        <Notice tone={check.ok ? "green" : "red"} title={check.ok ? "Zoom is connected" : "Zoom didn't accept these"}>
          {check.message}
        </Notice>
      )}

      <div className="flex justify-between gap-2">
        <button type="button" className="btn btn-md" onClick={onBack}>
          Back
        </button>
        <div className="flex gap-2">
          {zoomReady(status) && enable && !dirty && (
            <button type="button" className="btn btn-md btn-outline" onClick={test} disabled={testing}>
              {testing && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Test connection
            </button>
          )}
          {dirty ? (
            <button type="button" className="btn btn-md btn-solid" onClick={save} disabled={saving || testing || missing}>
              {(saving || testing) && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Save
            </button>
          ) : (
            <button type="button" className="btn btn-md btn-solid" onClick={onNext}>
              {enable ? "Continue" : "Skip, no Zoom"}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default ZoomStep;
