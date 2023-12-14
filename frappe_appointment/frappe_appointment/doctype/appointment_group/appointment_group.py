# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

import frappe
from frappe.website.website_generator import WebsiteGenerator
from frappe_appointment.constants import APPOINTMENT_GROUP, APPOINTMENT_TIME_SLOT
from frappe_appointment.frappe_appointment.doctype.appointment_time_slot.appointment_time_slot import (
	get_all_unavailable_google_calendar_slots_for_day,
	get_utc_datatime_with_time,
	convert_timezone_to_utc,
	convert_datetime_to_utc,
 
)
from dateutil import parser
from frappe_appointment.helpers.utils import get_weekday,utc_to_given_time_zone
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
		context["group_name"] = " ".join(context["group_name"].split("-")).title()
		return context


def get_list_context(context):
	"""List page context for 'Appointment Group' and ensure that this page is not functional.

	Args:
		context (Object): Context of page
	"""
	return frappe.redirect("/")


@frappe.whitelist(allow_guest=True)
def get_time_slots_for_day(appointment_group_id: str, date: str, user_timezone_offset:str) -> object:
	"""API endpoint for fetch the google time slots for user

	Args:
		appointment_group_id (str): Appointment Group ID
		date (str): Date for which need to fetch slots
  
	Returns:
		object: Response
	"""
	try:
		if not appointment_group_id:
			return {"result": []}

		appointment_group = frappe.get_last_doc(
			APPOINTMENT_GROUP, filters={"route": appointment_group_id}
		)
  
		datetime_today = get_datetime(date)
		datetime_tomorrow = add_days(datetime_today,1)
		datetime_yesterday = add_days(datetime_today,-1)
  
		all_time_slots_global_object={}
		
		if int(user_timezone_offset)>0:
			all_time_slots_global_object={
				"yesterday":get_time_slots_for_given_date(appointment_group,datetime_yesterday),
				"today":get_time_slots_for_given_date(appointment_group,datetime_today),
			}
		else: 
			all_time_slots_global_object={
				"today":get_time_slots_for_given_date(appointment_group,datetime_today),
				"tomorrow":get_time_slots_for_given_date(appointment_group,datetime_tomorrow)
			}
   
  
		user_time_slots=get_user_time_slots(all_time_slots_global_object, date, user_timezone_offset)

		time_slots_today_object=all_time_slots_global_object["today"]
		time_slots_today_object["all_available_slots_for_data"]=user_time_slots
  
		return time_slots_today_object
		
	except Exception as e:
		raise Exception(e)
		return None


def get_user_time_slots(all_time_slots_global_object:list, date:str, user_timezone_offset:str):
	list_all_available_slots_for_data=[]
  
	today=int(date.split("-")[2])
	
	for day in all_time_slots_global_object:
		day_slots_object=all_time_slots_global_object[day]
		all_available_slots_for_data=day_slots_object["all_available_slots_for_data"]

		for time_slot in all_available_slots_for_data:
			user_timezone_start_time_slot=utc_to_given_time_zone(time_slot["start_time"],user_timezone_offset)
			if user_timezone_start_time_slot.day==today:
				list_all_available_slots_for_data.append(time_slot)

	return list_all_available_slots_for_data


def is_valid_time_slots(appointment_group_id: str, date: str, user_timezone_offset:str,start_time:str,end_time:str):
	today_time_slots=get_time_slots_for_day(appointment_group_id,date,user_timezone_offset)
	
	if not today_time_slots:
		return False
	
	all_available_slots_for_data=today_time_slots["all_available_slots_for_data"]
	
	start_time=datetime.datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S%z")
	end_time=datetime.datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S%z")
	
	for time_slot in all_available_slots_for_data:
		if time_slot["start_time"]==start_time and time_slot["end_time"]==end_time:
			return True

	return False

