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
    # Tag every field with the app's module so /desk/custom-field shows which app owns it.
    for fields in custom_fields.values():
        for field in fields:
            field["module"] = MODULE
    create_custom_fields(custom_fields, update=True)


def install_property_setters() -> None:
    """Install / refresh property setters from property_setters.json, tagged with the app's module.

    make_property_setter() can't set a module, and patches such as remove_stale_field_order_property_setters
    find this app's property setters by module, so each one is written here with it.
    """
    data_file = Path(__file__).parent / "property_setters.json"
    property_setters: list[dict] = json.loads(data_file.read_text())
    wanted = {_property_setter_name(ps): ps for ps in property_setters}

    # Only setters already tagged with the app's module count as installed: one with the same name but another
    # module (or none) is rewritten below, which also gives it the module.
    existing = {
        row.name: row
        for row in frappe.get_all(
            "Property Setter",
            filters={"module": MODULE},
            fields=["name", "value", "property_type"],
        )
    }

    for name, ps in wanted.items():
        current = existing.get(name)
        if current and (current.value or "", current.property_type) == (ps["value"], ps["property_type"]):
            continue
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
            }
        )
        # Runs from after_install / after_migrate, not from a user request: these are the app's own
        # customisations, so they are applied regardless of who runs the install or migrate.
        doc.flags.ignore_permissions = True
        # A new Property Setter's validate() deletes the old one with the same name, so this also updates it.
        doc.insert()


def _property_setter_name(ps: dict) -> str:
    """Return the name PropertySetter.autoname() gives this entry."""
    return f"{ps['doctype']}-{ps.get('fieldname') or 'main'}-{ps['property']}"
