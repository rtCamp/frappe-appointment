# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

from datetime import datetime

import frappe
from frappe.model.document import Document
from frappe.utils.data import add_to_date

from frappe_appointment.constants import APPOINTMENT_TIME_SLOT
from frappe_appointment.helpers.intervals import find_intersection_interval
from frappe_appointment.helpers.utils import (
    convert_datetime_to_utc,
    convert_utc_datetime_to_timezone,
    get_weekday,
    update_time_of_datetime,
)


class UserAppointmentAvailability(Document):
    pass


def get_user_appointment_availability_slots(
    appointment_group: object, utc_start_time: datetime, utc_end_time: datetime
):
    members = appointment_group.members

    member_time_slots = {}

    global_interval = {
        "start_time": utc_start_time,
        "end_time": utc_end_time,
    }

    for member in members:
        if not member.is_mandatory:
            continue

        user_timezone = frappe.get_value("User", member.user, "time_zone")

        current_date = utc_start_time

        while current_date.date() <= utc_end_time.date():
            current_date_time = convert_utc_datetime_to_timezone(
                current_date, user_timezone
            )
            weekday = get_weekday(current_date_time)

            appointment_time_slots = frappe.db.get_all(
                APPOINTMENT_TIME_SLOT,
                filters={"parent": member.user, "day": weekday},
                fields="*",
            )

            user_appointment_time_slots_utc = []

            for slot in appointment_time_slots:
                interval = {
                    "start_time": convert_datetime_to_utc(
                        update_time_of_datetime(current_date_time, slot.start_time)
                    ),
                    "end_time": convert_datetime_to_utc(
                        update_time_of_datetime(
                            current_date_time,
                            slot.end_time,
                        )
                    ),
                }

                interval = find_intersection_interval(interval, global_interval)

                if interval:
                    user_appointment_time_slots_utc.append(
                        {
                            "start_time": interval[0],
                            "end_time": interval[1],
                            "is_available": True,
                        }
                    )

            if member.user in member_time_slots:
                member_time_slots[member.user] += user_appointment_time_slots_utc
            else:
                member_time_slots[member.user] = user_appointment_time_slots_utc

            current_date = add_to_date(current_date, days=1)

    member_time_slots["tem"] = {
        "start_time": utc_start_time,
        "end_time": utc_end_time,
        "is_available": True,
    }

    return member_time_slots
