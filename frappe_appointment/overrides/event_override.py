import frappe
import datetime
import requests
import json

from frappe import _
from frappe.desk.doctype.event.event import Event
from frappe.integrations.doctype.google_calendar.google_calendar import (
	get_google_calendar_object,
)
from frappe.utils import (
	get_datetime,
	now,
)
from frappe_appointment.helpers.email import send_email_template_mail
from frappe_appointment.constants import (
	APPOINTMENT_GROUP,
	USER_APPOINTMENT_AVAILABILITY,
)
from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import (
	vaild_date,
	is_valid_time_slots,
)
from frappe_appointment.helpers.utils import utc_to_sys_time

from frappe_appointment.helpers.google_calendar import (
	insert_event_in_google_calendar_override,
)


class EventOverride(Event):
	"""Event Doctype Overwrite

	Args:
	Event (class): Default class
	"""

	def before_insert(self):
		"""Handle the Appointment Group in Event"""

		if self.custom_appointment_group:
			self.appointment_group = frappe.get_doc(
				APPOINTMENT_GROUP, self.custom_appointment_group
			)
			if self.appointment_group.meet_link:
				if self.description:
					self.description = f"\nMeet Link: {self.appointment_group.meet_link}"
				else:
					self.description = f"Meet Link: {self.appointment_group.meet_link}"
			self.update_attendees_for_appointment_group()

	def before_save(self):
		super().before_save()
		self.pulled_from_google_calendar = True
		if self.custom_appointment_group:
			self.appointment_group = frappe.get_doc(
				APPOINTMENT_GROUP, self.custom_appointment_group
			)
			if self.has_value_changed("starts_on"):
				self.send_meet_email()

	def after_insert(self):
		insert_event_in_google_calendar_override(self)

	def send_meet_email(self):
		"""Sent the meeting link email to the given user using the provided Email Template"""
		appointment_group = self.appointment_group

		try:
			if (
				appointment_group.meet_link
				and appointment_group.response_email_template
				and self.event_participants
				and self.custom_doctype_link_with_event
			):

				args = dict(
					appointment_group=self.appointment_group.as_dict(),
					event=self.as_dict(),
					metadata=self.event_info,
				)

				# Only send the email to first user of custom_doctype_link_with_event
				send_doc_value = self.custom_doctype_link_with_event[0]

				send_doc = frappe.get_doc(
					send_doc_value.reference_doctype, send_doc_value.reference_docname
				)

				send_email_template_mail(
					send_doc,
					args,
					self.appointment_group.response_email_template,
					recipients=self.get_recipients_event(),
				)
		except Exception as e:
			pass

	def get_recipients_event(self):
		"""Get the list of recipients as per event_participants

		Returns:
		list: recipients emails
		"""
		if not self.event_participants:
			return []

		recipients = []

		for participant in self.event_participants:
			# Don't send the meet link to Appointment Group Members
			if participant.reference_doctype != USER_APPOINTMENT_AVAILABILITY:
				recipients.append(participant.email)

		return recipients

	def update_attendees_for_appointment_group(self):
		"""Insert Appointment Group Member as Event participants"""
		members = self.appointment_group.members

		for member in members:
			try:
				user = frappe.get_doc(
					{
						"idx": len(self.event_participants),
						"doctype": "Event Participants",
						"parent": self.name,
						"reference_doctype": USER_APPOINTMENT_AVAILABILITY,
						"reference_docname": member.user,
						"email": member.user,
						"parenttype": "Event",
						"parentfield": "event_participants",
					}
				)
				self.event_participants.append(user)
			except Exception as e:
				pass

	def handle_webhook(self, body):
		"""Handle the webhook call

		Args:
		body (object): data the send in req body
		"""

		def datetime_serializer(obj):
			"""Handle the encode datetime object in JSON"""
			if isinstance(obj, datetime.datetime):
				return obj.isoformat()

		appointment_group = frappe.get_doc(APPOINTMENT_GROUP, self.custom_appointment_group)

		if not appointment_group.webhook:
			return {"status": True, "message": ""}

		try:

			api_res = requests.post(
				appointment_group.webhook, data=json.dumps(body, default=datetime_serializer)
			).json()

			is_exc = False

			if api_res and "exc_type" in api_res:
				is_exc = True

			if not api_res or is_exc:
				messages = json.loads(api_res["_server_messages"])
				messages = json.loads(messages[0])

				if len(messages) != 0:
					messages = messages["message"]

				return {"status": False, "message": messages}

			return {"status": True, "message": ""}

		except Exception as e:
			return {"status": False, "message": "Unable to create an event"}


