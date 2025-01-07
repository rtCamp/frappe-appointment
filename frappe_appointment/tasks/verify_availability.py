import json
from datetime import datetime

import frappe
import frappe.utils

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import (
    get_time_slots_for_given_date,
)
from frappe_appointment.helpers.email import send_email_template_mail


@frappe.whitelist()
def update_availability_status_for_appointment_group(appointment_group):
    if isinstance(appointment_group, str):
        appointment_group = frappe.get_doc("Appointment Group", appointment_group)
    frappe.enqueue(
        "frappe_appointment.tasks.verify_availability.get_availability_status_for_appointment_group",
        queue="long",
        appointment_group=appointment_group,
        publish_realtime=True,
    )


def get_availability_status_for_appointment_group(appointment_group, publish_realtime=False):
    data = {}
    current_date = frappe.utils.now_datetime()
    current_date = datetime(current_date.year, current_date.month, current_date.day)
    event_availability_window = (
        int(appointment_group.event_availability_window) if appointment_group.event_availability_window else 1
    )
    for _i in range(event_availability_window):
        if appointment_group.enable_scheduling_on_weekends or current_date.weekday() < 5:
            available_slots = get_time_slots_for_given_date(appointment_group, current_date)
            data[current_date.date().isoformat()] = available_slots["total_slots_for_day"]
        current_date = frappe.utils.add_days(current_date, 1)
    appointment_group.reload()
    appointment_group.available_slots_data = json.dumps(data)
    appointment_group.slots_data_updated_at = frappe.utils.now_datetime()
    appointment_group.save()
    frappe.db.commit()  # nosemgrep
    if publish_realtime:
        frappe.publish_realtime(
            "appointment_group_availability_updated",
            message="{'success':'true'}",
            doctype="Appointment Group",
            docname=appointment_group.name,
        )
    return data


def get_availability_status_for_all_appointment_groups():
    appointment_groups = frappe.get_all("Appointment Group")
    data = {}
    for appointment_group in appointment_groups:
        appointment_group = frappe.get_doc("Appointment Group", appointment_group.name)
        data[appointment_group.name] = get_availability_status_for_appointment_group(appointment_group)
    return data


def verify_appointment_group_members_availabililty():
    skip_availability_cron = frappe.conf.get("frappe_appointments", {}).get("skip_availability_cron", False)
    if skip_availability_cron:
        return
    data = get_availability_status_for_all_appointment_groups()
    send_availability_email(data)


def send_availability_email(data):
    if not data:
        return
    for appointment_group in data:
        doc = frappe.get_doc("Appointment Group", appointment_group)
        if not doc.send_email_alerts:
            continue
        min_slot_threshold = doc.min_slot_threshold
        total_slots = sum(data[appointment_group].values())
        if min_slot_threshold >= 0 and total_slots > min_slot_threshold:
            continue
        group_name = doc.group_name
        if not doc.email_template or not doc.email_address_to_send:
            frappe.log_error(
                "Error sending email for appointment group",
                f"Email template or email address not set for appointment group {appointment_group}",
                "Appointment Group",
                appointment_group,
            )
            continue
        appointment_group_url = frappe.utils.get_url(f"/app/appointment-group/{appointment_group}", full_address=True)
        daywise_slots_data = "<ul>"
        for date, slots in data[appointment_group].items():
            daywise_slots_data += f"<li><b>{date}</b>: {slots}</li>"
        daywise_slots_data += "</ul>"

        email_addresses = [doc.email_address_to_send]
        for member in doc.members:
            if member.is_mandatory:
                user = frappe.get_doc("User", member.user)
                if user.email:
                    email_addresses.append(user.email)

        send_email_template_mail(
            doc,
            {
                "total_slots": total_slots,
                "group_name": group_name,
                "daywise_slots_data": daywise_slots_data,
                "appointment_group_url": appointment_group_url,
                "min_threshold": min_slot_threshold,
            },
            doc.email_template,
            email_addresses,
            None,
        )
