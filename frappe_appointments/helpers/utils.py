import datetime
from frappe.utils import (
	get_datetime,
	convert_utc_to_system_timezone,
	get_datetime_str,
)

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
