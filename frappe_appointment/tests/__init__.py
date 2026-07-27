"""Tests setup and helpers for frappe_appointment."""

import contextlib
from unittest.mock import MagicMock, patch

import frappe
from frappe.utils.password import remove_encrypted_password, set_encrypted_password

TEST_USER = "test_fa_user1@example.com"
TEST_USER_2 = "test_fa_user2@example.com"
TEST_ORGANIZER = "test_fa_organizer@example.com"

TEST_SLUG = "fa-user1"
TEST_GROUP = "FA Group Alpha"

# get_google_calendar_object is imported by name into each of these modules, so a
# patch must target the module that owns the function under test.
EVENT_OVERRIDE = "frappe_appointment.overrides.event_override"
TIME_SLOT_MODULE = "frappe_appointment.frappe_appointment.doctype.appointment_time_slot.appointment_time_slot"
GCAL_HELPER = "frappe_appointment.helpers.google_calendar"
OUT_OF_OFFICE = "frappe_appointment.helpers.out_of_office"

WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
ALL_DAY_SLOT = ("09:00:00", "17:00:00")


@contextlib.contextmanager
def mute_enqueue():
    """No-op frappe.enqueue for the block.

    This dev site has extra apps (e.g. next_pms) whose Project/Task hooks enqueue a job with an unpicklable local callback; CI runs on a clean site without them. Muting keeps fixture creation reliable locally and does not affect the code under test.
    """
    with patch("frappe.enqueue"):
        yield


@contextlib.contextmanager
def as_user(email):
    """Temporarily switch frappe.session.user for the duration of the block."""
    original = frappe.session.user
    frappe.set_user(email)
    try:
        yield
    finally:
        frappe.set_user(original)


def set_password_field(doctype, name, fieldname, value):
    """Set or clear a Password field in both the encrypted store and the column."""
    if value:
        set_encrypted_password(doctype, name, value, fieldname)
    else:
        remove_encrypted_password(doctype, name, fieldname)
    frappe.db.set_value(doctype, name, fieldname, value or "", update_modified=False)


def make_test_user(email, first_name=None):
    """Create a System User with no welcome email."""
    if not frappe.db.exists("User", email):
        frappe.get_doc(
            {
                "doctype": "User",
                "email": email,
                "first_name": first_name or email.split("@")[0],
                "send_welcome_email": 0,
                "user_type": "System User",
            }
        ).insert(ignore_permissions=True)
    return frappe.get_doc("User", email)


def make_google_calendar(
    user=TEST_USER,
    calendar_name=None,
    authorized=True,
    push_to_google_calendar=1,
    zoom_user_email=None,
):
    """Insert or return a Google Calendar for a user.

    Core validate needs live Google Settings, so it is skipped; the app's
    GoogleCalendarOverride.before_save still sets google_calendar_id and the
    authorization flag from refresh_token.
    """
    make_test_user(user)
    calendar_name = calendar_name or f"GCal {user}"
    if not frappe.db.exists("Google Calendar", calendar_name):
        doc = frappe.get_doc(
            {
                "doctype": "Google Calendar",
                "calendar_name": calendar_name,
                "user": user,
                "google_calendar_id": user,
                "enable": 1,
                "refresh_token": "test-refresh-token" if authorized else "",
                "push_to_google_calendar": push_to_google_calendar,
                "custom_zoom_user_email": zoom_user_email,
            }
        )
        doc.flags.ignore_validate = True
        doc.insert(ignore_permissions=True)
    frappe.db.set_value(
        "Google Calendar",
        calendar_name,
        {
            "custom_is_google_calendar_authorized": 1 if authorized else 0,
            "push_to_google_calendar": push_to_google_calendar,
            "custom_zoom_user_email": zoom_user_email,
        },
        update_modified=False,
    )
    return frappe.get_doc("Google Calendar", calendar_name)


def make_user_availability(
    user=TEST_USER,
    slug=TEST_SLUG,
    enable_scheduling=1,
    meeting_provider="Google Meet",
    meeting_link=None,
    days=None,
    durations=None,
    google_calendar=None,
):
    """Insert or return a User Appointment Availability (name == user).

    ``days`` is a list of (weekday, start, end); defaults to Mon-Fri 09:00-17:00.
    ``durations`` is a list of dicts appended to the available_durations table.
    """
    make_test_user(user)
    gcal = google_calendar or make_google_calendar(user).name
    if frappe.db.exists("User Appointment Availability", user):
        return frappe.get_doc("User Appointment Availability", user)

    if days is None:
        days = [(d, *ALL_DAY_SLOT) for d in WEEK[:5]]

    doc = frappe.get_doc(
        {
            "doctype": "User Appointment Availability",
            "user": user,
            "google_calendar": gcal,
            "slug": slug,
            "enable_scheduling": enable_scheduling,
            "meeting_provider": meeting_provider,
            "meeting_link": meeting_link,
        }
    )
    for day, start, end in days:
        doc.append("appointment_time_slot", {"day": day, "start_time": start, "end_time": end})
    for duration in durations or []:
        doc.append("available_durations", duration)
    doc.insert(ignore_permissions=True)
    return doc