def get_time_slots_for_given_date(appointment_group: object, datetime: str):
	date = datetime.date()
	weekday = get_weekday(datetime)

	date_validation_obj = vaild_date(datetime, appointment_group)

	weekend_availability = check_weekend_availability(
		appointment_group.enable_scheduling_on_weekends, weekday, date_validation_obj
	)

	if weekend_availability["is_invalid_date"]:
		return get_response_body(
			avaiable_time_slot_for_day=[],
			appointment_group=appointment_group,
			date=date,
			date_validation_obj=weekend_availability["date_validation_obj"],
			is_invalid_date=True,
		)

	booking_frequency_reached_obj = get_booking_frequency_reached(
		datetime, appointment_group
	)

	if not booking_frequency_reached_obj["is_slots_available"]:
		return get_response_body(
			avaiable_time_slot_for_day=[],
			appointment_group=appointment_group,
			date=date,
			date_validation_obj=date_validation_obj,
		)

	members = appointment_group.members

	member_time_slots = {}
	max_start_time, min_end_time = "00:00:00", "24:00:00"

	for member in members:
		if not member.is_mandatory:
			continue

		appointment_time_slots = frappe.db.get_all(
			APPOINTMENT_TIME_SLOT, filters={"parent": member.user, "day": weekday}, fields="*"
		)

		max_start_time, min_end_time = get_max_min_time_slot(
			appointment_time_slots, max_start_time, min_end_time
		)

		member_time_slots[member.user] = appointment_time_slots

	starttime = get_utc_datatime_with_time(date, max_start_time)
	endtime = get_utc_datatime_with_time(date, min_end_time)

	all_slots = get_all_unavailable_google_calendar_slots_for_day(
		member_time_slots, starttime, endtime, date, appointment_group
	)

	if all_slots == False:
		return get_response_body(
			avaiable_time_slot_for_day=[],
			appointment_group=appointment_group,
			date=date,
			date_validation_obj=date_validation_obj,
		)

	all_slots = update_cal_slots_with_events(
		all_slots, booking_frequency_reached_obj["events"]
	)

	avaiable_time_slot_for_day = get_avaiable_time_slot_for_day(
		all_slots, starttime, endtime, appointment_group
	)

	return get_response_body(
		avaiable_time_slot_for_day=avaiable_time_slot_for_day,
		appointment_group=appointment_group,
		starttime=starttime,
		endtime=endtime,
		date=date,
		date_validation_obj=date_validation_obj,
	)

def check_weekend_availability(
	enable_scheduling_on_weekends: bool, weekday: str, date_validation_obj: object
):
	"""
	Check if data is valid with a weekend check. If enable_scheduling_on_weekends is True, then the date will be the next available date except on weekends.

	Args:
		enable_scheduling_on_weekends (bool): Boolean to check if scheduling is enabled on weekends.
		weekday (str): Weekday Name
		date_validation_obj (object): Date Object

	Returns:
		Object: Object with a valid start date
	"""
	res = {
		"is_invalid_date": not date_validation_obj["is_valid"],
		"date_validation_obj": date_validation_obj,
	}

	if enable_scheduling_on_weekends:
		return res

	if not res["is_invalid_date"]:
		res["is_invalid_date"] = weekday == "Saturday" or weekday == "Sunday"

	start_day_week_day = get_weekday(date_validation_obj["valid_start_date"])

	day_to_add = 0

	if start_day_week_day == "Saturday":
		day_to_add = 2
	elif start_day_week_day == "Sunday":
		day_to_add = 1

	date_validation_obj["valid_start_date"] = add_days(
		date_validation_obj["valid_start_date"], day_to_add
	)

	res["date_validation_obj"] = date_validation_obj

	return res


def get_response_body(
	avaiable_time_slot_for_day: list,
	appointment_group: object,
	starttime: datetime = None,
	endtime: datetime = None,
	date: datetime = None,
	date_validation_obj: object = None,
	is_invalid_date: bool = False,
):
	"""
	Generate the API Response object for the API endpoint: get_time_slots_for_day

	Args:
		available_time_slots_for_day (list): List of available time slots for the user
		appointment_group (object): Appointment Group ID
		starttime (datetime, optional): Start Time for Events. Defaults to None.
		endtime (datetime, optional): End Time for Events. Defaults to None.
		date (datetime, optional): Date for which slots are fetched. Defaults to None.
		date_validation_obj (object, optional): Date validation object. Defaults to None.
		is_invalid_date (bool, optional): Is the given date invalid or not. Defaults to False.

	Returns:
		Object: API Response object
	"""
	if not date_validation_obj:
		date_validation_obj = {"valid_start_date": None, "valid_end_date": None}

	return {
		"all_available_slots_for_data": avaiable_time_slot_for_day,
		"date": date,
		"duration": appointment_group.duration_for_event,
		"appointment_group_id": appointment_group.name,
		"starttime": starttime,
		"endtime": endtime,
		"total_slots_for_day": len(avaiable_time_slot_for_day),
		"valid_start_date": date_validation_obj["valid_start_date"],
		"valid_end_date": date_validation_obj["valid_end_date"],
		"enable_scheduling_on_weekends": appointment_group.enable_scheduling_on_weekends,
		"is_invalid_date": is_invalid_date,
	}


