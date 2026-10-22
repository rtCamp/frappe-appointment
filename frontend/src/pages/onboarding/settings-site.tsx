/**
 * Settings for the whole site, for people who can change them: Google (Google Settings), Zoom and the
 * default emails (Appointment Settings).
 */
import { ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { BookOpen, ChevronDown, LoaderCircle } from "lucide-react";
import { FrappeConfig, FrappeContext, useFrappeGetCall } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import {
  APPOINTMENT_SETTINGS,
  AVAILABILITY,
  CLIENT_ID_PATTERN,
  EMAIL_TEMPLATE,
  GOOGLE_SETTINGS,
  GOOGLE_SETUP,
  GoogleSetup,
  errorText,
} from "./api";
import { Button, CopyValue, Notice, Pill, SettingRow, Switch } from "./ui";

const inputClass =
  "h-7 px-2 rounded-lg border border-outline-gray-2 bg-surface-base font-mono text-[12px] text-ink-gray-8 placeholder:text-ink-gray-4 focus:outline-none focus:border-outline-gray-4 focus:shadow-es-focus";

/** A stored secret: it can't be shown, only replaced. */
const SecretRow = ({
  id,
  title,
  saved,
  value,
  onChange,
}: {
  id: string;
  title: string;
  saved: boolean;
  value: string;
  onChange: (value: string) => void;
}) => {
  const [replacing, setReplacing] = useState(!saved);
  return (
    <SettingRow
      title={<label htmlFor={id}>{title}</label>}
      description={saved ? "Stored encrypted, so it can't be shown. Replace it if you made a new one." : "Stored encrypted once saved."}
    >
      {replacing ? (
        <input
          id={id}
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={saved ? "Paste the new secret" : "Paste the secret"}
          autoComplete="off"
          className={cn(inputClass, "w-[260px] max-w-full")}
        />
      ) : (
        <span className="flex items-center gap-2">
          <span className="text-es-base tracking-[2px] text-ink-gray-5" aria-label="Saved">
            ••••••••••••
          </span>
          <Button onClick={() => setReplacing(true)}>Replace</Button>
        </span>
      )}
    </SettingRow>
  );
};

/** On/off for a site integration, with its state as a pill. */
const SiteSwitch = ({ title, description, on, onChange }: { title: string; description: string; on: boolean; onChange: (on: boolean) => void }) => (
  <SettingRow
    title={
      <span className="flex items-center gap-2">
        {title}
        <Pill tone={on ? "green" : "gray"}>{on ? "On" : "Off"}</Pill>
      </span>
    }
    description={description}
  >
    <Switch checked={on} onChange={onChange} label={title} />
  </SettingRow>
);

const SaveBar = ({ left, dirty, valid, saving, saved, onSave }: { left?: ReactNode; dirty: boolean; valid: boolean; saving: boolean; saved: boolean; onSave: () => void }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
    {left ?? <span />}
    <span className="flex items-center gap-2">
      {saved && !dirty && (
        <span role="status" className="text-es-sm text-ink-gray-5">
          Saved
        </span>
      )}
      <Button variant="solid" onClick={onSave} disabled={!dirty || !valid || saving}>
        {saving && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
        Save
      </Button>
    </span>
  </div>
);

export const GoogleTab = ({ onOpenGuide }: { onOpenGuide: () => void }) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const { data, mutate } = useFrappeGetCall<{ message: GoogleSetup }>(GOOGLE_SETUP);
  const setup = data?.message;
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!setup) return null;
  const on = enabled ?? setup.enabled;
  const id = clientId ?? setup.client_id;
  const dirty = on !== setup.enabled || id.trim() !== setup.client_id || !!secret.trim();
  const idOk = !id.trim() || CLIENT_ID_PATTERN.test(id.trim());
  // Google can only be on with a Client ID and a secret.
  const valid = idOk && (!on || (!!id.trim() && (setup.has_client_secret || !!secret.trim())));

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await db.updateDoc(GOOGLE_SETTINGS, GOOGLE_SETTINGS, {
        enable: on ? 1 : 0,
        client_id: id.trim(),
        ...(secret.trim() ? { client_secret: secret.trim() } : {}),
      });
      await mutate();
      setEnabled(null);
      setClientId(null);
      setSecret("");
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <span className="pt-1 text-es-p-sm text-ink-gray-6">
        The Google Cloud credentials this site uses to connect calendars. Saved in Google Settings, which other Google
        integrations on this site share.
      </span>
      <SiteSwitch
        title="Google for this site"
        description="Turning it off stops everyone from connecting or syncing calendars."
        on={on}
        onChange={(v) => (setEnabled(v), setSaved(false))}
      />
      {setup.enabled && !on && (
        <Notice tone="amber" title="Booking pages stop working while Google is off">
          Nobody can connect a calendar, and bookings can't be added to calendars. You'll see the setup guide the next time
          you open Appointments.
        </Notice>
      )}
      <div className="flex flex-col gap-1.5 py-4 border-b border-outline-gray-1">
        <label htmlFor="site-client-id" className="text-es-base font-medium text-ink-gray-8">
          Client ID
        </label>
        <input
          id="site-client-id"
          type="text"
          value={id}
          onChange={(e) => (setClientId(e.target.value), setSaved(false))}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!idOk}
          className={cn(inputClass, !idOk && "border-ink-red-7")}
        />
        {!idOk && (
          <span className="text-es-p-sm text-ink-red-7">This doesn't look like a Client ID. It ends with .apps.googleusercontent.com.</span>
        )}
      </div>
      <SecretRow id="site-client-secret" title="Client secret" saved={setup.has_client_secret} value={secret} onChange={(v) => (setSecret(v), setSaved(false))} />
      <div className="flex flex-col gap-1.5 py-4">
        <span className="text-es-base font-medium text-ink-gray-8">Redirect URI</span>
        <span className="text-es-p-sm text-ink-gray-6">Must be listed on the OAuth client in Google Cloud. Most connection errors come from this.</span>
        <div className="mt-0.5">
          <CopyValue value={setup.redirect_uri} wrap />
        </div>
      </div>
      {error && (
        <Notice tone="red" title="Couldn't save Google">
          {error}
        </Notice>
      )}
      <SaveBar
        left={
          <Button variant="ghost" onClick={onOpenGuide}>
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            Open the setup guide
          </Button>
        }
        dirty={dirty}
        valid={valid}
        saving={saving}
        saved={saved}
        onSave={save}
      />
    </>
  );
};

