from datetime import datetime
import json
import frappe
from frappe.integrations.doctype.google_calendar.google_calendar import get_google_calendar_object
import frappe.utils
from frappe_appointment.helpers.email import send_email_template_mail
import pytz


class AvailabilityStatus:
    HOLIDAY = "Holiday"
    LEAVE = "Leave"
    BUSY = "Busy"
    AVAILABLE = "Available"

    def __init__(self, status, start_time=None, end_time=None):
        self.status = status
        self.start_time = start_time
        self.end_time = end_time

    def __dict__(self):
        return {
            "status": self.status,
            "start_time": self.start_time.isoformat() if isinstance(self.start_time, datetime) else self.start_time,
            "end_time": self.end_time.isoformat() if isinstance(self.end_time, datetime) else self.end_time,
        }


def check_availability(member, date, start_time, end_time, calendar):
    date_str = date

    sys_tz = pytz.timezone(frappe.utils.get_system_timezone())
    start_datetime = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M:%S")
    end_datetime = datetime.strptime(f"{date_str} {end_time}", "%Y-%m-%d %H:%M:%S")
    start_datetime = sys_tz.localize(start_datetime)
    end_datetime = sys_tz.localize(end_datetime)

    # first check if member is on leave
    employee = frappe.get_all(
                "Employee", filters={"company_email": member.user}, fields=["name", "holiday_list"]
            )
    if not employee:
        return False  # If we don't have the employee, we can't check for leaves or holidays
    leaves = frappe.get_all(
        "Leave Application",
        filters={
            "employee": employee[0].name,
            "from_date": ["<=", date_str],
            "to_date": [">=", date_str],
            "status": "Approved",
        },
    )
    if leaves:
        return AvailabilityStatus(AvailabilityStatus.LEAVE, start_datetime, end_datetime)
    # check if member is on holiday
    if employee and employee[0].holiday_list:
        holidays = frappe.get_doc("Holiday List", employee[0].holiday_list)
        for holiday in holidays.holidays:
            if holiday.holiday_date.strftime("%Y-%m-%d") == date_str:
                return AvailabilityStatus(AvailabilityStatus.HOLIDAY, start_datetime, end_datetime)
    # check google calendar for conflicting events (only find events that are marked as busy)
    google_calendar, account = get_google_calendar_object(calendar)
    if not account.pull_from_google_calendar:
        return AvailabilityStatus(AvailabilityStatus.AVAILABLE)
    events = google_calendar.events().list(
        calendarId=account.google_calendar_id,
        timeMin=start_datetime.isoformat(),
        timeMax=end_datetime.isoformat(),
        singleEvents=True,
        orderBy="startTime",
        eventTypes="default",
    ).execute()
    if events.get("items"):
        all_status = []
        for event in events.get("items"):
            if event.get("status") == "confirmed":
                all_status.append(AvailabilityStatus(AvailabilityStatus.BUSY, event["start"]["dateTime"], event["end"]["dateTime"]))
        if all_status:
            return all_status
    return AvailabilityStatus(AvailabilityStatus.AVAILABLE)


def verify_appointment_group_members_availabililty():
    appointment_groups = frappe.get_all("Appointment Group")
    data = {}
    for appointment_group in appointment_groups:
        appointment_group = frappe.get_doc("Appointment Group", appointment_group.name)
        event_availability_window = int(appointment_group.event_availability_window) if appointment_group.event_availability_window else 0
        scheduling_on_weekends = appointment_group.enable_scheduling_on_weekends
        members = appointment_group.members
        data[appointment_group.name] = {}
        for member in members:
            if not member.is_mandatory:
                continue
            member_availability = frappe.get_doc("User Appointment Availability", member.user)
            current_date_str = frappe.utils.nowdate()
            data[appointment_group.name][member.user] = {}
            for _i in range(event_availability_window):
                current_date = datetime.strptime(current_date_str, "%Y-%m-%d")
                try:
                    for appointment_time_slot in member_availability.appointment_time_slot:
                        if appointment_time_slot.day == current_date.strftime("%A") and (scheduling_on_weekends or current_date.weekday() < 5):
                            # check availability of the member
                            availability = check_availability(
                                member, current_date_str, appointment_time_slot.start_time, appointment_time_slot.end_time, member_availability.google_calendar
                            )
                            if isinstance(availability, AvailabilityStatus):
                                availability = [availability]
                            for a in availability:
                                if a.status != AvailabilityStatus.AVAILABLE:
                                    if current_date_str not in data[appointment_group.name][member.user]:
                                        data[appointment_group.name][member.user][current_date_str] = []
                                    data[appointment_group.name][member.user][current_date_str].append(a.__dict__())
                finally:
                    current_date_str = frappe.utils.add_days(current_date_str, 1)
            if not data[appointment_group.name][member.user]:
                del data[appointment_group.name][member.user]
        if not data[appointment_group.name]:
            del data[appointment_group.name]
    send_availability_email(data)


def send_availability_email(data):
    if not data:
        return
    for appointment_group in data:
        html = f"""
        <h3>Appointment Group: <a href="{frappe.utils.get_url(f"/app/appointment-group/{appointment_group}", full_address=True)}">{appointment_group}</a></h3>
        """
        for member in data[appointment_group]:
            html += f"""
            <hr>
            <h4>Member: {member}</h4>
            """
            for date in data[appointment_group][member]:
                html += f"""
                <h5>Date: {date}</h5>
                <ul>
                """
                for status in data[appointment_group][member][date]:
                    start_time = datetime.strptime(status["start_time"], "%Y-%m-%dT%H:%M:%S%z").strftime("%I:%M %p")
                    end_time = datetime.strptime(status["end_time"], "%Y-%m-%dT%H:%M:%S%z").strftime("%I:%M %p")
                    if status["status"] == AvailabilityStatus.BUSY:
                        html += f"""
                        <li><b>{status["status"]}</b>, From: {start_time}, To: {end_time}</li>
                        """
                    else:
                        html += f"""
                        <li><b>{status["status"]}</b></li>
                        """
                html += """
                </ul>
                """
        doc = frappe.get_doc("Appointment Group", appointment_group)
        send_email_template_mail(doc, {"data": html}, "Appointment Group Availability", ["hr@rt.gw"], None)