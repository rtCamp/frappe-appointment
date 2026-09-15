from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.helpers.out_of_office import (
    create_out_of_office_google_calander_event,
    delete_out_of_office_google_calendar_event,
)
from frappe_appointment.overrides.leave_application_override import on_cancel_and_on_trash, on_submit


class TestLeaveApplicationOverride(IntegrationTestCase):
    def _doc(self, status="Approved"):
        return frappe._dict(
            name="LV-1",
            status=status,
            employee="EMP-1",
            from_date="2027-02-01",
            to_date="2027-02-02",
            custom_google_calendar_event_id="evt-1",
        )

    def test_on_submit_approved_enqueues(self):
        """21.1 on_submit enqueues the out-of-office event for an Approved leave."""
        with patch("frappe.enqueue") as mock_enqueue:
            on_submit(self._doc("Approved"))
        self.assertIs(mock_enqueue.call_args.args[0], create_out_of_office_google_calander_event)
        self.assertEqual(mock_enqueue.call_args.kwargs["leave_id"], "LV-1")
        self.assertEqual(mock_enqueue.call_args.kwargs["employee"], "EMP-1")

    def test_on_submit_non_approved_no_enqueue(self):
        """21.2 on_submit does not enqueue for a non-Approved leave."""
        with patch("frappe.enqueue") as mock_enqueue:
            on_submit(self._doc("Open"))
        mock_enqueue.assert_not_called()

    def test_on_cancel_enqueues_delete(self):
        """21.3 on_cancel_and_on_trash enqueues the out-of-office delete with the stored event id."""
        with patch("frappe.enqueue") as mock_enqueue:
            on_cancel_and_on_trash(self._doc())
        self.assertIs(mock_enqueue.call_args.args[0], delete_out_of_office_google_calendar_event)
        self.assertEqual(mock_enqueue.call_args.kwargs["event_id"], "evt-1")
