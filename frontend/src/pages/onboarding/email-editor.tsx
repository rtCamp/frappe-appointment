/**
 * The confirmation email: name, when it's sent, subject and message, with a preview filled in with a
 * sample booking by the server (the same Jinja rendering the real email gets). People who can't edit
 * Email Templates get the preview only.
 */
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bold, CalendarDays, ChevronDown, Italic, Link, List, LoaderCircle, Plus, X } from "lucide-react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { cn } from "@/lib/utils";
import { EMAIL_TEMPLATE, EmailTemplate, PREVIEW_EMAIL, SessionUser, errorText, fromSiteTime } from "./api";
import { EMAIL_VARIABLES, SEND_TIMES, cleanHtml, sendTimeLabel } from "./email";
import { Button, Notice, Switch } from "./ui";

interface Preview {
  subject?: string;
  message?: string;
  starts_on?: string;
  guest?: string;
  error?: string;
}

const fieldClass =
  "h-7 px-2 rounded-lg border border-transparent bg-surface-gray-2 text-es-base text-ink-gray-8 placeholder:text-ink-gray-4 hover:bg-surface-gray-3 focus:outline-none focus:bg-surface-base focus:border-outline-gray-4 focus:shadow-es-focus disabled:cursor-default disabled:hover:bg-surface-gray-2";

const toolClass =
  "grid place-items-center w-7 h-7 rounded-md border-0 bg-transparent text-ink-gray-7 cursor-pointer hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:shadow-es-focus";

