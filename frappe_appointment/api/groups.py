"""What the /schedule group screens read: the groups someone owns or is in, one group with its people,
its bookings, and the people who can be added. Saving goes through the REST resource API."""

import frappe
from frappe.utils import get_fullname, now_datetime

from frappe_appointment.constants import APPOINTMENT_GROUP, USER_APPOINTMENT_AVAILABILITY
from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import member_users


def only_desk_users():
    user = frappe.session.user
    is_desk_user = user != "Guest" and frappe.get_cached_value("User", user, "user_type") == "System User"
    if not is_desk_user:
        frappe.throw(frappe._("Only people with Desk access can use group meetings."), frappe.PermissionError)


def people(group) -> list[dict]:
    """The group's members with their names. A member is a User Appointment Availability, named after its user."""
    result = []
    for member in group.members:
        user = frappe.db.get_value(USER_APPOINTMENT_AVAILABILITY, member.user, "user") or member.user
        result.append(
            {
                "availability": member.user,
                "user": user,
                "full_name": get_fullname(user),
                "is_mandatory": member.is_mandatory,
            }
        )
    return result


def bookings_i_am_in(group_name: str) -> list[str]:
    """The group's bookings the current user takes part in: as a participant by email, or as a member
    through their User Appointment Availability."""
    user = frappe.session.user
    my_availability = frappe.db.get_value(USER_APPOINTMENT_AVAILABILITY, {"user": user}, "name")

    group_events = frappe.get_all("Event", filters={"custom_appointment_group": group_name}, pluck="name")
    if not group_events:
        return []

    participants = frappe.get_all(
        "Event Participants",
        filters={"parenttype": "Event", "parent": ["in", group_events]},
        fields=["parent", "email", "reference_doctype", "reference_docname"],
    )
    event_names = []
    for participant in participants:
        is_me = participant.email == user
        is_my_availability = (
            my_availability
            and participant.reference_doctype == USER_APPOINTMENT_AVAILABILITY
            and participant.reference_docname == my_availability
        )
        if (is_me or is_my_availability) and participant.parent not in event_names:
            event_names.append(participant.parent)
    return event_names


def booking_filters(group_name: str) -> dict | None:
    """Which of the group's bookings the current user may see. People who can edit the group see all of
    them; members who can only read it see the ones they take part in, so they don't see other people's
    guests (on Careers groups, other interviewers' candidates). None means there's nothing to see."""
    filters = {"custom_appointment_group": group_name}
    can_see_all = frappe.has_permission(APPOINTMENT_GROUP, "write", doc=group_name)
    if can_see_all:
        return filters

    my_bookings = bookings_i_am_in(group_name)
    if not my_bookings:
        return None
    filters["name"] = ["in", my_bookings]
    return filters


def upcoming_count(group_name: str) -> int:
    """How many bookings the current user can see in the group from now on, leaving out cancelled ones."""
    filters = booking_filters(group_name)
    if filters is None:
        return 0

    filters["starts_on"] = [">=", now_datetime()]
    filters["status"] = ["!=", "Cancelled"]
    return frappe.db.count("Event", filters)


@frappe.whitelist()
def get_groups() -> dict:
    """The groups this person made, and the ones they're a member of."""
    only_desk_users()
    user = frappe.session.user

    mine = []
    others = []
    group_names = frappe.get_list(APPOINTMENT_GROUP, pluck="name", order_by="creation desc", limit_page_length=0)
    for name in group_names:
        group = frappe.get_doc(APPOINTMENT_GROUP, name)
        is_mine = group.owner == user
        is_member = user in member_users(group.members)
        if not is_mine and not is_member:
            continue

        summary = {
            "name": group.name,
            "group_name": group.group_name,
            "owner": group.owner,
            "owner_name": get_fullname(group.owner),
            "duration_for_event": group.duration_for_event,
            "meet_provider": group.meet_provider,
            "members": people(group),
            "upcoming": upcoming_count(group.name),
        }
        if is_mine:
            mine.append(summary)
        else:
            others.append(summary)

    return {"mine": mine, "others": others}


@frappe.whitelist()
def get_group(group: str) -> dict:
    """One group with its people, for its owner or members."""
    only_desk_users()
    frappe.has_permission(APPOINTMENT_GROUP, "read", doc=group, throw=True)

    doc = frappe.get_doc(APPOINTMENT_GROUP, group)
    can_edit = frappe.has_permission(APPOINTMENT_GROUP, "write", doc=doc)
    return {
        "doc": doc.as_dict(),
        "people": people(doc),
        "owner_name": get_fullname(doc.owner),
        "is_owner": doc.owner == frappe.session.user,
        "can_edit": bool(can_edit),
    }


@frappe.whitelist()
def get_group_bookings(group: str, past: bool = False) -> list[dict]:
    """Bookings made through a group, with their guests and members. Every group booking records its
    group in custom_appointment_group, so older bookings and Careers ones are included. Editors see all of
    them, members only the ones they take part in."""
    only_desk_users()
    frappe.has_permission(APPOINTMENT_GROUP, "read", doc=group, throw=True)

    filters = booking_filters(group)
    if filters is None:
        return []

    now = now_datetime()
    if frappe.utils.sbool(past):
        filters["starts_on"] = ["<", now]
        order_by = "starts_on desc"
    else:
        filters["starts_on"] = [">=", now]
        order_by = "starts_on asc"

    # Permissions are checked on the group above, and booking_filters narrows what members see.
    events = frappe.get_all(
        "Event",
        filters=filters,
        fields=["name", "subject", "starts_on", "ends_on", "status"],
        order_by=order_by,
        limit_page_length=50,
    )

    for event in events:
        participants = frappe.get_all(
            "Event Participants",
            filters={"parent": event.name, "parenttype": "Event"},
            fields=["email", "reference_doctype"],
        )
        guests = []
        members = []
        for participant in participants:
            if participant.reference_doctype == USER_APPOINTMENT_AVAILABILITY:
                members.append(participant.email)
            elif participant.email:
                guests.append(participant.email)
        event["guests"] = guests
        event["members"] = members

    return events


@frappe.whitelist()
def search_people(txt: str = "") -> list[dict]:
    """People who can be added to a group: everyone with Appointments set up."""
    only_desk_users()

    users_with_appointments = frappe.get_all(USER_APPOINTMENT_AVAILABILITY, pluck="user")
    if not users_with_appointments:
        return []

    search = f"%{txt.strip()}%"
    users = frappe.get_all(
        "User",
        filters={"name": ["in", users_with_appointments], "enabled": 1},
        or_filters={"name": ["like", search], "full_name": ["like", search]},
        fields=["name"],
        order_by="full_name asc",
        limit_page_length=20,
    )

    result = []
    for user in users:
        result.append({"availability": user.name, "user": user.name, "full_name": get_fullname(user.name)})
    return result
