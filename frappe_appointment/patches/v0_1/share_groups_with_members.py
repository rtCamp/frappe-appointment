import frappe
from frappe.share import add_docshare, get_share_name

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import member_users


def execute():
    """Members can see the groups they're in: share existing groups read-only with their members,
    as saving a group now does. Shares that already exist, including ones with more access, are left alone."""
    flags = {"ignore_share_permission": True, "ignore_permissions": True}

    groups = frappe.get_all("Appointment Group", fields=["name", "owner"])
    for group in groups:
        members = frappe.get_all(
            "Members", filters={"parent": group.name, "parenttype": "Appointment Group"}, fields=["user"]
        )
        for user in member_users(members):
            if user == group.owner:
                continue
            already_shared = get_share_name("Appointment Group", group.name, user, 0)
            if not already_shared:
                add_docshare("Appointment Group", group.name, user, read=1, flags=flags)
