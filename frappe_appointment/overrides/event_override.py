import datetime
import json

import frappe
import frappe.utils
import requests
from frappe import _, clear_messages
from frappe.desk.doctype.event.event import Event
from frappe.integrations.doctype.google_calendar.google_calendar import (
    get_google_calendar_object,
)
from frappe.twofactor import decrypt, encrypt
from frappe.utils import get_datetime, now

from frappe_appointment.constants import (
    APPOINTMENT_GROUP,
    USER_APPOINTMENT_AVAILABILITY,
)
from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import (
    is_valid_time_slots,
    vaild_date,
)
from frappe_appointment.helpers.email import send_email_template_mail
from frappe_appointment.helpers.google_calendar import (
    insert_event_in_google_calendar_override,
)
from frappe_appointment.helpers.ics_file import add_ics_file_in_attachment
from frappe_appointment.helpers.utils import utc_to_sys_time
from frappe_appointment.helpers.zoom import create_meeting, delete_meeting, update_meeting


class EventOverride(Event):
    """Event Doctype Overwrite

    Args:
    Event (class): Default class
    """

    def before_insert(self):
        """Handle the Appointment Group in Event"""
        if self.custom_appointment_group:
            self.appointment_group = frappe.get_doc(APPOINTMENT_GROUP, self.custom_appointment_group)
            self.custom_meeting_provider = self.appointment_group.meet_provider
            if self.appointment_group.meet_provider == "Zoom":
                meet_url, meet_data = create_meeting(
                    self.appointment_group.event_creator,
                    self.subject,
                    self.starts_on,
                    self.appointment_group.duration_for_event.seconds // 60,
                    self.description,
                )
                self.description = f"{self.description or ''}\nMeet Link: {meet_url}"
                self.custom_meet_link = meet_url
                self.custom_meet_data = json.dumps(meet_data, indent=4)
            elif self.appointment_group.meet_provider == "Google Meet":
                self.add_video_conferencing = 1
            elif self.appointment_group.meet_provider == "Custom" and self.appointment_group.meet_link:
                if self.description:
                    self.description = f"\nMeet Link: {self.appointment_group.meet_link}"
                else:
                    self.description = f"Meet Link: {self.appointment_group.meet_link}"
                self.custom_meet_link = self.appointment_group.meet_link
            self.update_attendees_for_appointment_group()
        elif self.custom_user_calendar:
            self.user_calendar = frappe.get_doc(USER_APPOINTMENT_AVAILABILITY, self.custom_user_calendar)
            self.custom_meeting_provider = self.user_calendar.meeting_provider
            if not self.custom_appointment_slot_duration:
                raise frappe.ValidationError(_("Appointment Slot Duration is required"))
            self.appointment_slot_duration = frappe.get_doc(
                "Appointment Slot Duration", self.custom_appointment_slot_duration
            )

            if self.user_calendar.meeting_provider == "Zoom":
                meet_url, meet_data = create_meeting(
                    self.user_calendar.google_calendar,
                    self.subject,
                    self.starts_on,
                    self.appointment_slot_duration.duration // 60,
                    self.description,
                )
                self.description = f"{self.description or ''}\nMeet Link: {meet_url}"
                self.custom_meet_link = meet_url
                self.custom_meet_data = json.dumps(meet_data, indent=4)
            elif self.user_calendar.meeting_provider == "Google Meet":
                self.add_video_conferencing = 1
            elif self.user_calendar.meeting_provider == "Custom" and self.user_calendar.meeting_link:
                if self.description:
                    self.description = f"\nMeet Link: {self.user_calendar.meeting_link}"
                else:
                    self.description = f"Meet Link: {self.user_calendar.meeting_link}"
                self.custom_meet_link = self.user_calendar.meeting_link
            self.appointment_group = frappe.get_doc(
                {
                    "doctype": "Appointment Group",
                    "group_name": "Personal Meeting",
                    "event_creator": self.user_calendar.get("google_calendar"),
                    "event_organizer": self.user_calendar.get("user"),
                    "members": [{"user": self.user_calendar.get("name"), "is_mandatory": 1}],
                    "duration_for_event": datetime.timedelta(seconds=self.appointment_slot_duration.duration),
                    "minimum_buffer_time": datetime.timedelta(
                        seconds=self.appointment_slot_duration.minimum_buffer_time
                    )
                    if self.appointment_slot_duration.minimum_buffer_time
                    else None,
                    "minimum_notice_before_event": self.appointment_slot_duration.minimum_notice_before_event,
                    "event_availability_window": self.appointment_slot_duration.availability_window,
                    "meet_provider": self.user_calendar.get("meeting_provider"),
                    "meet_link": self.user_calendar.get("meeting_link"),
                    "response_email_template": self.user_calendar.get("response_email_template"),
                    "linked_doctype": self.user_calendar.get("name"),
                    "limit_booking_frequency": -1,
                }
            )
            self.update_attendees_for_appointment_group()

    def after_insert(self):
        pass  # This exists to prevent errors in derived classes.

    def before_save(self):
        super().before_save()
        if self.is_new():
            _, updates = insert_event_in_google_calendar_override(self, update_doc=False)
            for key, value in updates.items():
                self.set(key, value)
        self.pulled_from_google_calendar = True
        if self.custom_appointment_group or self.custom_user_calendar:
            self.appointment_group = self.custom_appointment_group and frappe.get_doc(
                APPOINTMENT_GROUP, self.custom_appointment_group
            )
            self.user_calendar = self.custom_user_calendar and frappe.get_doc(
                USER_APPOINTMENT_AVAILABILITY, self.custom_user_calendar
            )

            if self.has_value_changed("starts_on"):
                if not self.is_new():
                    if self.custom_meeting_provider == "Zoom":
                        meet_data = json.loads(self.custom_meet_data)
                        meet_id = meet_data.get("id")
                        duration = frappe.utils.time_diff(self.ends_on, self.starts_on).seconds // 60
                        update_meeting(
                            self.appointment_group.event_creator
                            if self.appointment_group
                            else self.user_calendar.google_calendar,
                            meet_id,
                            self.subject,
                            self.starts_on,
                            duration,
                            self.description,
                        )
                frappe.enqueue(
                    send_meet_email,
                    timeout=600,
                    enqueue_after_commit=True,
                    job_name=f"Send interview time slot book response email: {self.name}",
                    queue="long",
                    doc=self,
                    appointment_group=self.appointment_group,
                    user_calendar=self.user_calendar,
                    metadata=self.event_info if hasattr(self, "event_info") else {},
                )

    def on_trash(self):
        if self.custom_meeting_provider == "Zoom":
            meet_data = json.loads(self.custom_meet_data)
            meet_id = meet_data.get("id")
            self.appointment_group = None
            self.user_calendar = None
            if self.custom_appointment_group:
                self.appointment_group = frappe.get_doc(APPOINTMENT_GROUP, self.custom_appointment_group)
            if self.custom_user_calendar:
                self.user_calendar = frappe.get_doc(USER_APPOINTMENT_AVAILABILITY, self.custom_user_calendar)
            delete_meeting(
                self.appointment_group.event_creator if self.appointment_group else self.user_calendar.google_calendar,
                meet_id,
            )
        super().on_trash()

    def on_update(self):
        self.sync_communication()  # Overrided this because we have made reference doctype and name mandatory in Event Participants

    def sync_communication(self):
        if self.event_participants:
            for participant in self.event_participants:
                if not participant.reference_doctype or not participant.reference_docname:
                    continue
                filters = [
                    ["Communication", "reference_doctype", "=", self.doctype],
                    ["Communication", "reference_name", "=", self.name],
                    ["Communication Link", "link_doctype", "=", participant.reference_doctype],
                    ["Communication Link", "link_name", "=", participant.reference_docname],
                ]
                if comms := frappe.get_all("Communication", filters=filters, fields=["name"], distinct=True):
                    for comm in comms:
                        communication = frappe.get_doc("Communication", comm.name)
                        self.update_communication(participant, communication)
                else:
                    meta = frappe.get_meta(participant.reference_doctype)
                    if hasattr(meta, "allow_events_in_timeline") and meta.allow_events_in_timeline == 1:
                        self.create_communication(participant)

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
            if (
                participant.reference_doctype != USER_APPOINTMENT_AVAILABILITY
                and participant.reference_doctype != "Google Calendar"
            ):
                recipients.append(participant.email)

        return recipients

    def update_attendees_for_appointment_group(self):
        """Insert Appointment Group Member as Event participants"""
        if not self.appointment_group:
            return

        members = self.appointment_group.members

        google_calendar_api_obj, account = get_google_calendar_object(self.appointment_group.event_creator)

        idx = len(self.event_participants) + 1

        for member in members:
            try:
                if member.user == account.user:
                    continue

                user = frappe.get_doc(
                    {
                        "idx": idx,
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
                idx += 1
            except Exception:
                pass

        user = frappe.get_doc(
            {
                "idx": idx,
                "doctype": "Event Participants",
                "parent": self.name,
                "reference_doctype": "Google Calendar",
                "reference_docname": account.name,
                "email": account.user,
                "parenttype": "Event",
                "parentfield": "event_participants",
            }
        )
        self.event_participants.append(user)

    def handle_webhook(self, body):
        """Handle the webhook call

        Args:
        body (object): data the send in req body
        """

        def datetime_serializer(obj):
            """Handle the encode datetime object in JSON"""
            if isinstance(obj, datetime.datetime):
                return obj.isoformat()

        if not self.custom_appointment_group:
            return {"status": True, "message": ""}

        appointment_group = frappe.get_doc(APPOINTMENT_GROUP, self.custom_appointment_group)

        if not appointment_group.webhook:
            return {"status": True, "message": ""}

        try:
            is_frappe_function = False
            try:
                webhook_function = frappe.get_attr(appointment_group.webhook)
                if not webhook_function:
                    raise Exception
                is_frappe_function = True
            except Exception:
                # clear last message
                frappe.clear_last_message()

            if is_frappe_function:
                try:
                    api_res = webhook_function(**body)
                except Exception as e:
                    return {"status": False, "message": str(e)}
            else:
                api_res = requests.post(
                    appointment_group.webhook,
                    data=json.dumps(body, default=datetime_serializer),
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

        except Exception:
            return {"status": False, "message": "Unable to create an event"}


def send_meet_email(doc, appointment_group, user_calendar, metadata):
    """Sent the meeting link email to the given user using the provided Email Template"""
    doc.reload()

    try:
        if (
            doc.custom_meet_link
            and (
                (appointment_group and appointment_group.response_email_template)
                or (user_calendar and user_calendar.response_email_template)
            )
            and doc.event_participants
            and doc.custom_doctype_link_with_event
        ):
            ag_dict = appointment_group.as_dict() if appointment_group else user_calendar.as_dict()
            ag_dict["meet_link"] = doc.custom_meet_link  # For backward compatibility

            args = dict(
                appointment_group=ag_dict,
                meet_link=doc.custom_meet_link,
                event=doc.as_dict(),
                metadata=metadata,
            )

            # Only send the email to first user of custom_doctype_link_with_event
            send_doc_value = doc.custom_doctype_link_with_event[0]

            send_doc = frappe.get_doc(send_doc_value.reference_doctype, send_doc_value.reference_docname)

            send_email_template_mail(
                send_doc,
                args,
                appointment_group.response_email_template
                if appointment_group
                else user_calendar.response_email_template,
                recipients=doc.get_recipients_event(),
                attachments=[{"fid": add_ics_file_in_attachment(doc)}],
            )

            frappe.db.commit()
    except Exception:
        frappe.log_error(title="Interview time slot book response email error " + doc.name)


@frappe.whitelist(allow_guest=True)
def create_event_for_appointment_group(
    appointment_group_id: str,
    date: str,
    start_time: str,
    end_time: str,
    user_timezone_offset: str,
    event_participants,
    success_message="",
    return_event_id=False,
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

    appointment_group = frappe.get_last_doc(APPOINTMENT_GROUP, filters={"route": "appointment/" + appointment_group_id})
    response = _create_event_for_appointment_group(
        appointment_group,
        date,
        start_time,
        end_time,
        user_timezone_offset,
        event_participants,
        success_message=success_message,
        return_event_id=return_event_id,
        **args,
    )

    return response


def _create_event_for_appointment_group(
    appointment_group: object,
    date: str,
    start_time: str,
    end_time: str,
    user_timezone_offset: str,
    event_participants="[]",
    success_message="",
    return_event_id=False,
    **args,
):
    # query parameters
    event_info = args

    starts_on = utc_to_sys_time(start_time)
    ends_on = utc_to_sys_time(end_time)
    reschedule = event_info.get("reschedule", False)
    personal = event_info.get("personal", False)

    if not is_valid_time_slots(appointment_group, date, user_timezone_offset, start_time, end_time):
        return frappe.throw(_("This slot is not available, please book another slot."))

    if not event_info.get("subject"):
        if personal:
            event_info["subject"] = "Personal Meeting " + now()
        else:
            event_info["subject"] = appointment_group.name + " " + now()

    if not vaild_date(get_datetime(date), appointment_group)["is_valid"]:
        return frappe.throw(_("Invalid Date"))

    members = appointment_group.members

    if len(members) <= 0:
        return frappe.throw(_("No Member found"))

    google_calendar_api_obj, account = get_google_calendar_object(appointment_group.event_creator)

    if reschedule:
        try:
            event_id = decrypt(event_info.get("event_token"))
        except Exception:
            frappe.clear_last_message()
            frappe.throw(_("Invalid Event Token. Make sure you are using the correct link."))
        try:
            if not event_id:
                return frappe.throw(_("Unable to Update an event"))

            event = frappe.get_doc("Event", event_id)

            event.starts_on = starts_on
            event.ends_on = ends_on
            event.event_info = event_info

            webhook_call = event.handle_webhook(
                {
                    "event": event.as_dict(),
                    "appointment_group": appointment_group.as_dict(),
                    "metadata": event_info,
                }
            )
            if not webhook_call["status"]:
                return frappe.throw(webhook_call["message"])

            event.save(ignore_permissions=True)

            # clear all previous logs
            clear_messages()

            if success_message:
                if return_event_id:
                    return {
                        "message": success_message,
                        "event_id": event.name,
                    }
                return frappe.msgprint(success_message)

            if return_event_id:
                return {
                    "message": "Event has been updated successfully.",
                    "event_id": event.name,
                }
            return frappe.msgprint(_("Event has been updated successfully."))
        except Exception:
            return frappe.throw(_("Unable to Update an event"))

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
        "custom_doctype_link_with_event": json.loads(event_info.get("custom_doctype_link_with_event", "[]")),
        "send_reminder": 0,
        "event_type": "Private",
        "custom_appointment_group": appointment_group.name,
        "event_info": event_info,
    }

    if personal:
        calendar_event["custom_user_calendar"] = event_info.get("user_calendar")
        calendar_event["custom_appointment_slot_duration"] = event_info.get("appointment_slot_duration")

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

    # nosemgrep
    frappe.db.commit()

    if success_message:
        return frappe.msgprint(success_message)

    if return_event_id:
        return {
            "message": _("Event has been created"),
            "event_id": event.name,
        }
    return frappe.msgprint(_("Event has been created"))


@frappe.whitelist(allow_guest=True)
def check_one_time_schedule(
    appointment_group_id: str,
    **args,
):
    appointment_group = frappe.get_last_doc(APPOINTMENT_GROUP, filters={"route": "appointment/" + appointment_group_id})
    if appointment_group.schedule_only_once:
        event_info = args
        interview_id = json.loads(event_info.get("custom_doctype_link_with_event", "[]"))
        interview_id = interview_id[1]["reference_docname"]
        scheduled_events = frappe.get_all(
            "Event",
            filters=[
                ["Event DocType Link", "reference_docname", "=", interview_id],
            ],
        )
        if scheduled_events:
            return frappe.throw(_("Event can be scheduled only once."))


@frappe.whitelist()
def get_events_from_doc(doctype, docname, past_events=False):
    """Get the event details from the given doc

    Args:
    doctype (str): Doctype name
    docname (str): Docname

    Returns:
    dict: Event details
    """
    events = set()
    event_doctype_links = frappe.get_all(
        "Event DocType Link",
        filters={"reference_doctype": doctype, "reference_docname": docname},
        fields=["parent"],
    )
    for event_doctype_link in event_doctype_links:
        events.add(event_doctype_link.parent)
    events = list(events)

    if not events:
        return None

    cur_datetime = frappe.utils.now_datetime()
    filters = {
        "name": ["in", events],
    }
    if not past_events:
        filters["ends_on"] = [">=", cur_datetime]

    events_data = frappe.get_all(
        "Event",
        filters=filters,
        fields=["name", "subject", "starts_on", "ends_on", "status", "custom_appointment_group"],
        order_by="starts_on",
    )

    all_events = {
        "upcoming": [],
        "ongoing": [],
        "past": [],
    }

    for event in events_data:
        if not event.get("custom_appointment_group"):
            continue

        starts_on = event.get("starts_on")
        ends_on = event.get("ends_on")

        event["state"] = "upcoming"
        if event["status"] == "Open":
            if ends_on < cur_datetime:
                event["state"] = "past"
            elif starts_on < cur_datetime:
                event["state"] = "ongoing"
        else:
            event["state"] = "past"

        # if difference between start time and current time is less than 1 day, show the difference in minutes and hours
        diff = starts_on - cur_datetime

        if diff.days == 0:
            hours, remainder = divmod(diff.seconds, 3600)
            minutes, _ = divmod(remainder, 60)
            if hours == 0:
                event["starts_on"] = f"in {minutes} minute" + ("s" if minutes > 1 else "")
        if isinstance(starts_on, datetime.datetime):
            if cur_datetime.year == starts_on.year:
                event["starts_on"] = frappe.utils.format_datetime(starts_on, "MMM dd, HH:mm")
            else:
                event["starts_on"] = frappe.utils.format_datetime(starts_on, "MMM dd, yyyy, HH:mm")

        if cur_datetime.year == ends_on.year:
            event["ends_on"] = frappe.utils.format_datetime(ends_on, "MMM dd, HH:mm")
        else:
            event["ends_on"] = frappe.utils.format_datetime(ends_on, "MMM dd, yyyy, HH:mm")

        event["url"] = "/app/event/" + event["name"]
        event["reschedule_url"] = frappe.utils.get_url(
            "/schedule/gr/{0}?reschedule=1&event_token={1}".format(
                event["custom_appointment_group"],
                encrypt(event["name"]),
            )
        )
        all_events[event["state"]].append(event)
    return all_events


@frappe.whitelist()
def get_personal_meetings(user, past_events=False):
    """Get the personal meeting details from the given doc

    Args:
    doctype (str): Doctype name
    docname (str): Docname

    Returns:
    dict: Event details
    """
    doctype = "User Appointment Availability"
    docname = user

    user_availability = frappe.get_doc(doctype, docname)
    if not user_availability:
        return None

    events = set()
    event_doctype_links = frappe.get_all(
        "Event DocType Link",
        filters={"reference_doctype": doctype, "reference_docname": docname},
        fields=["parent"],
    )
    for event_doctype_link in event_doctype_links:
        events.add(event_doctype_link.parent)
    events = list(events)

    if not events:
        return None

    cur_datetime = frappe.utils.now_datetime()
    filters = {
        "name": ["in", events],
    }
    if not past_events:
        filters["ends_on"] = [">=", cur_datetime]

    events_data = frappe.get_all(
        "Event",
        filters=filters,
        fields=[
            "name",
            "subject",
            "starts_on",
            "ends_on",
            "status",
            "custom_user_calendar",
            "custom_appointment_slot_duration",
        ],
        order_by="starts_on",
    )

    all_events = {
        "upcoming": [],
        "ongoing": [],
        "past": [],
    }

    for event in events_data:
        if not event.get("custom_user_calendar"):
            continue

        starts_on = event.get("starts_on")
        ends_on = event.get("ends_on")

        event["state"] = "upcoming"
        if event["status"] == "Open":
            if ends_on < cur_datetime:
                event["state"] = "past"
            elif starts_on < cur_datetime:
                event["state"] = "ongoing"
        else:
            event["state"] = "past"

        # if difference between start time and current time is less than 1 day, show the difference in minutes and hours
        diff = starts_on - cur_datetime

        if diff.days == 0:
            hours, remainder = divmod(diff.seconds, 3600)
            minutes, _ = divmod(remainder, 60)
            if hours == 0:
                event["starts_on"] = f"in {minutes} minute" + ("s" if minutes > 1 else "")
        if isinstance(starts_on, datetime.datetime):
            if cur_datetime.year == starts_on.year:
                event["starts_on"] = frappe.utils.format_datetime(starts_on, "MMM dd, HH:mm")
            else:
                event["starts_on"] = frappe.utils.format_datetime(starts_on, "MMM dd, yyyy, HH:mm")

        if cur_datetime.year == ends_on.year:
            event["ends_on"] = frappe.utils.format_datetime(ends_on, "MMM dd, HH:mm")
        else:
            event["ends_on"] = frappe.utils.format_datetime(ends_on, "MMM dd, yyyy, HH:mm")

        event["url"] = "/app/event/" + event["name"]
        event["reschedule_url"] = (
            frappe.utils.get_url("/schedule/in/{0}".format(user_availability.get("slug")))
            + f"?type={event['custom_appointment_slot_duration']}&reschedule=1&event_token={encrypt(event['name'])}"
        )
        all_events[event["state"]].append(event)

    return all_events
