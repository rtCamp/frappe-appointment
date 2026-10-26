/**
 * Confirmation email helpers: the booking details a template can use, when it's sent, and cleaning
 * saved HTML before it goes into the editor.
 */

/** What send_meet_email passes to the template, as insertable tags. */
export const EMAIL_VARIABLES = [
  { label: "Meeting title", code: "{{ event.subject }}", hint: "Includes the guest's name" },
  { label: "Start time", code: '{{ frappe.utils.get_datetime(event.starts_on).strftime("%A, %d %B %Y, %I:%M %p") }}', hint: "" },
  { label: "Video link", code: "{{ meet_link }}", hint: "" },
  { label: "Reschedule link", code: "{{ event.reschedule_url }}", hint: "Empty when rescheduling is off" },
];

/** custom_time_to_send_email: 0 sends right after booking, 1-24 at that hour (24 is midnight). */
export const SEND_TIMES = [0, ...Array.from({ length: 24 }, (_, i) => i + 1)];

export const sendTimeLabel = (hour: number) =>
  hour ? `At ${String(hour % 24).padStart(2, "0")}:00` : "Right after booking";

const DROP = "script, style, iframe, object, embed, link, meta, base, form, svg, math, template, noscript";

/** Attributes that hold a URL the browser may load or follow. */
const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction", "background", "poster", "cite", "data"]);

/**
 * Links that can't run anything: web, mail and phone links, links with no scheme (relative ones, and template tags like
 * {{ meet_link }}), and pictures written into the page. Browsers ignore control characters and spaces inside a scheme
 * ("java\tscript:"), so those are dropped before looking.
 */
const isSafeUrl = (attribute: string, value: string) => {
  // eslint-disable-next-line no-control-regex
  const url = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, "").toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(url)?.[1];
  if (!scheme) return true;
  if (["http", "https", "mailto", "tel"].includes(scheme)) return true;
  return attribute === "src" && /^data:image\/(png|jpe?g|gif|webp);/.test(url);
};

/** Saved rich text without anything that could run in this page: scripts, event handlers, unsafe links. */
export const cleanHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(DROP).forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcset" || (URL_ATTRIBUTES.has(name) && !isSafeUrl(name, attr.value))) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
};
