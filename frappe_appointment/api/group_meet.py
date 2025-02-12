import frappe
import frappe.utils
from frappe import _

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import _get_time_slots_for_day
from frappe_appointment.helpers.overrides import add_response_code
from frappe_appointment.overrides.event_override import APPOINTMENT_GROUP, _create_event_for_appointment_group


@frappe.whitelist(allow_guest=True)
@add_response_code
def get_time_slots(appointment_group_id: str, date: str, user_timezone_offset: str, **args):
    if not appointment_group_id:
        frappe.throw(_("Appointment Group ID is required"))

    appointment_group = frappe.get_doc(APPOINTMENT_GROUP, appointment_group_id)

    if not appointment_group:
        frappe.throw(_("Appointment Group not found"))

    if not date:
        frappe.throw(_("Date is required"))

    time_slots = _get_time_slots_for_day(appointment_group, date, user_timezone_offset)

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
    return _create_event_for_appointment_group(
        appointment_group=appointment_group,
        date=date,
        start_time=start_time,
        end_time=end_time,
        user_timezone_offset=user_timezone_offset,
        **args,
    )
