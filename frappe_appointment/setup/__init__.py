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
    """Install / refresh property setters from property_setters.json."""
    data_file = Path(__file__).parent / "property_setters.json"
    for ps in json.loads(data_file.read_text()):
        frappe.make_property_setter(
            {
                "doctype": ps["doctype"],
                "doctype_or_field": "DocType" if ps.get("for_doctype") else "DocField",
                "fieldname": ps.get("fieldname"),
                "property": ps["property"],
                "value": ps["value"],
                "property_type": ps["property_type"],
            },
            validate_fields_for_doctype=False,
            module=MODULE,
        )
