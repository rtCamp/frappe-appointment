import frappe

ERPNEXT_FIELDS = []

HRMS_FIELDS = [
    {
        "allow_in_quick_entry": 0,
        "allow_on_submit": 0,
        "bold": 0,
        "collapsible": 0,
        "collapsible_depends_on": None,
        "columns": 0,
        "default": None,
        "depends_on": None,
        "description": None,
        "docstatus": 0,
        "doctype": "Custom Field",
        "dt": "Leave Application",
        "fetch_from": None,
        "fetch_if_empty": 0,
        "fieldname": "custom_google_calendar_event_id",
        "fieldtype": "Data",
        "hidden": 1,
        "hide_border": 0,
        "hide_days": 0,
        "hide_seconds": 0,
        "ignore_user_permissions": 0,
        "ignore_xss_filter": 0,
        "in_global_search": 0,
        "in_list_view": 0,
        "in_preview": 0,
        "in_standard_filter": 0,
        "insert_after": "status",
        "is_system_generated": 0,
        "is_virtual": 0,
        "label": "Google Calendar Event ID",
        "length": 0,
        "link_filters": None,
        "mandatory_depends_on": None,
        "modified": "2024-12-24 11:41:55.674096",
        "module": "Frappe Appointment",
        "name": "Leave Application-custom_google_calendar_event_id",
        "no_copy": 1,
        "non_negative": 0,
        "options": None,
        "permlevel": 1,
        "placeholder": None,
        "precision": "",
        "print_hide": 0,
        "print_hide_if_no_value": 0,
        "print_width": None,
        "read_only": 1,
        "read_only_depends_on": None,
        "report_hide": 0,
        "reqd": 0,
        "search_index": 0,
        "show_dashboard": 0,
        "sort_options": 0,
        "translatable": 1,
        "unique": 0,
        "width": None,
    }
]


def import_erpnext_fields():
    installed_apps = frappe.get_installed_apps()
    fields_to_import = []
    if "erpnext" in installed_apps:
        fields_to_import.extend(ERPNEXT_FIELDS)
    if "hrms" in installed_apps:
        fields_to_import.extend(HRMS_FIELDS)
    fields_imported = 0
    for field in fields_to_import:
        if not frappe.db.exists("Custom Field", field["name"]):
            frappe.get_doc(field).insert(ignore_permissions=True, ignore_if_duplicate=True)
            fields_imported += 1
    return fields_imported


def setup_erpnext_fields():
    fields_imported = import_erpnext_fields()
    print(f"Imported {fields_imported} custom fields for Frappe Appointment")
