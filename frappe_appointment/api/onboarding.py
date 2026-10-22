import frappe


@frappe.whitelist()
def get_onboarding_status():
    """What the /schedule page needs before it can show the setup steps.

    Website users only learn their user type; site setup details are for desk users.
    """
    user_type = frappe.get_cached_value("User", frappe.session.user, "user_type")
    if user_type != "System User":
        return {"user_type": user_type}

    return {"user_type": user_type, "google_ready": is_google_ready(), "zoom_ready": is_zoom_ready()}


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
