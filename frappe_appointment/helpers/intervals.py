from datetime import datetime


def find_intersection_interval(interval1: object, interval2: object):
    """
    Find the intersection of two intervals.
    """
    start1, end1 = interval1["start_time"], interval1["end_time"]
    start2, end2 = interval2["start_time"], interval2["end_time"]

    if start1 > end2 or start2 > end1:
        return None

    return (max(start1, start2), min(end1, end2))
