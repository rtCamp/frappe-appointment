# Copyright (c) 2023, rtCamp and Contributors
# See license.txt

import datetime
import unittest
from unittest.mock import MagicMock, patch

import frappe
from frappe.tests.utils import FrappeTestCase

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import (
    get_member_leave_holiday_data,
    is_member_on_leave_or_is_holiday_cached,
)


class TestAppointmentGroup(FrappeTestCase):
    def test_get_member_leave_holiday_data_returns_none_without_hrms(self):
        """Test that cache returns None when HRMS is not installed"""
        with patch("frappe.get_installed_apps", return_value=["frappe"]):
            appointment_group = MagicMock()
            start_date = datetime.datetime(2024, 1, 1)
            end_date = datetime.datetime(2024, 1, 31)

            result = get_member_leave_holiday_data(appointment_group, start_date, end_date)

            self.assertIsNone(result)

    def test_get_member_leave_holiday_data_returns_none_without_mandatory_members(self):
        """Test that cache returns None when there are no mandatory members"""
        with patch("frappe.get_installed_apps", return_value=["frappe", "erpnext", "hrms"]):
            appointment_group = MagicMock()
            appointment_group.members = []

            start_date = datetime.datetime(2024, 1, 1)
            end_date = datetime.datetime(2024, 1, 31)

            result = get_member_leave_holiday_data(appointment_group, start_date, end_date)

            self.assertIsNone(result)

    def test_is_member_on_leave_or_is_holiday_cached_falls_back_without_cache(self):
        """Test that cached function falls back to original when cache is None"""
        with patch(
            "frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group.is_member_on_leave_or_is_holiday"
        ) as mock_original:
            mock_original.return_value = False

            appointment_group = MagicMock()
            date = datetime.date(2024, 1, 15)

            result = is_member_on_leave_or_is_holiday_cached(appointment_group, date, None)

            mock_original.assert_called_once_with(appointment_group, date)
            self.assertFalse(result)

    def test_is_member_on_leave_or_is_holiday_cached_with_leave_date(self):
        """Test that cached function detects leave dates correctly"""
        appointment_group = MagicMock()
        member = MagicMock()
        member.is_mandatory = True
        member.user = "test@example.com"
        appointment_group.members = [member]

        employee = MagicMock()
        employee.name = "EMP-001"
        employee.company_email = "test@example.com"

        cache = {
            "employees": {"test@example.com": employee},
            "leave_dates": {("EMP-001", "2024-01-15")},
            "holiday_dates": set(),
        }

        date = datetime.date(2024, 1, 15)
        result = is_member_on_leave_or_is_holiday_cached(appointment_group, date, cache)

        self.assertTrue(result)

    def test_is_member_on_leave_or_is_holiday_cached_with_holiday_date(self):
        """Test that cached function detects holiday dates correctly"""
        appointment_group = MagicMock()
        member = MagicMock()
        member.is_mandatory = True
        member.user = "test@example.com"
        appointment_group.members = [member]

        employee = MagicMock()
        employee.name = "EMP-001"
        employee.company_email = "test@example.com"

        cache = {
            "employees": {"test@example.com": employee},
            "leave_dates": set(),
            "holiday_dates": {("EMP-001", "2024-01-15")},
        }

        date = datetime.date(2024, 1, 15)
        result = is_member_on_leave_or_is_holiday_cached(appointment_group, date, cache)

        self.assertTrue(result)

    def test_is_member_on_leave_or_is_holiday_cached_without_leave_or_holiday(self):
        """Test that cached function returns False when there's no leave or holiday"""
        appointment_group = MagicMock()
        member = MagicMock()
        member.is_mandatory = True
        member.user = "test@example.com"
        appointment_group.members = [member]

        employee = MagicMock()
        employee.name = "EMP-001"
        employee.company_email = "test@example.com"

        cache = {
            "employees": {"test@example.com": employee},
            "leave_dates": set(),
            "holiday_dates": set(),
        }

        date = datetime.date(2024, 1, 15)
        result = is_member_on_leave_or_is_holiday_cached(appointment_group, date, cache)

        self.assertFalse(result)
