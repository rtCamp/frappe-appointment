import frappe


def before_uninstall():
	remove_role()


def remove_role():
	roles = ["Appointment Manager"]

	for role in roles:
		frappe.db.delete("Role", {"name": role})
