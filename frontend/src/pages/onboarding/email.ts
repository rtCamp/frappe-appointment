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

const DROP = "script, style, iframe, object, embed, link, meta, base, form";

/** Saved rich text without anything that could run in this page: scripts, event handlers, javascript: links. */
export const cleanHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(DROP).forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const value = attr.value.trim().toLowerCase();
      if (attr.name.startsWith("on") || ((attr.name === "href" || attr.name === "src") && value.startsWith("javascript:"))) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
};
