import json
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import (
    get_time_slots_for_given_date,
)
from frappe_appointment.tasks.verify_availability import (
    get_availability_status_for_appointment_group,
    send_availability_email,
    update_availability_status_for_appointment_group,
    verify_appointment_group_members_availabililty,
)
from frappe_appointment.tests import make_appointment_group, make_user_availability

VA = "frappe_appointment.tasks.verify_availability"
AG = "frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group"
ENQUEUE_TARGET = "frappe_appointment.tasks.verify_availability.get_availability_status_for_appointment_group"


def _email_template(name):
    if not frappe.db.exists("Email Template", name):
        doc = frappe.get_doc({"doctype": "Email Template", "subject": "Avail", "response": "{{ total_slots }}"})
        doc.name = name
        doc.insert(ignore_permissions=True)
    return name


class TestUpdateAvailabilityStatus(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_va_upd@example.com"
        make_user_availability(cls.user, slug="fa-va-upd")
        cls.group = make_appointment_group("FA VA Upd", members=[cls.user])

    def test_enqueues_status_job(self):
        """25.1 update_availability_status_for_appointment_group enqueues the status job."""
        with patch("frappe.enqueue") as mock_enqueue:
            update_availability_status_for_appointment_group(self.group.name)
        self.assertEqual(mock_enqueue.call_args.args[0], ENQUEUE_TARGET)


class TestGetAvailabilityStatus(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_va_get@example.com"
        make_user_availability(cls.user, slug="fa-va-get")
        cls.group = make_appointment_group("FA VA Get", members=[cls.user], event_availability_window=3)

    def test_writes_per_date_totals(self):
        """25.2 get_availability_status_for_appointment_group writes per-date totals and stamps the group."""
        with (
            patch(f"{VA}.get_time_slots_for_given_date", return_value={"total_slots_for_day": 3}),
            patch("frappe.db.commit"),
        ):
            data = get_availability_status_for_appointment_group(self.group)
        self.assertTrue(data)
        self.assertTrue(all(v == 3 for v in data.values()))
        self.group.reload()
        self.assertEqual(json.loads(self.group.available_slots_data), data)

    def test_per_date_totals_match_a_fresh_calculation(self):
        """25.2 the job's per-date totals, from one group object, match a fresh calculation for each date."""
        with (
            patch(f"{AG}.get_all_unavailable_google_calendar_slots_for_day", return_value=[]),
            patch("frappe.db.commit"),
        ):
            data = get_availability_status_for_appointment_group(frappe.get_doc("Appointment Group", self.group.name))
            expected = {
                date: get_time_slots_for_given_date(
                    frappe.get_doc("Appointment Group", self.group.name), frappe.utils.get_datetime(date)
                )["total_slots_for_day"]
                for date in data
            }
        self.assertEqual(len(data), 3)
        self.assertEqual(data, expected)


class TestVerifyMembersAvailability(IntegrationTestCase):
    def test_skip_cron_flag_short_circuits(self):
        """25.3 the skip_availability_cron config flag short-circuits the cron."""
        with (
            patch.dict(frappe.conf, {"frappe_appointments": {"skip_availability_cron": True}}),
            patch(f"{VA}.send_availability_email") as mock_send,
        ):
            verify_appointment_group_members_availabililty()
        mock_send.assert_not_called()


class TestSendAvailabilityEmail(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        template = _email_template("FA VA Template")
        cls.alert_user = "test_fa_va_alert@example.com"
        make_user_availability(cls.alert_user, slug="fa-va-alert")
        cls.alert_group = make_appointment_group(
            "FA VA Alert",
            members=[cls.alert_user],
            send_email_alerts=1,
            min_slot_threshold=5,
            availability_email_template=template,
            email_address_to_send="alerts@example.com",
        )
        cls.quiet_user = "test_fa_va_quiet@example.com"
        make_user_availability(cls.quiet_user, slug="fa-va-quiet")
        cls.quiet_group = make_appointment_group("FA VA Quiet", members=[cls.quiet_user], send_email_alerts=0)

        # An alerting group with one mandatory and one optional member.
        cls.optional_user = "test_fa_va_optional@example.com"
        make_user_availability(cls.optional_user, slug="fa-va-optional")
        cls.mixed_group = make_appointment_group(
            "FA VA Mixed",
            members=[cls.alert_user, cls.optional_user],
            send_email_alerts=1,
            min_slot_threshold=5,
            availability_email_template=template,
            email_address_to_send="mixed@example.com",
        )
        frappe.db.set_value("Members", {"parent": cls.mixed_group.name, "user": cls.optional_user}, "is_mandatory", 0)

    def test_below_threshold_sends(self):
        """25.5 a group below its slot threshold sends the availability email."""
        with patch(f"{VA}.send_email_template_mail") as mock_send:
            send_availability_email({self.alert_group.name: {"2027-01-15": 1}})
        mock_send.assert_called_once()

    def test_alert_goes_to_group_address_and_mandatory_members(self):
        """25.5 the availability email goes to the group's alert address and its mandatory members."""
        with patch(f"{VA}.send_email_template_mail") as mock_send:
            send_availability_email({self.alert_group.name: {"2027-01-15": 1}})
        self.assertCountEqual(mock_send.call_args.args[3], ["alerts@example.com", self.alert_user])

    def test_optional_members_get_no_alert(self):
        """25.5 a member who isn't mandatory doesn't get the availability email."""
        with patch(f"{VA}.send_email_template_mail") as mock_send:
            send_availability_email({self.mixed_group.name: {"2027-01-15": 1}})
        self.assertCountEqual(mock_send.call_args.args[3], ["mixed@example.com", self.alert_user])

    def test_only_groups_with_alerts_on_are_emailed(self):
        """25.4 of several groups below threshold, only those with email alerts on are emailed."""
        with patch(f"{VA}.send_email_template_mail") as mock_send:
            send_availability_email(
                {self.alert_group.name: {"2027-01-15": 1}, self.quiet_group.name: {"2027-01-15": 1}}
            )
        self.assertEqual([call.args[0].name for call in mock_send.call_args_list], [self.alert_group.name])

    def test_alerts_disabled_skips(self):
        """25.4 a group with email alerts disabled is skipped."""
        with patch(f"{VA}.send_email_template_mail") as mock_send:
            send_availability_email({self.quiet_group.name: {"2027-01-15": 1}})
        mock_send.assert_not_called()

    def test_above_threshold_skips(self):
        """25.4 a group above its slot threshold is skipped."""
        with patch(f"{VA}.send_email_template_mail") as mock_send:
            send_availability_email({self.alert_group.name: {"2027-01-15": 10}})
        mock_send.assert_not_called()
