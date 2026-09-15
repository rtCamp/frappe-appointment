import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.frappe_appointment.doctype.user_appointment_availability.user_appointment_availability import (
    is_slug_available,
    suggest_slug,
)
from frappe_appointment.tests import make_google_calendar, make_test_user, make_user_availability


class TestUserAvailabilityValidate(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.auth_cal = make_google_calendar(
            "test_fa_uaav_auth@example.com", calendar_name="GCal FA UAAV", authorized=True
        )
        cls.unauth_cal = make_google_calendar(
            "test_fa_uaav_unauth@example.com", calendar_name="GCal FA UAAV Unauth", authorized=False
        )

    def _uaa(self, user, slug=None, days=None, enable_scheduling=0, google_calendar=None):
        make_test_user(user)
        doc = frappe.get_doc(
            {
                "doctype": "User Appointment Availability",
                "user": user,
                "google_calendar": google_calendar or self.auth_cal.name,
                "slug": slug,
                "enable_scheduling": enable_scheduling,
                "meeting_provider": "Google Meet",
            }
        )
        for day, start, end in days or []:
            doc.append("appointment_time_slot", {"day": day, "start_time": start, "end_time": end})
        return doc

    def test_start_after_end_throws(self):
        """13.1 a time slot with start after end is rejected."""
        with self.assertRaises(frappe.ValidationError):
            self._uaa("test_fa_uaav_1@example.com", days=[("Monday", "17:00:00", "09:00:00")]).insert(
                ignore_permissions=True
            )

    def test_repeated_weekday_throws(self):
        """13.2 a weekday repeated across slots is rejected."""
        with self.assertRaises(frappe.ValidationError):
            self._uaa(
                "test_fa_uaav_2@example.com",
                days=[("Monday", "09:00:00", "12:00:00"), ("Monday", "13:00:00", "17:00:00")],
            ).insert(ignore_permissions=True)

    def test_unauthorized_calendar_throws(self):
        """13.3 an unauthorized Google Calendar is rejected."""
        with self.assertRaises(frappe.ValidationError):
            self._uaa("test_fa_uaav_3@example.com", google_calendar=self.unauth_cal.name).insert(
                ignore_permissions=True
            )

    # 13.4 (enable_scheduling without a slug is rejected) is not reachable: the slug field has
    # fetch_from "user.username", so it auto-fills whenever left empty and the check never fires.

    def test_invalid_slug_throws(self):
        """13.5 an invalid slug is rejected."""
        with self.assertRaises(frappe.ValidationError):
            self._uaa("test_fa_uaav_5@example.com", slug="Bad_Slug").insert(ignore_permissions=True)

    def test_valid_slug_passes(self):
        """13.5 a valid slug validates."""
        doc = self._uaa("test_fa_uaav_6@example.com", slug="fa-valid-slug").insert(ignore_permissions=True)
        self.assertTrue(frappe.db.exists("User Appointment Availability", doc.name))

    def test_duplicate_slug_throws(self):
        """13.6 a slug already used by another record is rejected."""
        make_user_availability("test_fa_uaav_7@example.com", slug="fa-taken-slug", google_calendar=self.auth_cal.name)
        with self.assertRaises(frappe.ValidationError):
            self._uaa("test_fa_uaav_8@example.com", slug="fa-taken-slug").insert(ignore_permissions=True)


class TestSlugHelpers(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        make_user_availability("test_fa_slug_taken@example.com", slug="fa-slughelp")

    def test_suggest_slug_returns_first_free(self):
        """13.7 suggest_slug returns the first numbered variant that is free."""
        self.assertEqual(suggest_slug("fa-slughelp"), "fa-slughelp1")

    def test_is_slug_available_free(self):
        """13.8 is_slug_available reports a free slug as available with no suggestion."""
        self.assertEqual(is_slug_available("fa-totally-free"), {"is_available": True, "suggested_slug": None})

    def test_is_slug_available_taken(self):
        """13.8 is_slug_available reports a taken slug with a suggestion."""
        result = is_slug_available("fa-slughelp")
        self.assertFalse(result["is_available"])
        self.assertEqual(result["suggested_slug"], "fa-slughelp1")


# 13.9 (get_user_appointment_availability_slots) is not tested: the function has no callers and
# always raises. It builds a tz-aware datetime (convert_utc_datetime_to_timezone) then passes it to
# convert_datetime_to_utc, whose pytz.localize rejects an already-tz-aware datetime. SOURCE BUG.
