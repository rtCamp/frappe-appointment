import datetime
from frappe.utils import (
	get_datetime,
	convert_utc_to_system_timezone,
	get_datetime_str,
)
import pytz

weekdays = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
]


def get_weekday(date_time: datetime) -> str:
	date = date_time.date()
	return weekdays[date.weekday()]


def utc_to_sys_time(time: str) -> str:
	return get_datetime_str(
		convert_utc_to_system_timezone(
			datetime.datetime.fromisoformat(time).replace(tzinfo=None)
		)
	)


def utc_to_given_time_zone(utc_datetime: datetime, time_zone_offset:str) -> str:
    
	# utc_date_time = datetime.datetime.strptime(utc_string, "%Y-%m-%d %H:%M:%S%z")

	converted_datetime = utc_datetime.astimezone(pytz.FixedOffset(int(time_zone_offset)))
 
	return converted_datetime
