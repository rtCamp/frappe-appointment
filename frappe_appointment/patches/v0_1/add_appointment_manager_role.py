import frappe
from frappe_appointment.helpers.role import add_permission_doctype


def add_role():
	desk_roles = ["Appointment Manager"]

	for role in desk_roles:
		frappe.get_doc(
			{"doctype": "Role", "name": role, "is_custom": 1, "role_name": role}
		).insert(ignore_if_duplicate=True)

	permissions = {
		"if_owner": 0,
		"select": 1,
		"create": 1,
		"cancel": 1,
		"export": 1,
		"read": 1,
		"delete": 1,
		"write": 1,
		"print": 1,
		"import": 1,
		"export": 1,
		"share": 1,
	}

	doctype_perm_list = {
		"Appointment Manager": {
			"Members": permissions,
			"Event DocType Link": permissions,
			"Appointment Time Slot": permissions,
			"Appointment Group": permissions,
			"User Appointment Availability": permissions,
		}
	}
	add_permission_doctype(doctype_perm_list)


def execute():
	add_role()
