from frappe.permissions import (
    add_permission,
    update_permission_property,
)
import frappe

def add_permission_doctype(doctype_perm_list):
    for role, role_data in doctype_perm_list.items():
        for doctype, permissions in role_data.items():
            
            permission_exists = frappe.db.get_value(
                "Custom DocPerm", filters={"role": role, "parent": doctype}
            )
            if permission_exists is None:
                add_permission(doctype, role, 0)

            # Update the property
            for per_key, Per_val in permissions.items():
                update_permission_property(doctype, role, 0, per_key, Per_val)