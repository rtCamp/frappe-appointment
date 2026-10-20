/**
 * Google API step: walk through the Google Cloud console, then save the OAuth client
 * into Google Settings. Connecting a calendar in the next step proves the credentials work.
 */
import { ReactNode, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { errorText } from "../../api";
import { AdminApi, AdminStatus, googleReady } from "../api";
import { ExtLink, Field, LinkBox, Notice, StepHeader, Switch } from "../ui";
import { toastSaved } from "../utils";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

const ConsoleStep = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
  <li className="flex gap-3 p-4">
    <span
      className="t-xs-medium w-5 h-5 rounded-full grid place-items-center shrink-0 box-border mt-px"
      style={{ border: "1.5px solid var(--outline-gray-3)", color: "var(--ink-gray-7)" }}
    >
      {n}
    </span>
    <div className="flex flex-col gap-2.5 min-w-0 flex-1">
      <span className="t-base-medium">{title}</span>
      <div className="t-p-sm flex flex-col gap-2.5" style={{ color: "var(--ink-gray-6)" }}>
        {children}
      </div>
    </div>
  </li>
);

const GoogleStep = ({
  api,
  status,
  onSaved,
  onNext,
}: {
  api: AdminApi;
  status: AdminStatus;
  onSaved: () => Promise<AdminStatus | undefined>;
  onNext: () => void;
}) => {
  const [enable, setEnable] = useState(status.google.enable || !status.google.client_id);
  const [clientId, setClientId] = useState(status.google.client_id);
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = new URL(status.site_url).origin;
  const insecure = origin.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin);
  const clientIdLooksWrong = !!clientId.trim() && !clientId.trim().endsWith(".apps.googleusercontent.com");
  const needsSecret = !status.google.has_client_secret && !clientSecret;
  const dirty = enable !== status.google.enable || clientId.trim() !== status.google.client_id || !!clientSecret;
  const ready = googleReady(status);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.saveGoogleSettings({
        enable: enable ? 1 : 0,
        client_id: clientId.trim(),
        ...(clientSecret ? { client_secret: clientSecret.trim() } : {}),
      });
      setClientSecret("");
      toastSaved("Google settings saved");
      const next = await onSaved();
      if (!ready && next && googleReady(next)) onNext();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader title="Connect Google">
        Appointments reads people's free time from Google Calendar and adds bookings to it. That needs one Google
        OAuth client for the whole site.
      </StepHeader>

      {ready && !dirty && (
        <Notice tone="green" title="Google is set up">
          Connect your own calendar next to check the credentials work.
        </Notice>
      )}

      <section className="flex flex-col gap-2.5">
        <span className="t-base-medium">In Google Cloud</span>
        <ol className="card divide list-none m-0 p-0">
          <ConsoleStep n={1} title="Pick or create a project">
            <ExtLink href="https://console.cloud.google.com/projectcreate">Create a project</ExtLink>
          </ConsoleStep>
          <ConsoleStep n={2} title="Turn on the Google Calendar API">
            <ExtLink href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com">
              Google Calendar API
            </ExtLink>
          </ConsoleStep>
          <ConsoleStep n={3} title="Set up the consent screen">
            <span>
              Choose <span style={{ color: "var(--ink-gray-8)" }}>Internal</span> if everyone signs in with your
              Google Workspace domain. External apps need Google's review for calendar access. Add this scope:
            </span>
            <LinkBox value={CALENDAR_SCOPE} />
            <ExtLink href="https://console.cloud.google.com/auth/branding">OAuth consent screen</ExtLink>
          </ConsoleStep>
          <ConsoleStep n={4} title="Create an OAuth client ID of type Web application">
            <LinkBox label="Authorized JavaScript origin" value={origin} />
            <LinkBox label="Authorized redirect URI" value={status.redirect_uri} />
            <ExtLink href="https://console.cloud.google.com/apis/credentials/oauthclient">Create OAuth client</ExtLink>
          </ConsoleStep>
        </ol>
        {insecure && (
          <Notice tone="amber" title="This site isn't on HTTPS">
            Google only accepts HTTPS redirect URIs, except on localhost. Serve the site over HTTPS, or fix{" "}
            <code>host_name</code> in site config if the address above is wrong.
          </Notice>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <span className="t-base-medium">Paste the client here</span>
        <div className="card flex flex-col gap-5 p-4">
          <Field
            label="Client ID"
            htmlFor="admin-google-client-id"
            error={clientIdLooksWrong ? "Client IDs usually end with .apps.googleusercontent.com" : undefined}
          >
            <input
              id="admin-google-client-id"
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="1234567890-abc.apps.googleusercontent.com"
              autoComplete="off"
              aria-invalid={clientIdLooksWrong}
            />
          </Field>
          <Field
            label="Client secret"
            htmlFor="admin-google-client-secret"
            hint={status.google.has_client_secret ? "Saved. Type a new one only to replace it." : undefined}
          >
            <input
              id="admin-google-client-secret"
              className="input"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={status.google.has_client_secret ? "••••••••" : "GOCSPX-…"}
              autoComplete="new-password"
            />
          </Field>
          <div className="flex items-center justify-between gap-4">
            <div className="row-text">
              <span className="t-base-medium">Use Google on this site</span>
              <span className="t-p-sm" style={{ color: "var(--ink-gray-6)" }}>
                Turning this off stops calendar sync for everyone.
              </span>
            </div>
            <Switch checked={enable} onChange={setEnable} label="Use Google on this site" />
          </div>
        </div>
      </section>

      {error && <Notice tone="red" title="Couldn't save">{error}</Notice>}

      <div className="flex justify-end gap-2">
        {ready && !dirty ? (
          <button type="button" className="btn btn-md btn-solid" onClick={onNext}>
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-md btn-solid"
            onClick={save}
            disabled={saving || !dirty || !clientId.trim() || needsSecret}
          >
            {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Save
          </button>
        )}
      </div>
    </>
  );
};

export default GoogleStep;
