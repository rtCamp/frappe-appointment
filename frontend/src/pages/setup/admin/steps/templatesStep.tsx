/**
 * Emails step: the four default templates in Appointment Settings. The app sets them
 * on install, so this is usually a review rather than a setup.
 */
import { useState } from "react";
import { LoaderCircle, Pencil } from "lucide-react";

import { errorText } from "../../api";
import { AdminApi, AdminStatus, TemplateDefaults } from "../api";
import { Notice, StepHeader } from "../ui";
import { toastSaved } from "../utils";

const FIELDS: { key: keyof TemplateDefaults; field: string; label: string; hint: string }[] = [
  {
    key: "personal",
    field: "default_personal_email_template",
    label: "Personal booking confirmation",
    hint: "To the attendee, for personal links",
  },
  {
    key: "personal_organisers",
    field: "personal_organisers_email_template",
    label: "Host notification",
    hint: "To the host when someone books",
  },
  {
    key: "group",
    field: "default_group_email_template",
    label: "Group meeting confirmation",
    hint: "To the attendee, for group meetings",
  },
  {
    key: "availability",
    field: "default_availability_alerts_email_template",
    label: "Low availability warning",
    hint: "When a group meeting runs short of slots",
  },
];

const TemplatesStep = ({
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
  const [values, setValues] = useState<TemplateDefaults>(status.templates);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = FIELDS.some((f) => (values[f.key] ?? null) !== (status.templates[f.key] ?? null));

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.saveAppointmentSettings(Object.fromEntries(FIELDS.map((f) => [f.field, values[f.key] || null])));
      toastSaved("Email templates saved");
      await onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <StepHeader title="Emails">
        Defaults for everyone. The app comes with these templates; people and group meetings can pick their own.
      </StepHeader>

      <div className="card divide">
        {FIELDS.map((f) => {
          const value = values[f.key];
          const options =
            value && !status.email_templates.includes(value) ? [value, ...status.email_templates] : status.email_templates;
          return (
            <div key={f.key} className="row flex-wrap">
              <label htmlFor={`admin-template-${f.key}`} className="row-text flex-1 basis-48">
                <span className="t-base-medium">{f.label}</span>
                <span className="t-sm" style={{ color: "var(--ink-gray-5)" }}>
                  {f.hint}
                </span>
              </label>
              <div className="flex items-center gap-1 w-72 max-w-full">
                <select
                  id={`admin-template-${f.key}`}
                  className="input"
                  value={value ?? ""}
                  onChange={(e) => setValues((current) => ({ ...current, [f.key]: e.target.value || null }))}
                >
                  <option value="">No email</option>
                  {options.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {value ? (
                  <a
                    href={`/desk/email-template/${encodeURIComponent(value)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Edit ${value} in Desk`}
                    className="btn btn-ghost btn-icon"
                  >
                    <Pencil aria-hidden="true" />
                  </a>
                ) : (
                  <span className="w-7 shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <Notice tone="red" title="Couldn't save">{error}</Notice>}

      <div className="flex justify-between gap-2">
        <button type="button" className="btn btn-md" onClick={onBack}>
          Back
        </button>
        {dirty ? (
          <button type="button" className="btn btn-md btn-solid" onClick={save} disabled={saving}>
            {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Save
          </button>
        ) : (
          <button type="button" className="btn btn-md btn-solid" onClick={onNext}>
            Continue
          </button>
        )}
      </div>
    </>
  );
};

export default TemplatesStep;
