import datetime
import json
import re

import frappe
import frappe.utils
import pytz

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import _get_time_slots_for_day
from frappe_appointment.helpers.overrides import add_response_code
from frappe_appointment.overrides.event_override import _create_event_for_appointment_group


@frappe.whitelist(allow_guest=True)
@add_response_code
def get_meeting_windows(slug):
    ap_availability = frappe.get_all(
        "User Appointment Availability", filters={"slug": slug, "enable_scheduling": 1}, fields=["*"]
    )
    if not ap_availability:
        return {"error": "No user found"}, 404
    ap_availability = ap_availability[0]
    user = ap_availability.get("user")
    if not user:
        return {"error": "No user found"}, 404
    user = frappe.get_doc("User", user)
    if not user:
        return {"error": "No user found"}, 404
    full_name = user.get("full_name")
    profile_pic = user.get("user_image")
    position = None
    company = None

    installed_apps = frappe.get_installed_apps()
    if "erpnext" in installed_apps:
        employee = frappe.get_all("Employee", filters={"user_id": user.name}, fields=["*"])
        if employee:
            employee = employee[0]
            position = employee.get("designation")
            company = employee.get("company")

    meeting_provider = ap_availability.get("meeting_provider")

    all_durations = frappe.get_all(
        "Appointment Slot Duration", filters={"parent": ap_availability.get("name")}, fields=["*"]
    )

    durations = [{"id": d.name, "label": d.title, "duration": d.duration} for d in all_durations]

    return {
        "full_name": full_name,
        "profile_pic": profile_pic,
        "position": position,
        "company": company,
        "meeting_provider": meeting_provider,
        "durations": durations,
    }, 200


@frappe.whitelist(allow_guest=True)
@add_response_code
def get_time_slots(duration_id: str, date: str, user_timezone_offset: str):
    duration = frappe.get_doc("Appointment Slot Duration", duration_id)
    if not duration:
        return {"error": "No duration found"}, 404
    ap_availability = frappe.get_all(
        "User Appointment Availability", filters={"name": duration.get("parent")}, fields=["*"]
    )

    if not ap_availability:
        return {"error": "No user found"}, 404

    ap_availability = ap_availability[0]

    appointment_group_obj = create_dummy_appointment_group(duration, ap_availability)

    appointment_group = frappe.get_doc(appointment_group_obj)

    data = _get_time_slots_for_day(appointment_group, date, user_timezone_offset)

    if "appointment_group_id" in data:
        del data["appointment_group_id"]
    data["user"] = ap_availability.get("name")
    data["label"] = duration.title

    return data


