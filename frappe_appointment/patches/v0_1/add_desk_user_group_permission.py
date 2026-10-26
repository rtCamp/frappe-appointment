import frappe

DOCTYPE = "Appointment Group"

# The same rule as the Desk User row in appointment_group.json: anyone with Desk access manages their own groups.
DESK_USER_RULE = {
    "role": "Desk User",
    "permlevel": 0,
    "if_owner": 1,
    "create": 1,
    "read": 1,
    "write": 1,
    "delete": 1,
    "share": 1,
    "email": 1,
    "print": 1,
    "report": 1,
}


def execute():
    """Once a doctype has Custom DocPerm rows, Frappe ignores the permissions in its JSON. Sites where the
    Appointment Manager role was added have such rows for Appointment Group, so the new Desk User rule has
    to be added there too. Sites without custom rows already get it from the JSON and are left alone, and so
    is a site where someone already set up a Desk User rule."""
    has_custom_rules = frappe.db.exists("Custom DocPerm", {"parent": DOCTYPE})
    if not has_custom_rules:
        return

    has_desk_user_rule = frappe.db.exists("Custom DocPerm", {"parent": DOCTYPE, "role": "Desk User", "permlevel": 0})
    if has_desk_user_rule:
        return

    rule = frappe.get_doc(
        {
            "doctype": "Custom DocPerm",
            "parent": DOCTYPE,
            "parenttype": "DocType",
            "parentfield": "permissions",
            **DESK_USER_RULE,
        }
    )
    rule.insert(ignore_permissions=True)
    frappe.clear_cache(doctype=DOCTYPE)