interface AppointmentSettings {
  enable_zoom: 0 | 1;
  zoom_account_id: string | null;
  zoom_client_id: string | null;
  /** Masked: asterisks when a secret is stored. */
  zoom_client_secret: string | null;
  default_personal_email_template: string | null;
  default_group_email_template: string | null;
  default_availability_alerts_email_template: string | null;
  personal_organisers_email_template: string | null;
}

const useAppointmentSettings = () => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const [settings, setSettings] = useState<AppointmentSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      db
        .getDoc<AppointmentSettings>(APPOINTMENT_SETTINGS, APPOINTMENT_SETTINGS)
        .then((s) => setSettings(s as AppointmentSettings))
        .catch((err) => setLoadError(errorText(err))),
    [db]
  );
  useEffect(() => {
    load();
  }, [load]);
  return { settings, loadError, load };
};

export const ZoomTab = ({ onChanged }: { onChanged: () => void }) => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const { settings, loadError, load } = useAppointmentSettings();
  const [form, setForm] = useState<{ on: boolean; accountId: string; clientId: string } | null>(null);
  const [secret, setSecret] = useState("");
  const [usingZoom, setUsingZoom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.getCount(AVAILABILITY, [["meeting_provider", "=", "Zoom"]])
      .then(setUsingZoom)
      .catch(() => setUsingZoom(null));
  }, [db]);

  if (loadError)
    return (
      <Notice tone="red" title="Couldn't load the Zoom settings">
        {loadError}
      </Notice>
    );
  if (!settings) return null;

  const savedForm = { on: !!settings.enable_zoom, accountId: settings.zoom_account_id ?? "", clientId: settings.zoom_client_id ?? "" };
  const f = form ?? savedForm;
  const set = (patch: Partial<typeof f>) => {
    setForm({ ...f, ...patch });
    setSaved(false);
  };
  const hasSecret = !!settings.zoom_client_secret;
  const dirty =
    f.on !== savedForm.on || f.accountId.trim() !== savedForm.accountId || f.clientId.trim() !== savedForm.clientId || !!secret.trim();
  // Zoom can only be on with all three credentials, like the server's checks before a Zoom booking page saves.
  const valid = !f.on || (!!f.accountId.trim() && !!f.clientId.trim() && (hasSecret || !!secret.trim()));

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await db.updateDoc(APPOINTMENT_SETTINGS, APPOINTMENT_SETTINGS, {
        enable_zoom: f.on ? 1 : 0,
        zoom_account_id: f.accountId.trim(),
        zoom_client_id: f.clientId.trim(),
        ...(secret.trim() ? { zoom_client_secret: secret.trim() } : {}),
      });
      await load();
      setForm(null);
      setSecret("");
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <div className="flex flex-col gap-1.5 py-4 border-b border-outline-gray-1">
      <label htmlFor={id} className="text-es-base font-medium text-ink-gray-8">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className={inputClass}
      />
    </div>
  );

  return (
    <>
      <span className="pt-1 text-es-p-sm text-ink-gray-6">
        Lets people give their booking page a new Zoom meeting for every booking. Uses a Server-to-Server OAuth app from the
        Zoom App Marketplace; its App credentials page has all three values.
      </span>
      <SiteSwitch title="Zoom for this site" description="Offers Zoom as a video call option on booking pages." on={f.on} onChange={(on) => set({ on })} />
      {savedForm.on && !f.on && !!usingZoom && (
        <Notice tone="amber" title={`${usingZoom === 1 ? "1 booking page uses" : `${usingZoom} booking pages use`} Zoom`}>
          Their owners won't be able to save changes to their booking page until they pick another video option.
        </Notice>
      )}
      {field("zoom-account-id", "Account ID", f.accountId, (accountId) => set({ accountId }))}
      {field("zoom-client-id", "Client ID", f.clientId, (clientId) => set({ clientId }))}
      <SecretRow id="zoom-client-secret" title="Client secret" saved={hasSecret} value={secret} onChange={(v) => (setSecret(v), setSaved(false))} />
      {f.on && !valid && <span className="pt-3 text-es-p-sm text-ink-gray-5">Zoom needs the Account ID, Client ID and Client secret.</span>}
      {error && (
        <div className="pt-3">
          <Notice tone="red" title="Couldn't save Zoom">
            {error}
          </Notice>
        </div>
      )}
      <SaveBar dirty={dirty} valid={valid} saving={saving} saved={saved} onSave={save} />
    </>
  );
};

