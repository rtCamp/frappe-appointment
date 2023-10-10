# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe_appointment.constants import APPOINTMENT_GROUP, APPOINTMENT_TIME_SLOT
from frappe.utils import getdate, get_time_str, format_time
import datetime

weekdays = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
]


class AppointmentGroup(Document):
	pass


@frappe.whitelist(allow_guest=True)
def get_time_slots_for_day(appointment_group_id: str, date: str):
	if not appointment_group_id:
		return {"result": []}

	appointment_group = frappe.get_doc(APPOINTMENT_GROUP, appointment_group_id)

	date = getdate(date)
	weekday = weekdays[date.weekday()]

	members = appointment_group.members

	member_time_slots = {}
	max_start_time, min_end_time = "00:00:00", "24:00:00"

	for member in members:
		appointmen_time_slots = frappe.db.get_all(
			APPOINTMENT_TIME_SLOT, filters={"parent": member.user, "day": weekday}, fields="*"
		)
		print(appointmen_time_slots)

		max_start_time, min_end_time = get_max_min_time_slot(
			appointmen_time_slots, max_start_time, min_end_time
		)

		member_time_slots[member.user] = appointmen_time_slots
  
	return min_end_time


def get_max_min_time_slot(
	appointmen_time_slots: list, max_start_time: str, min_end_time: str
) -> list:

	for appointmen_time_slot in appointmen_time_slots:
		max_start_time = max(
			max_start_time, format_time(get_time_str(appointmen_time_slot.start_time))
		)
		min_end_time = min(
			min_end_time, format_time(get_time_str(appointmen_time_slot.end_time))
		)

	return [max_start_time, min_end_time]
