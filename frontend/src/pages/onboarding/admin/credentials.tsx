/**
 * The last admin step: the OAuth client saved into Google Settings (Client ID, secret, Enable),
 * through the standard REST resource API.
 */
import { useContext, useState } from "react";
import { Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import { GOOGLE_SETTINGS, GoogleSetup, errorText } from "../api";
import { Button, Notice, Switch } from "../ui";

const CLIENT_ID_PATTERN = /\.apps\.googleusercontent\.com$/;

const inputClass =
  "h-8 px-2.5 rounded-lg border bg-surface-base font-mono text-[13px] text-ink-gray-8 placeholder:text-ink-gray-4 focus:outline-none focus:border-outline-gray-4 focus:shadow-es-focus";

const Credentials = ({
  setup,
  onBack,
  onContinue,
}: {
  setup: GoogleSetup;
  onBack: () => void;
  onContinue: () => void;
}) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const [clientId, setClientId] = useState(setup.client_id);
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Credentials from Gmail or Drive may already be there; the saved secret can't be shown, only kept or replaced.
  const alreadySet = !!setup.client_id && setup.has_client_secret;
  const clientIdOk = CLIENT_ID_PATTERN.test(clientId.trim());
  const canSave = !!clientId.trim() && (!!secret.trim() || setup.has_client_secret) && enabled;

  const save = async () => {
    setTried(true);
    if (!clientIdOk) return;
    setError(null);
    setSaving(true);
    try {
      await db.updateDoc(GOOGLE_SETTINGS, GOOGLE_SETTINGS, {
        enable: 1,
        client_id: clientId.trim(),
        ...(secret.trim() ? { client_secret: secret.trim() } : {}),
      });
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-es-title text-ink-gray-9">Paste your Google credentials</h2>
        <p className="m-0 text-es-p-base text-ink-gray-6">
          Use the Client ID and Client secret Google just showed you. They're saved in Google Settings, which every Google
          integration on this site shares.
        </p>
      </div>

      {alreadySet && (
        <Notice tone="blue" title="This site already has Google credentials">
          Probably for Gmail or Drive. You can keep them: leave the secret blank to keep the saved one. Just make sure the
          Calendar API and the redirect URI from step 4 are added to the same Google project.
        </Notice>
      )}

      <div className="flex flex-col rounded-xl border border-outline-gray-1">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-id" className="text-es-sm text-ink-gray-6">
              Client ID
            </label>
            <input
              id="client-id"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="1234567890-abc123.apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={tried && !clientIdOk}
              disabled={saved}
              className={cn(inputClass, tried && !clientIdOk ? "border-ink-red-7" : "border-outline-gray-2")}
            />
            {tried && !clientIdOk && (
              <span role="alert" className="text-es-p-sm text-ink-red-7">
                This doesn't look like a Client ID. It should end with .apps.googleusercontent.com.
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-secret" className="text-es-sm text-ink-gray-6">
              Client secret
            </label>
            <div className="flex items-center h-8 pl-2.5 pr-1 rounded-lg border border-outline-gray-2 bg-surface-base focus-within:border-outline-gray-4 focus-within:shadow-es-focus">
              <input
                id="client-secret"
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={setup.has_client_secret ? "Saved. Paste a new one to replace it" : "GOCSPX-…"}
                autoComplete="off"
                spellCheck={false}
                disabled={saved}
                className="flex-1 min-w-0 h-7 p-0 border-0 outline-none bg-transparent font-mono text-[13px] text-ink-gray-8 placeholder:text-ink-gray-4"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                aria-label={showSecret ? "Hide secret" : "Show secret"}
                className="grid place-items-center w-7 h-6 rounded-md border-0 bg-transparent text-ink-gray-6 cursor-pointer hover:bg-surface-gray-2"
              >
                {showSecret ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
            <span className="text-es-p-sm text-ink-gray-5">Stored encrypted. Nobody can read it back, including you.</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-6 px-5 py-4 border-t border-outline-gray-1">
          <span className="flex flex-col gap-1">
            <span className="text-es-base font-medium text-ink-gray-8">Turn on Google for this site</span>
            <span className="text-es-p-sm text-ink-gray-6">
              This is the Enable checkbox in Google Settings. Without it, nobody can connect a calendar.
            </span>
          </span>
          <Switch checked={enabled} onChange={setEnabled} label="Turn on Google for this site" disabled={saved} />
        </div>
      </div>

      {error && (
        <Notice tone="red" title="Couldn't save the credentials">
          {error}
        </Notice>
      )}

      {saved ? (
        <div role="status" className="flex flex-col gap-3.5 p-5 rounded-xl bg-surface-gray-1">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full grid place-items-center shrink-0 bg-surface-green-2 text-ink-green-7">
              <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-es-base font-medium text-ink-gray-8">Google is turned on for this site</span>
              <span className="text-es-p-sm text-ink-gray-6">Everyone can now connect their calendar from Appointments.</span>
            </span>
          </div>
          <span className="text-es-p-sm text-ink-gray-6">
            Next, connect your own calendar. It's also the first real test of these credentials. If Google shows an error
            there, it's almost always the redirect URI from step 4.
          </span>
          <Button variant="solid" size="md" className="self-start" onClick={onContinue}>
            Continue to your setup
          </Button>
        </div>
      ) : (
        <div className="flex justify-between gap-2">
          <Button size="md" onClick={onBack}>
            Back to the guide
          </Button>
          <Button variant="solid" size="md" onClick={save} disabled={saving || !canSave}>
            {saving && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Save and turn on
          </Button>
        </div>
      )}
    </>
  );
};

export default Credentials;
