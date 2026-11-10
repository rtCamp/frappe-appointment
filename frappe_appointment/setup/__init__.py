import json
from pathlib import Path

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

MODULE = "Frappe Appointment"


def install() -> None:
    """Apply all Frappe Appointment customisations (idempotent; runs on install and migrate)."""
    install_custom_fields()
    install_property_setters()


def install_custom_fields() -> None:
    """Install / refresh custom fields from custom_fields.json."""
    data_file = Path(__file__).parent / "custom_fields.json"
    custom_fields: dict[str, list[dict]] = json.loads(data_file.read_text())
    for fields in custom_fields.values():
        for field in fields:
            field["module"] = MODULE
    create_custom_fields(custom_fields, update=True)


def install_property_setters() -> None:
    """Install / refresh property setters from property_setters.json (make_property_setter() can't set a module)."""
    data_file = Path(__file__).parent / "property_setters.json"
    for ps in json.loads(data_file.read_text()):
        doc = frappe.get_doc(
            {
                "doctype": "Property Setter",
                "doctype_or_field": "DocType" if ps.get("for_doctype") else "DocField",
                "doc_type": ps["doctype"],
                "field_name": ps.get("fieldname"),
                "property": ps["property"],
                "value": ps["value"],
                "property_type": ps["property_type"],
                "module": MODULE,
                "is_system_generated": True,
            }
        )
        # The app's own customisations, applied from install / migrate rather than a user request.
        doc.flags.ignore_permissions = True
        doc.flags.validate_fields_for_doctype = False
        # validate() deletes the existing setter with the same name, so this replaces it.
        doc.insert(ignore_if_duplicate=True)
