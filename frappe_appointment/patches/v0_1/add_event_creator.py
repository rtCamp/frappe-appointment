import frappe


def add_event_creator():
    appointment_groups = frappe.get_all("Appointment Group")

    for appointment_group in appointment_groups:
        members = frappe.db.get_all(
            "Members",
            filters={
                "is_mandatory": 1,
                "parent": appointment_group.name,
                "parenttype": "Appointment Group",
                "parentfield": "members",
            },
            fields=["user"],
        )
        if len(members) > 0:
            google_calendar = frappe.get_value(
                "User Appointment Availability",
                {
                    "user": members[0].user,
                },
                "google_calendar",
            )
            if google_calendar:
                frappe.db.set_value(
                    "Appointment Group",
                    appointment_group.name,
                    "event_creator",
                    google_calendar,
                )

    frappe.db.commit()


def add_google_calendar_in_user_availability():
    user_availabilities = frappe.get_all("User Appointment Availability", fields=["name", "user"])

    for user_availability in user_availabilities:
        calendar = frappe.get_all(
            "Google Calendar",
            "name",
            filters={
                "google_calendar_id": user_availability.user,
            },
        )
        if len(calendar) > 0:
            frappe.db.set_value(
                "User Appointment Availability",
                user_availability.name,
                "google_calendar",
                calendar[0].name,
            )

    frappe.db.commit()


def execute():
    add_google_calendar_in_user_availability()
    add_event_creator()
