import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.helpers.overrides import add_response_code


class TestAddResponseCode(IntegrationTestCase):
    """add_response_code decorator status-code handling."""

    def setUp(self):
        super().setUp()
        # response.http_status_code lives on frappe.local (not rolled back), so snapshot it
        self._original_status = frappe.local.response.get("http_status_code")

    def tearDown(self):
        frappe.local.response.http_status_code = self._original_status
        super().tearDown()

    def test_tuple_return_sets_status_code(self):
        """A (body, code) return sets response.http_status_code and returns the body."""
        frappe.local.response.http_status_code = 200

        @add_response_code
        def handler():
            return {"error": "No user found"}, 404

        result = handler()
        self.assertEqual(result, {"error": "No user found"})
        self.assertEqual(frappe.local.response.http_status_code, 404)

    def test_non_tuple_return_passes_through(self):
        """A non-tuple return is returned unchanged and leaves the status code untouched."""
        frappe.local.response.http_status_code = 200

        @add_response_code
        def handler():
            return {"ok": True}

        result = handler()
        self.assertEqual(result, {"ok": True})
        self.assertEqual(frappe.local.response.http_status_code, 200)