def get_booking_frequency_reached(
	datetime: datetime, appointment_group: object
) -> bool:
	"""
	Get a list of booked events from Frappe for a given date and Appointment Group.

	Args:
		datetime (datetime): Datetime object of the time for which events need to be fetched.
		appointment_group (object): Appointment Group

	Returns:
		Object: List of events
	"""
	res = {
		"is_slots_available": int(appointment_group.limit_booking_frequency) < 0,
		"events": [],
	}

	# Get today's data and the range for the next day to fetch events.
	start_datetime, end_datetime = get_datetime_str(datetime), get_datetime_str(
		add_days(datetime, 1)
	)

	all_events = frappe.get_list(
		"Event",
		filters=[
			["custom_appointment_group", "=", appointment_group.name],
			["starts_on", ">=", start_datetime],
			["starts_on", "<", end_datetime],
			["ends_on", ">=", start_datetime],
			["ends_on", "<", end_datetime],
		],
		fields=["starts_on", "ends_on"],
		order_by="starts_on asc",
		ignore_permissions=True
	)

	all_events = sorted(
		all_events,
		key=lambda slot: get_datetime_str(slot["ends_on"]),
	)

	if int(appointment_group.limit_booking_frequency) >= 0:
		res["is_slots_available"] = len(all_events) < int(
			appointment_group.limit_booking_frequency
		)

	res["events"] = all_events

	return res


def vaild_date(date: datetime, appointment_group: object) -> object:
	"""
	Check if the given date is valid or not and return an object with valid start and end dates.

	Args:
		date (datetime): Date
		appointment_group (object): Appointment Group

	Returns:
		Object: Object that holds data for valid start and end dates
	"""
	current_date = get_datetime(datetime.datetime.utcnow().date())

	start_date = add_days(current_date, int(appointment_group.minimum_notice_before_event))
	end_date = ""

	# Add the days == event_availability_window into start_date date
	if int(appointment_group.event_availability_window) > 0:
		end_date = add_days(start_date, int(appointment_group.event_availability_window) - 1)

	if start_date > date:
		return {"is_valid": False, "valid_start_date": start_date, "valid_end_date": end_date}

	if int(appointment_group.event_availability_window) > 0 and end_date < date:
		return {"is_valid": False, "valid_start_date": start_date, "valid_end_date": end_date}

	return {"is_valid": True, "valid_start_date": start_date, "valid_end_date": end_date}


def update_cal_slots_with_events(all_slots: list, all_events: list) -> list:
	"""
	Function to take all Frappe events and all Google Calendar available time slots and create a new list where each slot has a boolean 'is_frappe_event' to show if the given event is a Frappe event or not.

	Args:
		all_slots (list): List of all Google slots available
		all_events (list): List of all Frappe Events

	Returns:
		List: List of all slots with the 'is_frappe_event' check
	"""
	update_slots = []
	for currernt_slot in all_slots:
		updated_slot = {}
		updated_slot["is_frappe_event"] = False
		updated_slot["starts_on"] = convert_timezone_to_utc(
			currernt_slot["start"]["dateTime"], currernt_slot["start"]["timeZone"]
		)
		updated_slot["ends_on"] = convert_timezone_to_utc(
			currernt_slot["end"]["dateTime"], currernt_slot["end"]["timeZone"]
		)
		for event in all_events:
			# Compare the start and end date of event and slots
			if convert_datetime_to_utc(event["starts_on"]) == updated_slot[
				"starts_on"
			] and updated_slot["ends_on"] == convert_datetime_to_utc(event["ends_on"]):
				updated_slot["is_frappe_event"] = True
				break

		update_slots.append(updated_slot)

	return update_slots