def make_slot_duration(
    title="30 Minutes",
    duration=1800,
    minimum_notice_before_event=0,
    availability_window=0,
    minimum_buffer_time=0,
    limit_booking_frequency=-1,
    allow_rescheduling=0,
    minimum_notice_for_reschedule=0,
):
    """Return an available_durations child-row dict for make_user_availability."""
    return {
        "title": title,
        "duration": duration,
        "minimum_notice_before_event": minimum_notice_before_event,
        "availability_window": availability_window,
        "minimum_buffer_time": minimum_buffer_time,
        "limit_booking_frequency": limit_booking_frequency,
        "allow_rescheduling": allow_rescheduling,
        "minimum_notice_for_reschedule": minimum_notice_for_reschedule,
    }


def make_appointment_group(
    group_name=TEST_GROUP,
    event_creator=None,
    members=None,
    event_organizer=TEST_ORGANIZER,
    duration_for_event=1800,
    minimum_notice_before_event=0,
    event_availability_window=0,
    minimum_buffer_time=0,
    limit_booking_frequency=-1,
    meet_provider="",
    **fields,
):
    """Insert or return an Appointment Group (autoname scrubs group_name).

    ``members`` is a list of User Appointment Availability names; each is added
    as a mandatory member. Defaults to a single availability for TEST_USER.
    """
    name = frappe.scrub(group_name).replace("_", "-")
    if frappe.db.exists("Appointment Group", name):
        return frappe.get_doc("Appointment Group", name)

    if event_creator is None:
        event_creator = make_google_calendar(TEST_USER).name
    if members is None:
        members = [make_user_availability(TEST_USER).name]
    make_test_user(event_organizer)

    doc = frappe.get_doc(
        {
            "doctype": "Appointment Group",
            "group_name": group_name,
            "event_creator": event_creator,
            "event_organizer": event_organizer,
            "duration_for_event": duration_for_event,
            "minimum_notice_before_event": minimum_notice_before_event,
            "event_availability_window": event_availability_window,
            "minimum_buffer_time": minimum_buffer_time,
            "limit_booking_frequency": limit_booking_frequency,
            "meet_provider": meet_provider,
            **fields,
        }
    )
    for member in members:
        doc.append("members", {"user": member, "is_mandatory": 1})
    doc.insert(ignore_permissions=True)
    return doc


def setup_appointment_settings(
    enable_zoom=0,
    zoom_client_id="",
    zoom_client_secret="",
    zoom_account_id="",
    zoom_access_token="",
    personal_organisers_email_template=None,
):
    """Configure the Appointment Settings single doctype and its password fields."""
    settings = frappe.get_single("Appointment Settings")
    settings.enable_zoom = enable_zoom
    settings.zoom_client_id = zoom_client_id
    settings.zoom_account_id = zoom_account_id
    settings.personal_organisers_email_template = personal_organisers_email_template
    settings.flags.ignore_validate = True
    settings.save(ignore_permissions=True)
    set_password_field("Appointment Settings", "Appointment Settings", "zoom_client_secret", zoom_client_secret)
    set_password_field("Appointment Settings", "Appointment Settings", "zoom_access_token", zoom_access_token)
    return frappe.get_single("Appointment Settings")


def gcal_service_mock(items=None):
    """Return a MagicMock mimicking the googleapiclient Calendar service.

    ``service.events().list(...).execute()`` yields ``{"items": items}``; the
    insert/get/update chains return generic mocks for write-path assertions.
    """
    service = MagicMock()
    service.events().list().execute.return_value = {"items": items or []}
    return service


@contextlib.contextmanager
def mock_gcal_object(module_path, service=None, account=None, items=None):
    """Patch get_google_calendar_object in ``module_path`` to return (service, account).

    A real Google Calendar doc should be passed as ``account`` when the code
    reads account.user / account.name / account.google_calendar_id.
    """
    service = service or gcal_service_mock(items)
    with patch(f"{module_path}.get_google_calendar_object", return_value=(service, account)):
        yield service, account


def make_event(
    subject,
    starts_on,
    ends_on,
    appointment_group=None,
    user_calendar=None,
    status="Open",
    account=None,
    **fields,
):
    """Insert an Event through the EventOverride without touching Google/Zoom.

    sync_with_google_calendar is off (skips the before_save GCal insert) and
    get_google_calendar_object is mocked for the before_insert attendee sync.
    """
    data = {
        "doctype": "Event",
        "subject": subject,
        "starts_on": starts_on,
        "ends_on": ends_on,
        "event_type": "Private",
        "status": status,
        "sync_with_google_calendar": 0,
        **fields,
    }
    if appointment_group:
        data["custom_appointment_group"] = appointment_group
    if user_calendar:
        data["custom_user_calendar"] = user_calendar
    with mute_enqueue(), mock_gcal_object(EVENT_OVERRIDE, account=account):
        return frappe.get_doc(data).insert(ignore_permissions=True)


