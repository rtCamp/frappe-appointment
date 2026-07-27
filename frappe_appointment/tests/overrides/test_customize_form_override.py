from unittest.mock import patch

from frappe.tests import IntegrationTestCase

from frappe_appointment.overrides.customize_form_override import AppointmentOverrideCustomizeForm

PARENT = "frappe.custom.doctype.customize_form.customize_form.CustomizeForm.allow_property_change"


class TestAllowPropertyChange(IntegrationTestCase):
    def setUp(self):
        # Instantiate the override directly: on a multi-app site get_doc("Customize Form") can
        # resolve to a different app's override class.
        self.obj = AppointmentOverrideCustomizeForm.__new__(AppointmentOverrideCustomizeForm)

    def test_hidden_allowed(self):
        """20.1 the 'hidden' property is always exportable."""
        self.assertTrue(self.obj.allow_property_change("hidden", None, {}, None))

    def test_read_only_allowed(self):
        """20.1 the 'read_only' property is always exportable."""
        self.assertTrue(self.obj.allow_property_change("read_only", None, {}, None))

    def test_depends_on_allowed(self):
        """20.1 the 'depends_on' property is always exportable."""
        self.assertTrue(self.obj.allow_property_change("depends_on", None, {}, None))

    def test_reqd_allowed(self):
        """20.1 the 'reqd' property is always exportable."""
        self.assertTrue(self.obj.allow_property_change("reqd", None, {}, None))

    def test_options_allowed_for_select(self):
        """20.1 'options' is exportable for a Select field."""
        self.assertTrue(self.obj.allow_property_change("options", None, {"fieldtype": "Select"}, None))

    def test_unlisted_property_defers_to_super(self):
        """20.2 an unlisted property defers to the parent implementation."""
        with patch(PARENT, return_value="SENTINEL") as sup:
            result = self.obj.allow_property_change("label", None, {}, None)
        self.assertEqual(result, "SENTINEL")
        sup.assert_called_once()

    def test_options_non_select_defers_to_super(self):
        """20.2 'options' on a non-Select field defers to the parent implementation."""
        with patch(PARENT, return_value="SENTINEL"):
            result = self.obj.allow_property_change("options", None, {"fieldtype": "Data"}, None)
        self.assertEqual(result, "SENTINEL")
