import frappe


def execute():
    appointment_groups = frappe.get_all("Appointment Group")
    appointment_group_docs = {}

    for appointment_group in appointment_groups:
        appointment_group_doc = frappe.get_doc("Appointment Group", appointment_group.name)
        duration_for_event = (
            appointment_group_doc.duration_for_event.seconds if appointment_group_doc.duration_for_event else 0
        )
        minimum_buffer_time = (
            appointment_group_doc.minimum_buffer_time.seconds if appointment_group_doc.minimum_buffer_time else 0
        )

        appointment_group_docs[appointment_group.name] = {
            "minimum_buffer_time": minimum_buffer_time,
            "duration_for_event": duration_for_event,
        }

    frappe.reload_doc("Frappe Appointment", "doctype", "Appointment Group")

    for appointment_group_doc in appointment_group_docs:
        appointment_group = frappe.get_doc("Appointment Group", appointment_group_doc)
        appointment_group.minimum_buffer_time = appointment_group_docs[appointment_group_doc]["minimum_buffer_time"]
        appointment_group.duration_for_event = appointment_group_docs[appointment_group_doc]["duration_for_event"]
        appointment_group.save()