def google_slot(start_iso, end_iso, tz="UTC"):
    """Build a Google-Calendar-shaped busy slot dict."""
    return {
        "start": {"dateTime": start_iso, "timeZone": tz},
        "end": {"dateTime": end_iso, "timeZone": tz},
    }


# --- HR fixtures (leave / holiday paths; erpnext + hrms) ---------------------


def _default_company():
    """Return the site default company, creating a minimal one and making it the global default on a bare CI site."""
    import erpnext

    company = erpnext.get_default_company()
    if company:
        return company
    name = "FA Test Co"
    if not frappe.db.exists("Company", name):
        # A bare erpnext CI site has no Warehouse Types seeded, so skip the chart of accounts +
        # default-warehouse creation that would otherwise fail with LinkValidationError (Transit).
        frappe.flags.ignore_chart_of_accounts = True
        try:
            frappe.get_doc(
                {
                    "doctype": "Company",
                    "company_name": name,
                    "abbr": "FATC",
                    "default_currency": "USD",
                    "country": "United States",
                }
            ).insert(ignore_permissions=True)
        finally:
            frappe.flags.ignore_chart_of_accounts = False
    global_defaults = frappe.get_doc("Global Defaults")
    global_defaults.default_company = name
    global_defaults.save(ignore_permissions=True)
    return name


def _ensure_system_timezone():
    """A fresh CI site may have no System Settings time_zone; seed one so tz conversions don't fail."""
    if not frappe.db.get_single_value("System Settings", "time_zone"):
        frappe.db.set_single_value("System Settings", "time_zone", "Asia/Kolkata")


def before_tests():
    """Seed a default Company + system timezone so erpnext/hrms-backed fixtures resolve on a bare CI site.

    Registered via the before_tests hook; runs once before the suite. frappe_appointment's own
    before_tests runs on `bench run-tests --app frappe_appointment` (erpnext's does not, and it would
    fail on the same missing Warehouse Types anyway).
    """
    _ensure_system_timezone()
    _default_company()
    frappe.db.commit()


def make_holiday_list(name="FA Holiday List", holidays=None, from_date="2026-01-01", to_date="2026-12-31"):
    """Insert or return a Holiday List with the given (date, description) holidays."""
    if frappe.db.exists("Holiday List", name):
        return frappe.get_doc("Holiday List", name)
    doc = frappe.get_doc(
        {"doctype": "Holiday List", "holiday_list_name": name, "from_date": from_date, "to_date": to_date}
    )
    for date, description in holidays or []:
        doc.append("holidays", {"holiday_date": date, "description": description})
    doc.flags.ignore_validate = True
    with mute_enqueue():
        doc.insert(ignore_permissions=True)
    return doc


def make_leave_type(name="FA Leave Type"):
    """Insert or return a Leave Type."""
    if not frappe.db.exists("Leave Type", name):
        frappe.get_doc({"doctype": "Leave Type", "leave_type_name": name}).insert(ignore_permissions=True)
    return name


def make_employee(user, holiday_list=None, first_name="FA Emp"):
    """Insert or return an Employee whose company_email is the given user.

    Validation is skipped so no salary/leave-ledger scaffolding is needed; only
    company_email and holiday_list (which the availability check reads) matter.
    """
    make_test_user(user)
    existing = frappe.db.get_value("Employee", {"company_email": user})
    if existing:
        return frappe.get_doc("Employee", existing)
    doc = frappe.get_doc(
        {
            "doctype": "Employee",
            "first_name": first_name,
            "company": _default_company(),
            "company_email": user,
            "user_id": user,
            "status": "Active",
            "holiday_list": holiday_list,
        }
    )
    doc.flags.ignore_mandatory = True
    doc.flags.ignore_validate = True
    with mute_enqueue():
        doc.insert(ignore_permissions=True)
    return doc


def make_approved_leave(employee, from_date, to_date, leave_type=None):
    """Insert an Approved Leave Application (validation skipped, no allocation needed)."""
    doc = frappe.get_doc(
        {
            "doctype": "Leave Application",
            "employee": employee,
            "leave_type": leave_type or make_leave_type(),
            "from_date": from_date,
            "to_date": to_date,
            "status": "Approved",
        }
    )
    doc.flags.ignore_validate = True
    doc.flags.ignore_mandatory = True
    with mute_enqueue():
        doc.insert(ignore_permissions=True)
    return doc
