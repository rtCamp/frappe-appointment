import frappe

from frappe_appointment.helpers.out_of_office import (
    create_out_of_office_google_calander_event,
    delete_out_of_office_google_calendar_event,
)


def on_submit(doc, method=None):
    if doc.status == "Approved":
        frappe.enqueue(
            create_out_of_office_google_calander_event,
            queue="long",
            leave_id=doc.name,
            employee=doc.employee,
            start_date=doc.from_date,
            end_date=doc.to_date,
        )


def on_cancel_and_on_trash(doc, method=None):
    frappe.enqueue(
        delete_out_of_office_google_calendar_event,
        queue="long",
        leave_id=doc.name,
        employee=doc.employee,
        event_id=doc.custom_google_calendar_event_id,
    )