const DEFAULT_EMAILS: { field: keyof AppointmentSettings; title: string; description: string; optional?: boolean }[] = [
  { field: "default_personal_email_template", title: "Booking pages", description: "The confirmation email new booking pages start with." },
  { field: "default_group_email_template", title: "Group meetings", description: "The confirmation email new group meetings start with." },
  {
    field: "default_availability_alerts_email_template",
    title: "Availability alerts",
    description: "The alert email new group meetings start with.",
  },
  {
    field: "personal_organisers_email_template",
    title: "Email to the host",
    description: "Sent to the host whenever someone books their booking page.",
    optional: true,
  },
];

export const DefaultEmailsTab = () => {
  const { db } = useContext(FrappeContext) as FrappeConfig;
  const { settings, loadError, load } = useAppointmentSettings();
  const [templates, setTemplates] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.getDocList<{ name: string }>(EMAIL_TEMPLATE, { fields: ["name"], orderBy: { field: "name", order: "asc" }, limit: 500 })
      .then((list) => setTemplates(list.map((t) => t.name)))
      .catch(() => setTemplates([]));
  }, [db]);

  if (loadError)
    return (
      <Notice tone="red" title="Couldn't load the default emails">
        {loadError}
      </Notice>
    );
  if (!settings) return null;

  const save = async (field: string, value: string) => {
    setBusy(field);
    setError(null);
    try {
      await db.updateDoc(APPOINTMENT_SETTINGS, APPOINTMENT_SETTINGS, { [field]: value || null });
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <span className="pt-1 text-es-p-sm text-ink-gray-6">Which emails Appointments uses unless someone picks another.</span>
      {DEFAULT_EMAILS.map(({ field, title, description, optional }, i) => {
        const value = (settings[field] as string | null) ?? "";
        const options = templates && value && !templates.includes(value) ? [value, ...templates] : templates ?? [];
        return (
          <SettingRow key={field} title={title} description={description} last={i === DEFAULT_EMAILS.length - 1}>
            <span className="relative w-[240px] max-w-full">
              <select
                aria-label={title}
                value={value}
                disabled={!templates || busy === field}
                onChange={(e) => save(field, e.target.value)}
                className="w-full h-7 pl-2 pr-7 appearance-none truncate rounded-lg border border-transparent bg-surface-gray-2 text-es-base text-ink-gray-8 cursor-pointer hover:bg-surface-gray-3 focus:outline-none focus:border-outline-gray-4 focus:shadow-es-focus disabled:cursor-wait"
              >
                <option value="" disabled={!optional}>
                  {optional ? "Don't send" : "Choose an email"}
                </option>
                {options.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
            </span>
          </SettingRow>
        );
      })}
      {error && (
        <Notice tone="red" title="Couldn't save the default email">
          {error}
        </Notice>
      )}
    </>
  );
};
