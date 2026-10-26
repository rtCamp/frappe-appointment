from urllib.parse import urlparse

import frappe
from frappe.integrations.doctype.google_calendar.google_calendar import google_callback
from frappe.utils import get_request_site_address

from frappe_appointment.helpers.google_calendar import calendar_is_connected


@frappe.whitelist()
def get_onboarding_status():
    """What the /schedule page needs before it can show the setup steps.

    Website users only learn their user type; site setup details are for desk users.
    """
    user_type = frappe.get_cached_value("User", frappe.session.user, "user_type")
    if user_type != "System User":
        return {"user_type": user_type}

    return {
        "user_type": user_type,
        "is_admin": "System Manager" in frappe.get_roles(),
        "google_ready": is_google_ready(),
        "zoom_ready": is_zoom_ready(),
        "blocks_time_off": blocks_time_off(frappe.session.user),
    }


@frappe.whitelist()
def is_calendar_connected(calendar: str) -> bool:
    """Whether Google still accepts the calendar's sign-in. Its fields can say it's connected after Google
    stopped accepting it, for example when the sign-in expired or was revoked. For the calendar's own user,
    or anyone who can read it."""
    if frappe.db.get_value("Google Calendar", calendar, "user") != frappe.session.user:
        frappe.has_permission("Google Calendar", "read", doc=calendar, throw=True)
    return calendar_is_connected(calendar)


@frappe.whitelist()
def get_google_setup():
    """What the admin guide fills in for Google Cloud, and what Google Settings already has.

    The redirect URI is built exactly as authorize_access builds it, so it matches what Google
    receives (the site's host_name, which can differ from the address in the browser).
    """
    frappe.only_for("System Manager")
    redirect_uri = (
        f"{get_request_site_address(full_address=True)}?cmd={google_callback.__module__}.{google_callback.__qualname__}"
    )
    site = urlparse(get_request_site_address())
    settings = frappe.get_cached_doc("Google Settings")
    return {
        "origin": f"{site.scheme}://{site.netloc}",
        "domain": site.hostname,
        "redirect_uri": redirect_uri,
        "enabled": bool(settings.enable),
        "client_id": settings.client_id or "",
        "has_client_secret": bool(settings.get_password("client_secret", raise_exception=False)),
    }


def is_google_ready() -> bool:
    """Google Settings is turned on and has a client ID and secret, so calendars can connect."""
    settings = frappe.get_cached_doc("Google Settings")
    return bool(
        settings.enable and settings.client_id and settings.get_password("client_secret", raise_exception=False)
    )


def is_zoom_ready() -> bool:
    """Zoom is turned on in Appointment Settings with all three app credentials, so Zoom can be offered."""
    settings = frappe.get_cached_doc("Appointment Settings")
    return bool(
        settings.enable_zoom
        and settings.zoom_account_id
        and settings.zoom_client_id
        and settings.get_password("zoom_client_secret", raise_exception=False)
    )


def blocks_time_off(user: str) -> bool:
    """Approved leave and holidays block the user's booking days.

    Same conditions as is_member_on_leave_or_is_holiday: ERPNext and HRMS installed, and an
    Employee whose company email is the user's.
    """
    installed_apps = frappe.get_installed_apps()
    if "erpnext" not in installed_apps or "hrms" not in installed_apps:
        return False
    return bool(frappe.db.exists("Employee", {"company_email": user}))


SAMPLE_GUEST = "Ananya Sharma"
SAMPLE_MEET_LINK = "https://meet.google.com/abc-defg-hij"


class TemplateRenderError(Exception):
    pass


@frappe.whitelist()
def preview_confirmation_email(template: str | None = None, subject: str | None = None, message: str | None = None):
    """A confirmation email as a guest would get it, filled in with a sample booking.

    A saved template needs read access to it. An unsaved draft (subject and message) needs write
    access to Email Template, like saving one would. It's rendered as send_email_template_mail does:
    Frappe's sandboxed Jinja, with the same context keys.
    """
    if subject is None and message is None:
        frappe.has_permission("Email Template", "read", doc=template, throw=True)
        doc = frappe.get_doc("Email Template", template)
        subject, message = doc.subject, doc.response_html if doc.use_html else doc.response
    else:
        frappe.has_permission("Email Template", "write", throw=True)

    context = sample_email_context(frappe.session.user)
    try:
        return {
            "subject": render_for_preview(subject, context),
            "message": render_for_preview(message, context),
            "starts_on": str(context["event"].starts_on),
            "guest": SAMPLE_GUEST,
        }
    except TemplateRenderError as e:
        return {"error": str(e)}


def render_for_preview(text: str | None, context: dict) -> str:
    """Render one part of the email, turning template mistakes into a short message."""
    from jinja2 import TemplateSyntaxError

    try:
        frappe.get_jenv().parse(text or "")
    except TemplateSyntaxError as e:
        raise TemplateRenderError(f"Line {e.lineno}: {e.message}") from e
    try:
        # Saved templates or drafts from people who can write Email Templates, rendered in Frappe's sandbox.
        return frappe.render_template(text or "", context)  # nosemgrep
    except Exception as e:
        frappe.clear_messages()
        raise TemplateRenderError(f"Couldn't fill in the template ({type(e).__name__}).") from e


def sample_email_context(user: str) -> dict:
    """The arguments send_meet_email passes to a confirmation email, for a made-up booking tomorrow at 11:00."""
    availability = frappe.get_all("User Appointment Availability", filters={"user": user}, fields=["*"], limit=1)
    availability = availability[0] if availability else frappe._dict()
    slug = availability.get("slug") or "your-link"
    host = frappe.utils.get_fullname(user)

    starts_on = frappe.utils.add_days(frappe.utils.now_datetime(), 1).replace(
        hour=11, minute=0, second=0, microsecond=0
    )
    event = frappe._dict(
        subject=f"Meet: {SAMPLE_GUEST} <> {host} (15 min)",
        starts_on=starts_on,
        ends_on=frappe.utils.add_to_date(starts_on, minutes=15),
        custom_meet_link=SAMPLE_MEET_LINK,
        reschedule_url=frappe.utils.get_url(f"/schedule/in/{slug}?reschedule=1&event_token=sample"),
    )
    return {
        "appointment_group": {**availability, "meet_link": SAMPLE_MEET_LINK},
        "meet_link": SAMPLE_MEET_LINK,
        "event": event,
        "metadata": {"subject": event.subject, "personal": True, "user_slug": slug},
    }
