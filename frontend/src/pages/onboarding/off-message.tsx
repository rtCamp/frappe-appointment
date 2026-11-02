/**
 * The message a switched-off booking page shows guests. Your name, first name and email go in as pills: the saved
 * text keeps them as {name}, {first_name} and {email}, which the server fills in, so guests never see the markers.
 */
import { ClipboardEvent, useEffect, useRef, useState } from "react";
import { CalendarX, Check, LoaderCircle, Plus, RotateCcw } from "lucide-react";

import { DEFAULT_OFF_MESSAGE, cn, fillOffMessage, splitEmails } from "@/lib/utils";
import { SessionUser } from "./api";
import { Button } from "./ui";

const DETAILS = [
  { key: "name", label: "Your name" },
  { key: "first_name", label: "Your first name" },
  { key: "email", label: "Your email" },
] as const;

const LABELS: Record<string, string> = Object.fromEntries(DETAILS.map((d) => [d.key, d.label]));

const PILL_CLASS =
  "inline-flex items-center h-5 px-2 mx-px rounded-full bg-surface-gray-3 text-es-xs text-ink-gray-8 whitespace-nowrap select-none cursor-default align-baseline";

const pill = (key: string) => {
  const span = document.createElement("span");
  span.dataset.detail = key;
  span.contentEditable = "false";
  span.className = PILL_CLASS;
  span.textContent = LABELS[key];
  return span;
};

/** Draws the saved text into the editor, markers as pills and line breaks as <br>. */
const fill = (el: HTMLElement, text: string) => {
  el.textContent = "";
  text.split(/(\{(?:name|first_name|email)\})/).forEach((part) => {
    const key = part.match(/^\{(name|first_name|email)\}$/)?.[1];
    if (key) {
      el.appendChild(pill(key));
      return;
    }
    part.split("\n").forEach((line, i) => {
      if (i) el.appendChild(document.createElement("br"));
      if (line) el.appendChild(document.createTextNode(line));
    });
  });
  // A space after a closing pill gives the caret somewhere to land.
  if (el.lastChild instanceof HTMLElement && el.lastChild.dataset.detail) el.appendChild(document.createTextNode(" "));
};

/** Reads the editor back into text with markers. */
const read = (el: HTMLElement) => {
  let out = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) out += (n.nodeValue ?? "").replace(/\u00a0/g, " ");
      else if (n instanceof HTMLElement) {
        if (n.dataset.detail) out += `{${n.dataset.detail}}`;
        else if (n.tagName === "BR") out += "\n";
        else {
          // Browsers wrap new lines in a <div> or <p> when Enter is pressed.
          if ((n.tagName === "DIV" || n.tagName === "P") && out) out += "\n";
          walk(n);
        }
      }
    });
  };
  walk(el);
  return out.trim();
};

/** An empty message and the default one mean the same thing: guests see the default. */
const effective = (text: string) => text.trim() || DEFAULT_OFF_MESSAGE;

