import frappe


# TODO: will remove this after 2-3 Weeks
def website_context(context):
    URL = frappe.request.path
    full_path = frappe.request.full_path
    route = URL.split("/")

    if frappe.request.method == "GET":
        handle_appointment_group_route(route, full_path)


def handle_appointment_group_route(route, full_path):
    if "appointment" in route or "app" in route:
        return

    appointment_group_route = frappe.db.get_value("Appointment Group", {"name": route[-1]}, "route")

    if appointment_group_route:
        frappe.redirect("/appointment" + full_path)
