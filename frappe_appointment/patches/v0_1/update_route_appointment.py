import frappe


def execute():
    appointment_groups = frappe.get_all("Appointment Group")

    for appointment_group in appointment_groups:
        appointment_group_doc = frappe.get_doc("Appointment Group", appointment_group.name)
        appointment_group_doc.update_route()
        appointment_group_doc.save()
