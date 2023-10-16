# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

import frappe
from frappe.website.website_generator import WebsiteGenerator
from frappe_appointment.constants import APPOINTMENT_GROUP, APPOINTMENT_TIME_SLOT
from frappe_appointment.frappe_appointment.doctype.appointment_time_slot.appointment_time_slot import (
	get_all_unavailable_google_calendar_slots_for_day,
	get_utc_datatime_with_time,
	convert_timezone_to_utc,
)
from dateutil import parser
from frappe.utils import getdate, get_time_str, format_time, add_to_date
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


class AppointmentGroup(WebsiteGenerator):
	website = frappe._dict(
		page_title_field="group_name"
	)

	def validate(self):
		if not self.route:
			self.route = frappe.scrub(self.group_name).replace("_", "-")

	def get_context(self, context):
		print('calll......................')
		pass


def get_list_context(context):
	return frappe.redirect("/")
 
 

@frappe.whitelist(allow_guest=True)
def get_time_slots_for_day(appointment_group_id: str, date: str) -> object:
	if not appointment_group_id:
		return {"result": []}

	appointment_group = frappe.get_doc(APPOINTMENT_GROUP, appointment_group_id)

	date = getdate(date)
	weekday = weekdays[date.weekday()]

	members = appointment_group.members

	member_time_slots = {}
	max_start_time, min_end_time = "00:00:00", "24:00:00"

	for member in members:
		if not member.is_mandatory:
			continue

		appointmen_time_slots = frappe.db.get_all(
			APPOINTMENT_TIME_SLOT, filters={"parent": member.user, "day": weekday}, fields="*"
		)

		max_start_time, min_end_time = get_max_min_time_slot(
			appointmen_time_slots, max_start_time, min_end_time
		)

		member_time_slots[member.user] = appointmen_time_slots

	starttime = get_utc_datatime_with_time(date, max_start_time)
	endtime = get_utc_datatime_with_time(date, min_end_time)

	all_slots = get_all_unavailable_google_calendar_slots_for_day(
		member_time_slots, starttime, endtime, date
	)

	avaiable_time_slot_for_day = get_avaiable_time_slot_for_day(
		all_slots, starttime, endtime, appointment_group.duration_for_event
	)

	return {
		"all_avaiable_slots_for_data": avaiable_time_slot_for_day,
		"date": date,
		"duration": appointment_group.duration_for_event,
		"appointment_group_id": appointment_group_id,
		"starttime": starttime,
		"endtime": endtime,
		"total_slots_for_day": len(avaiable_time_slot_for_day),
	}


def get_avaiable_time_slot_for_day(
	all_slots: list, starttime: datetime, endtime: datetime, duration_for_event: str
) -> list:
	available_slots = []

	index = 0
	current_start_time = starttime

	minute, second = divmod(duration_for_event.seconds, 60)
	hour, minute = divmod(minute, 60)

	current_end_time = add_to_date(
		current_start_time, hours=hour, minutes=minute, seconds=second
	)

	while current_end_time <= endtime:

		if index >= len(all_slots) and current_end_time <= endtime:
			available_slots.append(
				{"start_time": current_start_time, "end_time": current_end_time}
			)
			current_start_time = current_end_time
			current_end_time = add_to_date(
				current_start_time, hours=hour, minutes=minute, seconds=second
			)
			continue

		currernt_slot = all_slots[index]
		currernt_slot_start_time = convert_timezone_to_utc(
			currernt_slot["start"]["dateTime"], currernt_slot["start"]["timeZone"]
		)
		currernt_slot_end_time = convert_timezone_to_utc(
			currernt_slot["end"]["dateTime"], currernt_slot["end"]["timeZone"]
		)

		if current_end_time <= currernt_slot_start_time or (
			index >= len(all_slots) and current_end_time <= endtime
		):
			available_slots.append(
				{"start_time": current_start_time, "end_time": current_end_time}
			)
			current_start_time = current_end_time
		else:
			current_start_time = currernt_slot_end_time
			index += 1

		current_end_time = add_to_date(
			current_start_time, hours=hour, minutes=minute, seconds=second
		)

	return available_slots


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
