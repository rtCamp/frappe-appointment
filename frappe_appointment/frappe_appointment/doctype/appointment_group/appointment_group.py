# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe_appointment.constants import APPOINTMENT_GROUP
from frappe.utils import (
	getdate,
	
)

weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

class AppointmentGroup(Document):
	pass


@frappe.whitelist(allow_guest=True)
def get_time_slots_for_day(appointment_group_id: str, date: str):
	if not appointment_group_id:
		return {"result": []}

	appointment_group= frappe.get_doc(APPOINTMENT_GROUP,appointment_group_id)
	
	datetime=getdate(date)
	weekday=datetime.weekday()
 
	return weekday

	
