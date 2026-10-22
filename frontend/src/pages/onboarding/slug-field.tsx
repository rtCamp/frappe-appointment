/**
 * The booking link input (the part after /schedule/in/), with whether it's available.
 */
import { ReactNode } from "react";
import { Check } from "lucide-react";

import { SlugCheck } from "./use-slug-check";

const SlugField = ({
  id,
  value,
  onChange,
  check,
  action,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  check: SlugCheck;
  /** Shown next to the input, like Settings' Save button. */
  action?: ReactNode;
}) => (
  <>
    <div className="flex w-full gap-2">
      <div className="flex flex-1 min-w-0">
        <span className="inline-flex items-center h-7 px-2 rounded-l-lg border border-r-0 border-outline-gray-2 bg-surface-gray-1 text-es-base text-ink-gray-5 whitespace-nowrap max-sm:hidden">
          {window.location.host}/schedule/in/
        </span>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={check.state === "taken" || check.state === "invalid"}
          aria-describedby={`${id}-status`}
          className="flex-1 min-w-0 h-7 px-2 rounded-r-lg max-sm:rounded-l-lg border border-outline-gray-2 bg-surface-base text-es-base text-ink-gray-8 focus:outline-none focus:border-outline-gray-4 focus:shadow-es-focus"
        />
      </div>
      {action}
    </div>
    <span id={`${id}-status`} aria-live="polite" className="min-h-5 text-es-p-sm">
      {(check.state === "available" || check.state === "same") && (
        <span className="inline-flex items-center gap-1.5 text-ink-green-7">
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
          This link is available
        </span>
      )}
      {check.state === "checking" && <span className="text-ink-gray-5">Checking…</span>}
      {check.state === "taken" && (
        <span className="text-ink-red-7">
          Someone already has this link.
          {check.suggestion && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => onChange(check.suggestion!)}
                className="p-0 border-0 bg-transparent text-ink-blue-link underline cursor-pointer"
              >
                Use {check.suggestion}
              </button>
            </>
          )}
        </span>
      )}
      {check.state === "invalid" && (
        <span className="text-ink-red-7">Use lowercase letters, numbers and single hyphens, without a hyphen at either end.</span>
      )}
      {check.state === "empty" && <span className="text-ink-red-7">Choose a link.</span>}
    </span>
  </>
);

export default SlugField;
