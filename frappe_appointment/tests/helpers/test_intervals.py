from datetime import datetime

from frappe.tests import IntegrationTestCase

from frappe_appointment.helpers.intervals import find_intersection_interval


class TestFindIntersectionInterval(IntegrationTestCase):
    """Interval intersection helper."""

    def test_overlapping_intervals(self):
        """Overlapping intervals return (max start, min end)."""
        a = {"start_time": 1, "end_time": 5}
        b = {"start_time": 3, "end_time": 8}
        self.assertEqual(find_intersection_interval(a, b), (3, 5))
        # order of arguments does not change the intersection
        self.assertEqual(find_intersection_interval(b, a), (3, 5))

    def test_overlapping_datetimes(self):
        """Overlap also works with datetime bounds."""
        a = {"start_time": datetime(2026, 7, 1, 9, 0), "end_time": datetime(2026, 7, 1, 11, 0)}
        b = {"start_time": datetime(2026, 7, 1, 10, 0), "end_time": datetime(2026, 7, 1, 12, 0)}
        self.assertEqual(
            find_intersection_interval(a, b),
            (datetime(2026, 7, 1, 10, 0), datetime(2026, 7, 1, 11, 0)),
        )

    def test_disjoint_intervals(self):
        """Disjoint intervals return None."""
        a = {"start_time": 1, "end_time": 3}
        b = {"start_time": 5, "end_time": 8}
        self.assertIsNone(find_intersection_interval(a, b))
        self.assertIsNone(find_intersection_interval(b, a))

    def test_touching_boundary(self):
        """Intervals touching at a boundary return a degenerate single-point intersection."""
        a = {"start_time": 1, "end_time": 5}
        b = {"start_time": 5, "end_time": 8}
        self.assertEqual(find_intersection_interval(a, b), (5, 5))
