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
        int(appointment_group.event_availability_window) if appointment_group.event_availability_window else -1
    )
    if event_availability_window <= 0:
        event_availability_window = 10  # By default, we will check availability for next 10 days only.
    for _ in range(event_availability_window):
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
    # Batch fetch all appointment groups with needed fields to avoid N+1 queries
    appointment_groups = frappe.get_all(
        "Appointment Group",
        fields=[
            "name",
            "send_email_alerts",
            "email_address_to_send",
            "min_slot_threshold",
            "group_name",
            "availability_email_template",
            "event_availability_window",
        ],
    )

    if not appointment_groups:
        return {}, [], {}, {}

    # Batch fetch all members for all groups in a single query
    all_group_names = [g.name for g in appointment_groups]
    all_members = frappe.get_all(
        "Members",
        filters={"parent": ["in", all_group_names], "parenttype": "Appointment Group"},
        fields=["parent", "user", "is_mandatory"],
    )

    # Group members by parent appointment group
    members_by_group = {}
    for member in all_members:
        if member.parent not in members_by_group:
            members_by_group[member.parent] = []
        members_by_group[member.parent].append(member)

    # Batch fetch all user emails for mandatory members
    mandatory_user_ids = list(set(m.user for m in all_members if m.is_mandatory))
    user_emails = {}
    if mandatory_user_ids:
        user_data = frappe.get_all(
            "User",
            filters={"name": ["in", mandatory_user_ids]},
            fields=["name", "email"],
        )
        user_emails = {u.name: u.email for u in user_data if u.email}

    # Process each appointment group and calculate availability
    data = {}
    for ag in appointment_groups:
        try:
            # Load the full document for this group (still needed for get_time_slots_for_given_date)
            appointment_group_doc = frappe.get_doc("Appointment Group", ag.name)
            data[ag.name] = get_availability_status_for_appointment_group(appointment_group_doc)
        except Exception as e:
            frappe.log_error(
                "Error in getting availability status for appointment group",
                f"Error: {e}",
                "Appointment Group",
                ag.name,
            )

    return data, appointment_groups, members_by_group, user_emails


def verify_appointment_group_members_availabililty():
    skip_availability_cron = frappe.conf.get("frappe_appointments", {}).get("skip_availability_cron", False)
    if skip_availability_cron:
        return
    data, appointment_groups, members_by_group, user_emails = get_availability_status_for_all_appointment_groups()
    send_availability_email(data, appointment_groups, members_by_group, user_emails)


def send_availability_email(data, appointment_groups, members_by_group, user_emails):
    if not data:
        return

    # Index appointment groups by name for quick lookup
    groups_by_name = {g.name: g for g in appointment_groups}

    for appointment_group_name in data:
        ag = groups_by_name.get(appointment_group_name)
        if not ag or not ag.send_email_alerts:
            continue

        min_slot_threshold = ag.min_slot_threshold
        total_slots = sum(data[appointment_group_name].values())
        if min_slot_threshold >= 0 and total_slots > min_slot_threshold:
            continue

        group_name = ag.group_name
        if not ag.availability_email_template or not ag.email_address_to_send:
            frappe.log_error(
                "Error sending email for appointment group",
                f"Email template or email address not set for appointment group {appointment_group_name}",
                "Appointment Group",
                appointment_group_name,
            )
            continue

        appointment_group_url = frappe.utils.get_url(
            f"/app/appointment-group/{appointment_group_name}", full_address=True
        )
        daywise_slots_data = "<ul>"
        for date, slots in data[appointment_group_name].items():
            daywise_slots_data += f"<li><b>{date}</b>: {slots}</li>"
        daywise_slots_data += "</ul>"

        # Build email addresses list using cached user emails
        email_addresses = [ag.email_address_to_send]
        group_members = members_by_group.get(appointment_group_name, [])
        for member in group_members:
            if member.is_mandatory:
                user_email = user_emails.get(member.user)
                if user_email:
                    email_addresses.append(user_email)

        # Load the document only for send_email_template_mail which needs a doc object
        doc = frappe.get_doc("Appointment Group", appointment_group_name)
        send_email_template_mail(
            doc,
            {
                "total_slots": total_slots,
                "group_name": group_name,
                "daywise_slots_data": daywise_slots_data,
                "appointment_group_url": appointment_group_url,
                "min_threshold": min_slot_threshold,
            },
            ag.availability_email_template,
            email_addresses,
            None,
        )
