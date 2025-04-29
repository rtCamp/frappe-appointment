from urllib.parse import quote_plus

import frappe
import frappe.utils
from frappe import _
from frappe.twofactor import encrypt

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import _get_time_slots_for_day
from frappe_appointment.helpers.overrides import add_response_code
from frappe_appointment.overrides.event_override import APPOINTMENT_GROUP, _create_event_for_appointment_group


=
@add_response_code
def get_time_slots(appointment_group_id: str, date: str, user_timezone_offset: str, **args):
    if not appointment_group_id:
        frappe.throw(_("Appointment Group ID is required"))

    if not date:
        frappe.throw(_("Date is required"))

    appointment_group = frappe.get_doc(APPOINTMENT_GROUP, appointment_group_id)

    time_slots = _get_time_slots_for_day(appointment_group, date, user_timezone_offset)
    if time_slots and isinstance(time_slots, dict):
        time_slots["title"] = appointment_group.group_name
    return time_slots


@frappe.whitelist(allow_guest=True)
@add_response_code
def book_time_slot(
    appointment_group_id: str,
    date: str,
    start_time: str,
    end_time: str,
    user_timezone_offset: str,
    **args,
):
    appointment_group = frappe.get_doc(APPOINTMENT_GROUP, appointment_group_id)
    resp = _create_event_for_appointment_group(
        appointment_group=appointment_group,
        date=date,
        start_time=start_time,
        end_time=end_time,
        user_timezone_offset=user_timezone_offset,
        return_event_id=True,
        **args,
    )
    event_token = encrypt(resp["event_id"])
    event = frappe.get_doc("Event", resp["event_id"])
    resp["meeting_provider"] = event.custom_meeting_provider
    resp["meet_link"] = event.custom_meet_link
    resp["reschedule_url"] = frappe.utils.get_url(
        "/schedule/gr/{0}?reschedule=1&event_token={1}".format(quote_plus(appointment_group_id), event_token)
    )
    resp["google_calendar_event_url"] = event.custom_google_calendar_event_url
    return resp