/** An email's HTML as a page of its own: the iframe is sandboxed, so nothing in it can run. */
const emailDocument = (html: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:16px;font:14px/1.5 system-ui,sans-serif;color:#1f2328;background:#fff}p{margin:0 0 .5em}a{color:#0969da}</style></head><body>${html}</body></html>`;

const EmailEditor = ({
  user,
  name: savedName,
  onSaved,
  onClose,
}: {
  user: SessionUser;
  /** The template to open, or null for a new one. */
  name: string | null;
  onSaved: (name: string) => Promise<void>;
  onClose: () => void;
}) => {
  const { call, db } = useContext(FrappeContext) as FrappeConfig;
  const isNew = savedName === null;
  const canEdit = isNew ? user.canCreate.includes(EMAIL_TEMPLATE) : user.canWrite.includes(EMAIL_TEMPLATE);

  const [loaded, setLoaded] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState(savedName ?? "");
  const [subject, setSubject] = useState("");
  const [sendAt, setSendAt] = useState(0);
  const [useHtml, setUseHtml] = useState(false);
  const [richText, setRichText] = useState("");
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // Where an inserted tag goes: the last field the cursor was in, and where in the message it was.
  const target = useRef<"subject" | "message">("message");
  const range = useRef<Range | null>(null);

  useEffect(() => {
    if (isNew) {
      setLoaded({ name: "", subject: "", response: "", use_html: 0, response_html: "", custom_time_to_send_email: 0 });
      return;
    }
    db.getDoc<EmailTemplate>(EMAIL_TEMPLATE, savedName)
      .then((t) => {
        setLoaded(t);
        setSubject(t.subject ?? "");
        setSendAt(t.custom_time_to_send_email || 0);
        setUseHtml(!!t.use_html);
        setRichText(cleanHtml(t.response ?? ""));
        setHtml(t.response_html ?? "");
      })
      .catch((err) => setError(errorText(err)));
  }, [db, isNew, savedName]);

  // The rich text editor isn't controlled: fill it once, then read it back on input.
  useEffect(() => {
    if (loaded && bodyRef.current && !useHtml) bodyRef.current.innerHTML = richText;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, useHtml]);

  useEffect(() => {
    if (loaded) (isNew ? nameRef : subjectRef).current?.focus();
  }, [loaded, isNew]);

  // Escape closes the editor and leaves Settings open underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const message = useHtml ? html : richText;

  // The preview follows the draft for editors; everyone else sees the saved template.
  useEffect(() => {
    if (!loaded) return;
    let stale = false;
    const id = window.setTimeout(
      async () => {
        try {
          const result = canEdit
            ? await call.post(PREVIEW_EMAIL, { subject, message })
            : await call.get(PREVIEW_EMAIL, { template: savedName });
          if (!stale) setPreview(result.message);
        } catch (err) {
          if (!stale) setPreview({ error: errorText(err) });
        }
      },
      canEdit ? 400 : 0
    );
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
  }, [loaded, canEdit, call, savedName, subject, message]);

  const rememberRange = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && bodyRef.current?.contains(selection.anchorNode)) range.current = selection.getRangeAt(0);
  };

  const format = (command: string, value?: string) => {
    bodyRef.current?.focus();
    if (range.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range.current);
    }
    document.execCommand(command, false, value);
    setRichText(bodyRef.current?.innerHTML ?? "");
  };

  const addLink = () => {
    const url = window.prompt("Link address", "https://");
    if (url && /^(https?:|mailto:)/i.test(url.trim())) format("createLink", url.trim());
  };

  /** Puts a tag at the cursor in the subject or the message (or at the end if there's no cursor yet). */
  const insert = (code: string) => {
    if (target.current === "subject") {
      const input = subjectRef.current;
      const at = input?.selectionStart ?? subject.length;
      const end = input?.selectionEnd ?? at;
      setSubject(subject.slice(0, at) + code + subject.slice(end));
      return;
    }
    if (useHtml) {
      const area = htmlRef.current;
      const at = area?.selectionStart ?? html.length;
      const end = area?.selectionEnd ?? at;
      setHtml(html.slice(0, at) + code + html.slice(end));
      return;
    }
    if (!range.current && bodyRef.current) {
      const end = document.createRange();
      end.selectNodeContents(bodyRef.current);
      end.collapse(false);
      range.current = end;
    }
    format("insertText", code);
    rememberRange();
  };

  const nameOk = !!name.trim();
  const subjectOk = !!subject.trim();

  const save = async () => {
    setTried(true);
    if (!nameOk || !subjectOk) return;
    setError(null);
    setSaving(true);
    const values = {
      subject: subject.trim(),
      use_html: useHtml ? 1 : 0,
      response: richText,
      response_html: html,
      custom_time_to_send_email: sendAt,
    };
    try {
      let saved = name.trim();
      if (isNew) {
        await db.createDoc(EMAIL_TEMPLATE, { name: saved, ...values });
      } else {
        // Renaming also updates every booking page that uses this email.
        if (saved !== savedName) {
          saved = (await call.post("frappe.client.rename_doc", { doctype: EMAIL_TEMPLATE, old_name: savedName, new_name: saved }))
            .message;
        }
        await db.updateDoc(EMAIL_TEMPLATE, saved, values);
      }
      await onSaved(saved);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.exc_type === "DuplicateEntryError" ? "There's already an email with this name." : errorText(err));
      setSaving(false);
    }
  };

  const startsOn = preview?.starts_on
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: user.timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(fromSiteTime(preview.starts_on, user.siteTimeZone))
    : "";

  return createPortal(
    <div className="espresso font-espresso fixed inset-0 z-50 flex items-center justify-center p-6 max-sm:p-0 bg-black/30 text-ink-gray-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-title"
        className="w-[1080px] max-w-full h-[740px] max-sm:h-full max-h-full flex flex-col overflow-hidden rounded-2xl max-sm:rounded-none bg-surface-elevation-1 shadow-es-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-outline-gray-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-es-base text-ink-gray-5">Emails /</span>
            <h2 id="email-title" className="m-0 text-es-lg font-semibold text-ink-gray-9 truncate">
              {isNew ? name.trim() || "New email" : savedName}
            </h2>
          </div>
          <Button variant="ghost" className="w-7 px-0" aria-label="Close email" onClick={onClose}>
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 flex flex-wrap overflow-y-auto">
          {!loaded ? (
            <div className="flex-1 grid place-items-center p-10">
              {!error && <LoaderCircle className="w-5 h-5 animate-spin text-ink-gray-5" aria-label="Loading the email" />}
            </div>
          ) : (
            <>
              <div className="flex-[1_1_460px] min-w-0 p-5 flex flex-col gap-4 border-r border-outline-gray-1 box-border">
                {!canEdit && (
                  <Notice tone="blue" title="Only admins can change emails">
                    You can pick any email for your booking page. To change one, ask someone who can edit Email Templates.
                  </Notice>
                )}
                <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label htmlFor="email-name" className="text-es-sm text-ink-gray-6">
                      Name
                    </label>
                    <input
                      ref={nameRef}
                      id="email-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!canEdit}
                      aria-invalid={tried && !nameOk}
                      placeholder="Quick chat confirmation"
                      className={cn(fieldClass, tried && !nameOk && "border-ink-red-7")}
                    />
                    {tried && !nameOk && <span className="text-es-p-sm text-ink-red-7">Give the email a name.</span>}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label htmlFor="email-send" className="text-es-sm text-ink-gray-6">
                      Send
                    </label>
                    <span className="relative">
                      <select
                        id="email-send"
                        value={sendAt}
                        disabled={!canEdit}
                        onChange={(e) => setSendAt(Number(e.target.value))}
                        className={cn(fieldClass, "w-full pr-7 appearance-none cursor-pointer")}
                      >
                        {SEND_TIMES.map((h) => (
                          <option key={h} value={h}>
                            {sendTimeLabel(h)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1.5 w-4 h-4 text-ink-gray-4 pointer-events-none" aria-hidden="true" />
                    </span>
                    {sendAt > 0 && (
                      <span className="text-es-p-sm text-ink-gray-5">
                        The next time it's {sendTimeLabel(sendAt).slice(3)} in the site's time zone ({user.siteTimeZone}).
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email-subject" className="text-es-sm text-ink-gray-6">
                    Subject
                  </label>
                  <input
                    ref={subjectRef}
                    id="email-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    onFocus={() => (target.current = "subject")}
                    disabled={!canEdit}
                    aria-invalid={tried && !subjectOk}
                    className={cn(fieldClass, tried && !subjectOk && "border-ink-red-7")}
                  />
                  {tried && !subjectOk && <span className="text-es-p-sm text-ink-red-7">Add a subject.</span>}
                </div>

                <div className="flex flex-col gap-1.5 flex-1 min-h-[300px]">
                  <div className="flex items-center justify-between gap-2">
                    <span id="email-message-label" className="text-es-sm text-ink-gray-6">
                      Message
                    </span>
                    {canEdit && (
                      <label className="inline-flex items-center gap-2 text-es-sm text-ink-gray-6 cursor-pointer">
                        Write HTML
                        <Switch checked={useHtml} onChange={setUseHtml} label="Write HTML" />
                      </label>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col rounded-[10px] border border-outline-gray-2 overflow-hidden">
                    {canEdit && (
                      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 p-1 border-b border-outline-gray-1 bg-surface-gray-1">
                        {!useHtml && (
                          <>
                            <button type="button" aria-label="Bold" className={toolClass} onMouseDown={(e) => e.preventDefault()} onClick={() => format("bold")}>
                              <Bold className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden="true" />
                            </button>
                            <button type="button" aria-label="Italic" className={toolClass} onMouseDown={(e) => e.preventDefault()} onClick={() => format("italic")}>
                              <Italic className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button type="button" aria-label="Link" className={toolClass} onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
                              <Link className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label="Bulleted list"
                              className={toolClass}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => format("insertUnorderedList")}
                            >
                              <List className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <span aria-hidden="true" className="w-px h-4 mx-1 bg-outline-gray-2" />
                          </>
                        )}
                        <span className="px-1 text-es-sm text-ink-gray-5">Insert:</span>
                        {EMAIL_VARIABLES.map((v) => (
                          <button
                            key={v.code}
                            type="button"
                            title={v.hint ? `${v.code} (${v.hint})` : v.code}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insert(v.code)}
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-full border-0 bg-surface-gray-3 text-es-sm text-ink-gray-8 whitespace-nowrap cursor-pointer hover:bg-surface-gray-4 focus-visible:outline-none focus-visible:shadow-es-focus"
                          >
                            <Plus className="w-3 h-3" aria-hidden="true" />
                            {v.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {useHtml ? (
                      <textarea
                        ref={htmlRef}
                        aria-labelledby="email-message-label"
                        value={html}
                        onChange={(e) => setHtml(e.target.value)}
                        onFocus={() => (target.current = "message")}
                        readOnly={!canEdit}
                        spellCheck={false}
                        className="flex-1 min-h-[220px] resize-none p-3 border-0 outline-none bg-surface-base font-mono text-[13px] leading-relaxed text-ink-gray-8"
                      />
                    ) : (
                      <div
                        ref={bodyRef}
                        role="textbox"
                        aria-multiline="true"
                        aria-labelledby="email-message-label"
                        contentEditable={canEdit}
                        suppressContentEditableWarning
                        onInput={() => setRichText(bodyRef.current?.innerHTML ?? "")}
                        onFocus={() => (target.current = "message")}
                        onKeyUp={rememberRange}
                        onMouseUp={rememberRange}
                        className="flex-1 min-h-[220px] overflow-y-auto px-3.5 py-3 bg-surface-base text-es-p-base text-ink-gray-8 outline-none [&_p]:m-0 [&_ul]:pl-5 [&_ul]:list-disc [&_a]:text-ink-blue-link [&_a]:underline"
                      />
                    )}
                  </div>
                  <span className="text-es-p-sm text-ink-gray-5">
                    Details in double braces, like {"{{ meet_link }}"}, are filled in for each booking. Hover invite.ics in the
                    preview to see what's attached.
                  </span>
                </div>
              </div>

              <div className="flex-[1_1_400px] min-w-0 p-5 flex flex-col gap-3 bg-surface-gray-1 box-border">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-es-base font-medium text-ink-gray-8">Preview</span>
                  <span className="text-es-sm text-ink-gray-5">With a sample booking</span>
                </div>
                {preview?.error ? (
                  <Notice tone="red" title="This email has a mistake">
                    {preview.error}
                  </Notice>
                ) : (
                  <div className="flex-1 min-h-[320px] flex flex-col rounded-xl border border-outline-gray-1 bg-surface-base shadow-es-sm overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-4 py-3.5 border-b border-outline-gray-1 text-es-sm">
                      <span className="text-ink-gray-5">To</span>
                      <span className="text-ink-gray-8">{preview?.guest ?? "…"}</span>
                      <span className="text-ink-gray-5">Subject</span>
                      <span className="font-medium text-ink-gray-9 break-words" data-testid="preview-subject">
                        {preview ? preview.subject : <LoaderCircle className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                      </span>
                    </div>
                    <iframe
                      title="Email preview"
                      sandbox=""
                      srcDoc={emailDocument(preview?.message ?? "")}
                      className="flex-1 w-full min-h-[200px] border-0 bg-white"
                    />
                    <div className="px-4 py-3">
                      <span className="group relative inline-flex">
                        <span
                          tabIndex={0}
                          aria-describedby="ics-tip"
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-outline-gray-2 text-es-sm text-ink-gray-7 cursor-help focus-visible:outline-none focus-visible:shadow-es-focus"
                        >
                          <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                          invite.ics
                        </span>
                        <span
                          id="ics-tip"
                          role="tooltip"
                          className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 bottom-full mb-2 z-10 w-[280px] px-2.5 py-2 rounded-lg bg-surface-gray-10 text-ink-base text-es-p-sm shadow-es-lg"
                        >
                          A calendar invite attached to the real email, so the guest can add the meeting to Google, Outlook or
                          Apple Calendar. Confirmation emails only go out when bookings have a video link: with "No video
                          link", nothing is sent.
                        </span>
                      </span>
                    </div>
                  </div>
                )}
                {startsOn && (
                  <span className="text-es-p-sm text-ink-gray-5">
                    Sample: {preview?.guest} booked a 15 min meeting for {startsOn}.
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="px-5 pt-3">
            <Notice tone="red" title="Couldn't save this email">
              {error}
            </Notice>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-outline-gray-1">
          {canEdit ? (
            <>
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="solid" onClick={save} disabled={saving || !loaded}>
                {saving && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Save
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EmailEditor;