@frappe.whitelist(allow_guest=True)
def create_event_for_appointment_group(
	appointment_group_id: str,
	date: str,
	start_time: str,
	end_time: str,
	user_timezone_offset: str,
	event_participants,
	**args,
):
	"""API Endpoint to Create the Event

	Args:
	appointment_group_id (str): Appointment ID
	date (str): Date for which the event is scheduled
	start_time (str): Start time of the event
	end_time (str): End time of the event
	event_participants (list): List of participants
	args (object): Query Parameters of api

	Returns:
	                res (object): Result object
	"""
	# query parameters
	event_info = args

	if not is_valid_time_slots(
		appointment_group_id, date, user_timezone_offset, start_time, end_time
	):
		return frappe.throw(_("The slot is not available. Please try to book again!"))

	starts_on = utc_to_sys_time(start_time)
	ends_on = utc_to_sys_time(end_time)

	starts_on = utc_to_sys_time(start_time)
	ends_on = utc_to_sys_time(end_time)
	reschedule = event_info.get("reschedule", False)

	appointment_group = frappe.get_last_doc(
		APPOINTMENT_GROUP, filters={"route": appointment_group_id}
	)

	if not event_info.get("subject"):
		event_info["subject"] = appointment_group.name + " " + now()

	if not vaild_date(get_datetime(date), appointment_group)["is_valid"]:
		return frappe.throw(_("Invalid Date"))

	members = appointment_group.members

	if len(members) <= 0:
		return frappe.throw(_("No Member found"))

	google_calendar = frappe.get_last_doc(
		doctype="Google Calendar", filters={"user": members[0].user}
	)

	google_calendar_api_obj, account = get_google_calendar_object(google_calendar.name)

	if reschedule:
		event = frappe.get_last_doc(
			"Event", filters={"custom_appointment_group": appointment_group.name}
		)
		event.starts_on = starts_on
		event.ends_on = ends_on
		event.event_info = event_info
		event.save(ignore_permissions=True)

		if not event.handle_webhook(
			{
				"event": event.as_dict(),
				"appointment_group": appointment_group.as_dict(),
				"metadata": event_info,
			}
		):
			return frappe.throw(_("Unable to Update an event"))
		return frappe.msgprint("Interview has been Re-Scheduled.")

	calendar_event = {
		"doctype": "Event",
		"subject": event_info.get("subject"),
		"description": event_info.get("description"),
		"starts_on": starts_on,
		"ends_on": ends_on,
		"sync_with_google_calendar": 1,
		"google_calendar": account.name,
		"google_calendar_id": account.google_calendar_id,
		"pulled_from_google_calendar": 0,
		"custom_sync_participants_google_calendars": 1,
		"event_participants": json.loads(event_participants),
		"custom_doctype_link_with_event": json.loads(
			event_info.get("custom_doctype_link_with_event", "[]")
		),
		"send_reminder": 0,
		"event_type": "Private",
		"custom_appointment_group": appointment_group.name,
		"event_info": event_info,
	}

	event = frappe.get_doc(calendar_event)

	webhook_call = event.handle_webhook(
		{
			"event": event.as_dict(),
			"appointment_group": appointment_group.as_dict(),
			"metadata": event_info,
		}
	)
	if not webhook_call["status"]:
		return frappe.throw(webhook_call["message"])

	event.insert(ignore_permissions=True)

	frappe.db.commit()

	return _("Event has been created")
