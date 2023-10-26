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


def get_weekday(date_time: datetime):
	date = date_time.date()
	return weekdays[date.weekday()]