def get_avaiable_time_slot_for_day(
	all_slots: list, starttime: datetime, endtime: datetime, appointment_group: object
) -> list:
	"""Generate time available time slots for a given date based on Google slots within the range [starttime, endtime].

	Args:
		all_slots (list): All Google slots
		starttime (datetime): Start time from which slots should be generated
		endtime (datetime): End time until which slots should be generated
		appointment_group (object): Appointment Group

	Returns:
		list: List of available slots
	"""
	available_slots = []

	index = 0

	minimum_buffer_time = appointment_group.minimum_buffer_time
	
	# Start time of event
	current_start_time = get_next_round_value(minimum_buffer_time, starttime, False)

	minute, second = divmod(appointment_group.duration_for_event.seconds, 60)
	hour, minute = divmod(minute, 60)

	current_end_time = add_to_date(
		current_start_time, hours=hour, minutes=minute, seconds=second
	)

	# This will make sure that slots will be genrate even though we reach at end of all_slots
	while current_end_time <= endtime:

		if index >= len(all_slots) and current_end_time <= endtime:
	  
			available_slots.append(
				{"start_time": current_start_time, "end_time": current_end_time}
			)

			current_start_time = get_next_round_value(minimum_buffer_time, current_end_time)
			current_end_time = add_to_date(
				current_start_time, hours=hour, minutes=minute, seconds=second
			)

			continue

		currernt_slot = all_slots[index]
		currernt_slot_start_time = currernt_slot["starts_on"]
		currernt_slot_end_time = currernt_slot["ends_on"]

		if current_end_time <= currernt_slot_start_time and is_valid_buffer_time(
			minimum_buffer_time,
			current_end_time,
			currernt_slot_start_time,
			currernt_slot["is_frappe_event"],
		):
			available_slots.append(
				{"start_time": current_start_time, "end_time": current_end_time}
			)
			current_start_time = get_next_round_value(minimum_buffer_time, current_end_time)
		else:
			current_start_time = get_next_round_value(
				minimum_buffer_time, currernt_slot_end_time, currernt_slot["is_frappe_event"]
			)
			index += 1

		current_end_time = add_to_date(
			current_start_time, hours=hour, minutes=minute, seconds=second
		)

	return available_slots


def is_valid_buffer_time(
	minimum_buffer_time: datetime,
	end: datetime,
	next_start: datetime,
	is_add_buffer_in_event: bool = True,
):
	"""Check if the time difference between the next time slot and the current time slot meets the minimum_buffer_time requirement.

	Args:
		minimum_buffer_time (datetime): Minimum buffer time to maintain
		end (datetime): End time of the current time slot
		next_start (datetime): Start time of the next time slot
		is_add_buffer_in_event (bool, optional): Whether to add buffer time in the current slot. Defaults to True.

	Returns:
		bool: True if the buffer time is maintained, False otherwise
	"""
	if not minimum_buffer_time or not is_add_buffer_in_event:
		return True

	return minimum_buffer_time.seconds <= (next_start - end).seconds


def get_next_round_value(
	minimum_buffer_time: datetime,
	current_end_time: datetime,
	is_add_buffer_in_event: bool = True,
):
	"""Generate the next possible start time for an event as per the buffer time value.

	Args:
		minimum_buffer_time (datetime): Minimum buffer time to maintain
		current_end_time (datetime): Start time of the current slot
		is_add_buffer_in_event (bool, optional): Whether to add buffer time in the current slot. Defaults to True.

	Returns:
		Datetime: Next slot possible start time
	"""
	if not minimum_buffer_time or not is_add_buffer_in_event:
		return current_end_time

	minute, second = divmod(minimum_buffer_time.seconds, 60)
	hour, minute = divmod(minute, 60)

	min_start_time = add_to_date(
		current_end_time, hours=hour, minutes=minute, seconds=second
	)

	return min_start_time


def get_max_min_time_slot(
	appointmen_time_slots: list, max_start_time: str, min_end_time: str
) -> list:
	"""Select the maximum between the given start time and appointment_time_slots start time, and the minimum between the given end time and appointment_time_slots end time.

	Args:
	appointment_time_slots (list): Appointment time slots
	max_start_time (str): Max start time
	min_end_time (str): Min end time

	Returns:
	list: Updated list of start time and min end time
	"""

	for appointmen_time_slot in appointmen_time_slots:
		max_start_time = max(
			max_start_time, format_time(get_time_str(appointmen_time_slot.start_time))
		)
		min_end_time = min(
			min_end_time, format_time(get_time_str(appointmen_time_slot.end_time))
		)

	return [max_start_time, min_end_time]