const OffMessage = ({
  user,
  saved,
  busy,
  onSave,
}: {
  user: SessionUser;
  /** The saved message, or "" for the default. */
  saved: string;
  busy: boolean;
  onSave: (message: string) => Promise<boolean>;
}) => {
  const editor = useRef<HTMLDivElement>(null);
  const caret = useRef<Range | null>(null);
  const [draft, setDraft] = useState(effective(saved));
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (editor.current) fill(editor.current, effective(saved));
    setDraft(effective(saved));
    // Only when the saved message changes, so typing is never redrawn under the caret.
  }, [saved]);

  const dirty = effective(draft) !== effective(saved);
  const owner = { name: user.fullName, firstName: user.fullName.split(" ")[0], email: user.name };
  const preview = fillOffMessage(effective(draft), owner);

  const changed = () => {
    if (!editor.current) return;
    setDraft(read(editor.current));
    setJustSaved(false);
  };

  const rememberCaret = () => {
    const selection = window.getSelection();
    if (editor.current && selection?.rangeCount && editor.current.contains(selection.getRangeAt(0).startContainer))
      caret.current = selection.getRangeAt(0).cloneRange();
  };

  const insert = (key: string) => {
    const el = editor.current;
    if (!el) return;
    const selection = window.getSelection();
    const inside = (r: Range | null) => !!r && el.contains(r.startContainer);
    let range = selection?.rangeCount && inside(selection.getRangeAt(0)) ? selection.getRangeAt(0) : inside(caret.current) ? caret.current : null;
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    range.deleteContents();
    const node = pill(key);
    range.insertNode(node);
    // Keep a space on both sides so the pill doesn't run into the words around it.
    const before = node.previousSibling;
    if (before?.nodeType === Node.TEXT_NODE && before.nodeValue && !/[\s(]$/.test(before.nodeValue))
      node.before(document.createTextNode(" "));
    const after = node.nextSibling;
    let landing: Text | null = null;
    if (!after || after.nodeType !== Node.TEXT_NODE || !/^[\s.,!?;:)]/.test(after.nodeValue ?? "")) {
      landing = document.createTextNode(" ");
      node.after(landing);
    }
    el.focus();
    const next = document.createRange();
    if (landing) next.setStart(landing, 1);
    else next.setStartAfter(node);
    next.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(next);
    caret.current = next.cloneRange();
    changed();
  };

  const reset = () => {
    if (editor.current) fill(editor.current, DEFAULT_OFF_MESSAGE);
    setDraft(DEFAULT_OFF_MESSAGE);
    setJustSaved(false);
  };

  const pastePlain = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  };

  const save = async () => {
    // The default is saved as empty, so it follows any later change to the default wording.
    const text = effective(draft) === DEFAULT_OFF_MESSAGE ? "" : draft.trim();
    if (await onSave(text)) setJustSaved(true);
  };

  return (
    <div className="flex flex-col gap-2 pb-4 border-b border-outline-gray-1">
      <div className="flex items-center justify-between gap-2 min-h-7">
        <span id="off-message-label" className="text-es-sm text-ink-gray-6">
          Message while you're off
        </span>
        {effective(draft) !== DEFAULT_OFF_MESSAGE && (
          <Button variant="ghost" onClick={reset} className="-mr-2">
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Reset to default
          </Button>
        )}
      </div>

      <div className="flex flex-col rounded-[10px] border border-outline-gray-2 bg-surface-base overflow-hidden focus-within:border-outline-gray-4">
        <div role="toolbar" aria-label="Insert a detail" className="flex flex-wrap items-center gap-1 p-1 border-b border-outline-gray-1 bg-surface-gray-1">
          <span className="px-1 text-es-sm text-ink-gray-5">Insert:</span>
          {DETAILS.map((d) => (
            <button
              key={d.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(d.key)}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-surface-gray-3 text-es-sm text-ink-gray-8 cursor-pointer hover:bg-surface-gray-4 focus-visible:outline-none focus-visible:shadow-es-focus"
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
              {d.label}
            </button>
          ))}
        </div>
        <div
          ref={editor}
          role="textbox"
          aria-multiline="true"
          aria-labelledby="off-message-label"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={changed}
          onBlur={rememberCaret}
          onKeyUp={rememberCaret}
          onMouseUp={rememberCaret}
          onPaste={pastePlain}
          className="min-h-[66px] px-3 py-2.5 text-es-base text-ink-gray-8 leading-7 whitespace-pre-wrap break-words outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        <span className="text-es-sm text-ink-gray-6">What guests see</span>
        <div className="flex flex-col items-center gap-2 px-5 pt-5 pb-[22px] rounded-xl border border-outline-gray-1 bg-surface-base text-center">
          <CalendarX className="w-6 h-6 text-ink-gray-5" aria-hidden="true" />
          <span className="text-[18px] leading-[26px] font-semibold text-ink-gray-9">Not taking bookings right now</span>
          <p className="m-0 max-w-[380px] text-es-p-sm text-ink-gray-6 whitespace-pre-line break-words">
            {splitEmails(preview).map((part, i) =>
              part.email ? (
                <a key={i} href={`mailto:${part.text}`} className="text-ink-blue-link underline">
                  {part.text}
                </a>
              ) : (
                part.text
              )
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-1">
        {dirty && <span className="text-es-sm text-ink-gray-5">Unsaved changes</span>}
        {!dirty && justSaved && (
          <span role="status" className="inline-flex items-center gap-1 text-es-sm text-ink-gray-5">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            Saved
          </span>
        )}
        <Button variant={dirty ? "solid" : "subtle"} onClick={save} disabled={!dirty || busy} className={cn(!dirty && "cursor-not-allowed")}>
          {busy && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Save
        </Button>
      </div>
    </div>
  );
};

export default OffMessage;