@frappe.whitelist(allow_guest=True, methods=["POST"])
@add_response_code
def book_time_slot(
    duration_id: str,
    date: str,
    start_time: str,
    end_time: str,
    user_timezone_offset: str,
    user_name: str,
    user_email: str,
    other_participants: str = None,
    **args,
):
    duration = frappe.get_doc("Appointment Slot Duration", duration_id)
    if not duration:
        return {"error": "No duration found"}, 404
    ap_availability = frappe.get_all(
        "User Appointment Availability", filters={"name": duration.get("parent")}, fields=["*"]
    )

    if not ap_availability:
        return {"error": "No user found"}, 404

    ap_availability = ap_availability[0]

    appointment_group_obj = create_dummy_appointment_group(duration, ap_availability)

    appointment_group = frappe.get_doc(appointment_group_obj)

    event_participants = [
        {
            "reference_doctype": "User Appointment Availability",
            "reference_docname": ap_availability.get("name"),
            "email": ap_availability.get("user"),
        },
        {
            "email": user_email,
        },
    ]

    if other_participants:
        other_participants = other_participants.split(",")
        for participant in other_participants:
            if not re.match(r"[^@]+@[^@]+\.[^@]+", participant):
                continue
            event_participants.append(
                {
                    "email": participant.strip(),
                }
            )

    custom_doctype_link_with_event = [
        {
            "reference_doctype": "User Appointment Availability",
            "reference_docname": ap_availability.get("name"),
            "value": ap_availability.get("user"),
        }
    ]

    if not args.get("custom_doctype_link_with_event", None):
        args["custom_doctype_link_with_event"] = json.dumps(custom_doctype_link_with_event)
    else:
        original_link = json.loads(args["custom_doctype_link_with_event"])
        for link in original_link:
            if link["doctype"] == "User Appointment Availability" and link["name"] == ap_availability.get("name"):
                break
        else:
            original_link.append(custom_doctype_link_with_event[0])
            args["custom_doctype_link_with_event"] = json.dumps(original_link)

    if not args.get("Subject", None):
        name = frappe.get_value("User", ap_availability.get("user"), "full_name")

        duration_str = duration_to_string(duration.duration)

        args["subject"] = f"Meet: {user_name} <> {name} ({duration_str})"

    args["personal"] = True
    args["user_calendar"] = ap_availability.name
    args["appointment_slot_duration"] = duration.name

    success_message = ""

    if args.get("event_token"):
        success_message = "Appointment has been rescheduled."

    data = _create_event_for_appointment_group(
        appointment_group,
        date,
        start_time,
        end_time,
        user_timezone_offset,
        json.dumps(event_participants),
        success_message=success_message,
        **args,
    )

    return data


def duration_to_string(duration):
    seconds = int(duration)
    minutes = seconds // 60
    hours = minutes // 60
    rest_minutes = minutes % 60

    duration_str = ""
    if hours:
        duration_str += f"{hours} hour{'s' if hours > 1 else ''}"
    if rest_minutes:
        duration_str += f" {rest_minutes} minute{'s' if rest_minutes > 1 else ''}"

    duration_str = duration_str.strip()
    return duration_str


def create_dummy_appointment_group(duration, ap_availability):
    appointment_group_obj = {
        "doctype": "Appointment Group",
        "group_name": "Personal Meeting",
        "event_creator": ap_availability.get("google_calendar"),
        "event_organizer": ap_availability.get("user"),
        "members": [{"user": ap_availability.get("name"), "is_mandatory": 1}],
        "duration_for_event": datetime.timedelta(seconds=duration.duration),
        "minimum_buffer_time": datetime.timedelta(seconds=duration.minimum_buffer_time)
        if duration.minimum_buffer_time
        else None,
        "minimum_notice_before_event": duration.minimum_notice_before_event,
        "event_availability_window": duration.availability_window,
        "meet_provider": ap_availability.get("meeting_provider"),
        "meet_link": ap_availability.get("meeting_link"),
        "response_email_template": ap_availability.get("response_email_template"),
        "linked_doctype": ap_availability.get("name"),
        "limit_booking_frequency": -1,
    }

    return appointment_group_obj


@frappe.whitelist(allow_guest=True)
def get_all_timezones():
    return pytz.common_timezones


@frappe.whitelist()
def get_schedular_link(user):
    ap_availability = frappe.get_all(
        "User Appointment Availability", filters={"user": user, "enable_scheduling": 1}, fields=["*"]
    )
    if not ap_availability:
        return {"error": "No user found"}, 404

    ap_availability = ap_availability[0]

    all_durations = frappe.get_all(
        "Appointment Slot Duration",
        filters={"parent": ap_availability.get("name")},
        fields=["name", "title", "duration"],
    )

    url = frappe.utils.get_url("/schedule/in/{0}".format(ap_availability.get("slug")))

    return {
        "url": url,
        "slug": ap_availability.get("slug"),
        "available_durations": [
            {
                "id": d.name,
                "label": d.title,
                "duration": d.duration,
                "duration_str": duration_to_string(d.duration),
                "url": url + "?type=" + d.name,
            }
            for d in all_durations
        ],
    }
