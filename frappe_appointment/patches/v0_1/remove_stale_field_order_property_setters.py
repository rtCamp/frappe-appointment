import frappe

MODULES = ("Frappe Appointment",)


def execute():
    """Delete stale `field_order` Property Setters owned by this app's modules."""
    rows = frappe.get_all(
        "Property Setter",
        filters={"property": "field_order", "module": ("in", MODULES)},
        fields=["name", "doc_type"],
    )
    if not rows:
        return
    affected = set()
    for r in rows:
        frappe.delete_doc("Property Setter", r["name"], force=True, ignore_permissions=True)
        affected.add(r["doc_type"])
    frappe.db.commit()
    for dt in affected:
        frappe.clear_cache(doctype=dt)
    print(f"Removed {len(rows)} stale field_order Property Setter(s) across {len(affected)} doctype(s).")
