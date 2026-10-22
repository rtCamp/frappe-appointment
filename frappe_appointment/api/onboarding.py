from urllib.parse import urlparse

import frappe
from frappe.integrations.doctype.google_calendar.google_calendar import google_callback
from frappe.utils import get_request_site_address


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
    }


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
