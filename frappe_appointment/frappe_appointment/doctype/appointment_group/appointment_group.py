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
from frappe.utils import (
	getdate,
	get_time_str,
	format_time,
	add_to_date,
	now_datetime,
	add_days,
	get_datetime,
	get_date_str,
	get_datetime_str,
)
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
		page_title_field="group_name",
		no_cache=1,
		no_breadcrumbs=1,
	)

	def validate(self):
		if not self.route:
			self.route = frappe.scrub(self.group_name).replace("_", "-")

	def get_context(self, context):
		return context


def get_list_context(context):
	return frappe.redirect("/")


@frappe.whitelist(allow_guest=True)
def get_time_slots_for_day(appointment_group_id: str, date: str) -> object:
	try:
		if not appointment_group_id:
			return {"result": []}

		appointment_group = frappe.get_last_doc(
			APPOINTMENT_GROUP, filters={"route": appointment_group_id}
		)

		datetime = get_datetime(date)
		date = datetime.date()

		date_validation_obj = vaild_date(datetime, appointment_group)

		if not date_validation_obj["is_valid"]:
			return {
				"appointment_group_id": appointment_group_id,
				"valid_start_date": date_validation_obj["valid_start_date"],
				"valid_end_date": date_validation_obj["valid_end_date"],
				"total_slots_for_day": 0,
				"is_invalid_date": True,
			}
		if booking_frequency_reached(datetime,appointment_group):
			return {
				"all_avaiable_slots_for_data": [],
				"date": date,
				"duration": appointment_group.duration_for_event,
				"appointment_group_id": appointment_group_id,
				"total_slots_for_day": 0,
				"valid_start_date": date_validation_obj["valid_start_date"],
				"valid_end_date": date_validation_obj["valid_end_date"],
			}

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
			"valid_start_date": date_validation_obj["valid_start_date"],
			"valid_end_date": date_validation_obj["valid_end_date"],
		}
	except Exception as e:
		return None


def booking_frequency_reached(datetime: datetime, appointment_group: object) -> bool:
	if (
		int(appointment_group.limit_booking_frequency) < 0
	):
		return False

	start_datetime, end_datetime = get_datetime_str(datetime), get_datetime_str(
		add_days(datetime, 1)
	)

	all_events = frappe.get_all(
		"Event",
		filters=[
			["starts_on", ">=", start_datetime],
			["starts_on", "<", end_datetime],
			["ends_on", ">=", start_datetime],
			["ends_on", "<", end_datetime],
		],
		fields=["starts_on", "ends_on"],
	)

	return len(all_events) >= int(appointment_group.limit_booking_frequency)


def vaild_date(date: datetime, appointment_group: object) -> bool:
	current_date = get_datetime(now_datetime().date())

	start_date = add_days(current_date, int(appointment_group.minimum_notice_before_event))
	end_date = add_days(start_date, int(appointment_group.event_availability_window))

	if start_date > date:
		return {"is_valid": False, "valid_start_date": start_date, "valid_end_date": end_date}

	if int(appointment_group.event_availability_window) > 0 and end_date < date:
		return {"is_valid": False, "valid_start_date": start_date, "valid_end_date": end_date}

	if int(appointment_group.event_availability_window) <= 0:
		end_date = ""

	return {"is_valid": True, "valid_start_date": start_date, "valid_end_date": end_date}


def get_avaiable_time_slot_for_day(
	all_slots: list, starttime: datetime, endtime: datetime, duration_for_event: str
) -> list:
	available_slots = []

	index = 0

	current_start_time = get_next_round_value(starttime)

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
			current_start_time = get_next_round_value(current_end_time)
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

		if current_end_time <= currernt_slot_start_time:
			available_slots.append(
				{"start_time": current_start_time, "end_time": current_end_time}
			)
			current_start_time = get_next_round_value(current_end_time)
		else:
			current_start_time = get_next_round_value(currernt_slot_end_time)
			index += 1

		current_end_time = add_to_date(
			current_start_time, hours=hour, minutes=minute, seconds=second
		)

	return available_slots


def get_next_round_value(datetimeobj: datetime):
	if datetimeobj.minute == 0:
		return datetimeobj

	next_datetimeobj = add_to_date(datetimeobj, hours=1)
	return next_datetimeobj.replace(minute=0, second=0)


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
