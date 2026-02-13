import frappe


@frappe.whitelist()  # nosemgrep
def check_google_calendar_setup(user):
    user_appointment_availability = None
    try:
        user_appointment_availability = frappe.get_doc("User Appointment Availability", {"user": user}).name
    except frappe.exceptions.DoesNotExistError:
        frappe.clear_last_message()

    is_google_calendar_setup = False
    google_calendars = frappe.get_all(
        "Google Calendar",
        filters={"user": user},
        fields=["name", "enable", "custom_is_google_calendar_authorized"],
    )

    if len(google_calendars) > 0:
        is_google_calendar_setup = True

    google_calendar_id = None
    if len(google_calendars) == 1:
        google_calendar_id = google_calendars[0].name

    is_google_calendar_enabled = True
    if not any([g_calendar.enable for g_calendar in google_calendars]):
        is_google_calendar_enabled = False
    is_google_calendar_authorized = True
    if not any([g_calendar.custom_is_google_calendar_authorized for g_calendar in google_calendars]):
        is_google_calendar_authorized = False

    return {
        "is_google_calendar_setup": is_google_calendar_setup,
        "is_google_calendar_enabled": is_google_calendar_enabled,
        "is_google_calendar_authorized": is_google_calendar_authorized,
        "google_calendar_id": google_calendar_id,
        "user_appointment_availability": user_appointment_availability,
    }
