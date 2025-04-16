import frappe


def execute():
    appointment_groups = frappe.get_all("Appointment Group")

    for appointment_group in appointment_groups:
        appointment_group_doc = frappe.get_doc("Appointment Group", appointment_group.name)
        duration_for_event = appointment_group_doc.duration_for_event.seconds
        minimum_buffer_time = appointment_group_doc.minimum_buffer_time.seconds

        appointment_group_doc.minimum_buffer_time = minimum_buffer_time
        appointment_group_doc.duration_for_event = duration_for_event
        appointment_group_doc.db_update()
