from unittest.mock import MagicMock, call, patch

from frappe.tests import IntegrationTestCase

from frappe_appointment.helpers.out_of_office import (
    create_out_of_office_google_calander_event,
    delete_out_of_office_google_calendar_event,
    get_employee_google_calendar,
)
from frappe_appointment.tests import OUT_OF_OFFICE, make_employee, make_google_calendar, mock_gcal_object


class TestGetEmployeeGoogleCalendar(IntegrationTestCase):
    def test_no_matching_calendar_returns_none(self):
        """21.4 an employee with no matching Google Calendar returns None."""
        emp = make_employee("test_fa_ooo_nocal@example.com")
        self.assertIsNone(get_employee_google_calendar(emp.name))

    def test_push_disabled_returns_none(self):
        """21.4 a calendar with push_to_google_calendar disabled returns None."""
        user = "test_fa_ooo_nopush@example.com"
        emp = make_employee(user)
        gcal = make_google_calendar(user, calendar_name="GCal OOO NoPush", push_to_google_calendar=0)
        with mock_gcal_object(OUT_OF_OFFICE, account=gcal):
            self.assertIsNone(get_employee_google_calendar(emp.name))


class TestDeleteOutOfOffice(IntegrationTestCase):
    def test_empty_event_id_short_circuits(self):
        """21.5 a delete with no event id makes no Google call."""
        with patch(f"{OUT_OF_OFFICE}.get_google_calendar_object") as mock_obj:
            delete_out_of_office_google_calendar_event("LV-1", "EMP-1", "")
        mock_obj.assert_not_called()


class TestCreateOutOfOffice(IntegrationTestCase):
    def test_snapshot_ended_before_storing_event_id(self):
        """The read snapshot is committed away before the event id is written, without touching modified.

        With innodb_snapshot_isolation on, an update made on a snapshot that predates another
        job's write to the same Leave Application fails with 1020 "Record has changed since last read".
        """
        service = MagicMock()
        service.events.return_value.insert.return_value.execute.return_value = {"id": "evt-new"}
        db = MagicMock()
        with (
            patch(f"{OUT_OF_OFFICE}.get_employee_google_calendar", return_value=service),
            patch(f"{OUT_OF_OFFICE}.frappe.db", db),
            patch(f"{OUT_OF_OFFICE}.frappe.log_error") as mock_log_error,
        ):
            create_out_of_office_google_calander_event("LV-1", "EMP-1", "2027-02-01", "2027-02-02")

        mock_log_error.assert_not_called()
        self.assertEqual(
            db.mock_calls,
            [
                call.commit(),
                call.set_value(
                    "Leave Application", "LV-1", "custom_google_calendar_event_id", "evt-new", update_modified=False
                ),
            ],
        )
