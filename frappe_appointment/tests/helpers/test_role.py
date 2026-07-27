import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.helpers.role import add_permission_doctype

PERM_DOCTYPE = "ToDo"


class TestAddPermissionDoctype(IntegrationTestCase):
    """add_permission_doctype role/doctype permission wiring."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.role = "FA Perm Role Role26"
        if not frappe.db.exists("Role", cls.role):
            frappe.get_doc({"doctype": "Role", "role_name": cls.role}).insert(ignore_permissions=True)

    def test_add_permission_and_apply_property(self):
        """A new role/doctype gets a Custom DocPerm and each permission property is applied."""
        add_permission_doctype({self.role: {PERM_DOCTYPE: {"read": 1}}})
        name, read = frappe.db.get_value(
            "Custom DocPerm",
            {"role": self.role, "parent": PERM_DOCTYPE, "permlevel": 0},
            ["name", "read"],
        )
        self.assertIsNotNone(name)
        self.assertEqual(read, 1)
        self.assertEqual(frappe.db.count("Custom DocPerm", {"role": self.role, "parent": PERM_DOCTYPE}), 1)

    def test_recall_updates_without_duplicate(self):
        """Re-calling updates the properties in place without duplicating the perm row."""
        add_permission_doctype({self.role: {PERM_DOCTYPE: {"read": 1}}})
        add_permission_doctype({self.role: {PERM_DOCTYPE: {"read": 1, "write": 1}}})
        self.assertEqual(frappe.db.count("Custom DocPerm", {"role": self.role, "parent": PERM_DOCTYPE}), 1)
        read, write = frappe.db.get_value(
            "Custom DocPerm",
            {"role": self.role, "parent": PERM_DOCTYPE, "permlevel": 0},
            ["read", "write"],
        )
        self.assertEqual(read, 1)
        self.assertEqual(write, 1)
