"""Read-only status for the admin setup page at /schedule/admin.

Saving goes through the standard REST resource API, like the member setup page.
These endpoints only cover what REST can't: secret presence, the Google redirect
URI, a per-person setup summary, and a Zoom credentials check.
"""

import frappe
import requests
from frappe.utils import get_url

from frappe_appointment.helpers.zoom import base64_encode

GOOGLE_CALLBACK = "frappe.integrations.doctype.google_calendar.google_calendar.google_callback"
ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"


@frappe.whitelist()
def get_admin_setup_status():
    frappe.only_for("System Manager")

    google = frappe.get_single("Google Settings")
    settings = frappe.get_single("Appointment Settings")
    site_url = get_url()

    team, calendars = _get_team()

    return {
        "site_url": site_url,
        "redirect_uri": f"{site_url}?cmd={GOOGLE_CALLBACK}",
        "google": {
            "enable": bool(google.enable),
            "client_id": google.client_id or "",
            "has_client_secret": bool(google.get_password("client_secret", raise_exception=False)),
        },
        "zoom": {
            "enable": bool(settings.enable_zoom),
            "account_id": settings.zoom_account_id or "",
            "client_id": settings.zoom_client_id or "",
            "has_client_secret": bool(settings.get_password("zoom_client_secret", raise_exception=False)),
        },
        "templates": {
            "personal": settings.default_personal_email_template,
            "personal_organisers": settings.personal_organisers_email_template,
            "group": settings.default_group_email_template,
            "availability": settings.default_availability_alerts_email_template,
        },
        "email_templates": frappe.get_all("Email Template", pluck="name", order_by="name asc", limit=500),
        "groups": _get_groups(),
        "team": team,
        "calendars": calendars,
    }


def _get_team():
    """One row per enabled System User with their calendar, hours and booking page state."""
    users = frappe.get_all(
        "User",
        filters={"enabled": 1, "user_type": "System User", "name": ["!=", "Guest"]},
        fields=["name", "full_name"],
        order_by="full_name asc",
    )
    calendars_by_user = {}
    for cal in frappe.get_all(
        "Google Calendar",
        fields=["name", "user", "enable", "custom_is_google_calendar_authorized", "custom_zoom_user_email"],
        order_by="modified desc",
    ):
        calendars_by_user.setdefault(cal.user, []).append(cal)
    availability_by_user = {
        a.user: a
        for a in frappe.get_all(
            "User Appointment Availability",
            fields=["name", "user", "enable_scheduling", "slug"],
        )
    }

    team = []
    connected = []
    for user in users:
        user_calendars = calendars_by_user.get(user.name, [])
        live = [c for c in user_calendars if c.enable and c.custom_is_google_calendar_authorized]
        connected.extend(
            {
                "name": c.name,
                "user": user.name,
                "full_name": user.full_name or user.name,
                "zoom_email": c.custom_zoom_user_email,
            }
            for c in live
        )
        availability = availability_by_user.get(user.name)
        team.append(
            {
                "user": user.name,
                "full_name": user.full_name or user.name,
                "has_calendar": bool(user_calendars),
                "calendar_connected": bool(live),
                "availability": availability.name if availability else None,
                "booking_live": bool(availability and availability.enable_scheduling and availability.slug),
            }
        )
    return team, connected


def _get_groups():
    groups = frappe.get_all(
        "Appointment Group",
        fields=["name", "group_name", "meet_provider", "event_creator"],
        order_by="modified desc",
        limit=100,
    )
    member_counts = {}
    for parent in frappe.get_all(
        "Members",
        filters={"parenttype": "Appointment Group", "parent": ["in", [g.name for g in groups] or [""]]},
        pluck="parent",
    ):
        member_counts[parent] = member_counts.get(parent, 0) + 1
    for group in groups:
        group["members"] = member_counts.get(group.name, 0)
    return groups


@frappe.whitelist(methods=["POST"])
def test_zoom_connection():
    """Ask Zoom for a token with the saved credentials and keep it if it works."""
    frappe.only_for("System Manager")

    settings = frappe.get_single("Appointment Settings")
    secret = settings.get_password("zoom_client_secret", raise_exception=False)
    if not (settings.zoom_account_id and settings.zoom_client_id and secret):
        return {"ok": False, "message": frappe._("Enter the Account ID, Client ID and Client Secret first.")}

    try:
        response = requests.post(
            ZOOM_TOKEN_URL,
            data={"grant_type": "account_credentials", "account_id": settings.zoom_account_id},
            headers={"Authorization": f"Basic {base64_encode(f'{settings.zoom_client_id}:{secret}')}"},
            timeout=15,
        ).json()
    except requests.RequestException, ValueError:
        return {"ok": False, "message": frappe._("Couldn't reach Zoom. Check the server's internet access.")}

    if not response.get("access_token"):
        reason = response.get("reason") or response.get("error") or frappe._("Zoom rejected the credentials.")
        return {"ok": False, "message": reason}

    settings.zoom_access_token = response["access_token"]
    settings.save(ignore_permissions=True)
    return {"ok": True, "message": frappe._("Zoom accepted the credentials.")}
