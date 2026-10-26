"""Groups anyone with Desk access can make: who can do what, and what the server keeps fixed."""

from unittest.mock import patch

import frappe
from frappe.share import add_docshare, get_share_name
from frappe.tests import IntegrationTestCase

from frappe_appointment.api.groups import (
    get_calendar_problems,
    get_group,
    get_group_bookings,
    get_groups,
    search_people,
)
from frappe_appointment.frappe_appointment.doctype.appointment_settings.appointment_settings import (
    get_default_email_template,
)
from frappe_appointment.patches.v0_1 import add_desk_user_group_permission
from frappe_appointment.tasks.verify_availability import update_availability_status_for_appointment_group
from frappe_appointment.tests import (
    EVENT_OVERRIDE,
    as_user,
    make_email_template,
    make_google_calendar,
    make_test_user,
    make_user_availability,
)

OWNER = "test_fa_grp_owner@example.com"
MEMBER = "test_fa_grp_member@example.com"
OUTSIDER = "test_fa_grp_outsider@example.com"
NO_CALENDAR = "test_fa_grp_nocal@example.com"
MANAGER = "test_fa_grp_manager@example.com"
OTHER_EMAIL = "FA Test Other Confirmation"
GROUP = "Appointment Group"


def desk_user(email):
    user = make_test_user(email)
    user.add_roles("Desk User")
    return user


class GroupAccessCase(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        for email, slug in ((OWNER, "fa-grp-owner"), (MEMBER, "fa-grp-member"), (OUTSIDER, "fa-grp-outsider")):
            desk_user(email)
            calendar = make_google_calendar(email, calendar_name=f"GCal {email}")
            make_user_availability(email, slug=slug, google_calendar=calendar.name)
        desk_user(NO_CALENDAR)
        # The app's own role for people who run groups; sites set up before its patch may not have it.
        frappe.get_doc({"doctype": "Role", "role_name": "Appointment Manager"}).insert(ignore_if_duplicate=True)
        desk_user(MANAGER).add_roles("Appointment Manager")
        cls.owner_calendar = f"GCal {OWNER}"
        cls.member_calendar = f"GCal {MEMBER}"

    def make_group(self, name, members=(MEMBER,), user=OWNER, **fields):
        """A group made by `user` from the new screens: no calendar or organizer sent."""
        with as_user(user):
            return frappe.get_doc(
                {
                    "doctype": GROUP,
                    "group_name": name,
                    "duration_for_event": 1800,
                    "members": [{"user": m, "is_mandatory": 1} for m in members],
                    **fields,
                }
            ).insert()


def insert_booking(group_name, subject, participants, days=2):
    """A booking made through the group, written straight to the database (no Google calls)."""
    start = frappe.utils.add_days(frappe.utils.now_datetime(), days)
    event = frappe.get_doc(
        {
            "doctype": "Event",
            "subject": subject,
            "starts_on": start,
            "ends_on": frappe.utils.add_to_date(start, minutes=30),
            "event_type": "Private",
            "status": "Open",
            "custom_appointment_group": group_name,
            "event_participants": participants,
        }
    )
    event.flags.ignore_validate = True
    event.db_insert()
    for child in event.get_all_children():
        child.parent = event.name
        child.db_insert()
    return event


def member_participant(user):
    return {"reference_doctype": "User Appointment Availability", "reference_docname": user, "email": user}


class TestOwnerDefaults(GroupAccessCase):
    def test_new_group_uses_the_owners_calendar_and_name(self):
        """A Desk user's new group books into their own calendar and names them as organizer."""
        group = self.make_group("FA Grp Defaults")
        self.assertEqual(group.event_creator, self.owner_calendar)
        self.assertEqual(group.event_organizer, OWNER)

    def test_owner_is_always_a_required_member(self):
        """The owner is added first as a required member, or made required if they listed themselves."""
        group = self.make_group("FA Grp Owner First")
        self.assertEqual((group.members[0].user, group.members[0].is_mandatory), (OWNER, 1))
        group = self.make_group("FA Grp Owner Listed", members=(MEMBER, OWNER))
        self.assertEqual([(m.user, m.is_mandatory) for m in group.members], [(MEMBER, 1), (OWNER, 1)])

    def test_needs_a_connected_calendar(self):
        """Someone without a connected Google Calendar is told to connect one first."""
        with self.assertRaises(frappe.ValidationError):
            self.make_group("FA Grp No Cal", user=NO_CALENDAR)


class TestAdminOnlyFields(GroupAccessCase):
    def test_desk_users_cannot_set_webhook_or_linked_doctype(self):
        """Webhook and linked doctype are refused on create and on edit."""
        for field, value in (("webhook", "frappe.ping"), ("linked_doctype", "ToDo")):
            with self.subTest(field=field), self.assertRaises(frappe.PermissionError):
                self.make_group(f"FA Grp Admin {field}", **{field: value})
        group = self.make_group("FA Grp Admin Edit")
        with as_user(OWNER), self.assertRaises(frappe.PermissionError):
            group.reload()
            group.webhook = "frappe.ping"
            group.save()

    def test_desk_users_cannot_book_into_someone_elses_calendar(self):
        """Calendar and organizer can't be changed to someone else's."""
        group = self.make_group("FA Grp Calendar")
        for field, value in (("event_creator", self.member_calendar), ("event_organizer", MEMBER)):
            with self.subTest(field=field), as_user(OWNER), self.assertRaises(frappe.PermissionError):
                group.reload()
                group.set(field, value)
                group.save()

    def test_system_managers_set_anything(self):
        """System Managers (Careers' groups) can still pick any calendar, organizer, webhook and doctype."""
        group = self.make_group("FA Grp Admin Sets")
        group.reload()
        group.update(
            {
                "event_creator": self.member_calendar,
                "event_organizer": MEMBER,
                "webhook": "frappe.ping",
                "linked_doctype": "ToDo",
            }
        )
        group.save()
        self.assertEqual(frappe.db.get_value(GROUP, group.name, "event_creator"), self.member_calendar)

    def test_admins_making_a_group_in_the_app_use_their_own_calendar(self):
        """The app's form sends no calendar or organizer. An admin's group then books into their own calendar
        with them as organizer, instead of failing on the required calendar."""
        calendar = make_google_calendar(MANAGER, calendar_name=f"GCal {MANAGER}").name
        group = self.make_group("FA Grp Manager App", members=(MEMBER,), user=MANAGER)
        self.assertEqual(
            frappe.db.get_value(GROUP, group.name, ["event_creator", "event_organizer"]), (calendar, MANAGER)
        )

    def test_appointment_managers_set_anything(self):
        """Appointment Managers run groups like System Managers: any calendar, organizer, webhook and
        doctype, and they aren't put into the group themselves."""
        group = self.make_group(
            "FA Grp Manager Sets",
            members=(MEMBER,),
            user=MANAGER,
            event_creator=self.member_calendar,
            event_organizer=MEMBER,
            webhook="frappe.ping",
            linked_doctype="ToDo",
        )
        self.assertEqual(
            frappe.db.get_value(GROUP, group.name, ["event_creator", "event_organizer", "webhook", "linked_doctype"]),
            (self.member_calendar, MEMBER, "frappe.ping", "ToDo"),
        )
        self.assertEqual([(m.user, m.is_mandatory) for m in group.members], [(MEMBER, 1)])

        with as_user(MANAGER):
            group.reload()
            group.event_creator = self.owner_calendar
            group.save()
        self.assertEqual(frappe.db.get_value(GROUP, group.name, "event_creator"), self.owner_calendar)

    def test_other_saves_leave_the_fields_alone(self):
        """A save that doesn't touch those fields (say, removing a member during offboarding) works even
        by a non-admin, and keeps an admin-set calendar and webhook as they are."""
        group = self.make_group("FA Grp Offboard", members=(MEMBER, OUTSIDER))
        group.reload()
        group.update({"event_creator": self.member_calendar, "webhook": "frappe.ping"})
        group.save()
        with as_user(OUTSIDER):
            group.reload()
            group.set("members", [m for m in group.members if m.user != OUTSIDER])
            group.save(ignore_permissions=True)
        self.assertEqual(
            frappe.db.get_value(GROUP, group.name, ["event_creator", "webhook"]), (self.member_calendar, "frappe.ping")
        )


class TestEmailChoice(GroupAccessCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.defaults = get_default_email_template()
        cls.other_email = make_email_template(OTHER_EMAIL).name

    def test_desk_users_get_the_default_emails_and_cannot_change_them(self):
        """A new group starts on the site's default emails, even when none are sent; any other choice, on create
        or edit, is refused, and clearing one brings the default back."""
        group = self.make_group("FA Grp Email Default")
        self.assertEqual(
            frappe.db.get_value(GROUP, group.name, ["response_email_template", "availability_email_template"]),
            (self.defaults["group"], self.defaults["availability"]),
        )
        for field, kind in (("response_email_template", "group"), ("availability_email_template", "availability")):
            with self.subTest(field=field), self.assertRaises(frappe.PermissionError):
                self.make_group(f"FA Grp Email {field}", **{field: self.other_email})
            with self.subTest(field=field), as_user(OWNER), self.assertRaises(frappe.PermissionError):
                group.reload()
                group.set(field, self.other_email)
                group.save()
            with as_user(OWNER):
                group.reload()
                group.set(field, None)
                group.save()
            self.assertEqual(frappe.db.get_value(GROUP, group.name, field), self.defaults[kind])

    def test_system_managers_choose_any_email(self):
        """A System Manager's choice stays when the owner later saves something else."""
        group = self.make_group("FA Grp Email Admin")
        group.reload()
        group.response_email_template = self.other_email
        group.save()
        with as_user(OWNER):
            group.reload()
            group.duration_for_event = 2700
            group.save()
        self.assertEqual(frappe.db.get_value(GROUP, group.name, "response_email_template"), self.other_email)


class TestWhoCanDoWhat(GroupAccessCase):
    def test_owner_member_outsider(self):
        """The owner can edit and delete, members can only read, everyone else can't see it."""
        group = self.make_group("FA Grp Access")
        expected = {OWNER: (True, True, True), MEMBER: (True, False, False), OUTSIDER: (False, False, False)}
        for user, (read, write, delete) in expected.items():
            with self.subTest(user=user):
                self.assertEqual(bool(frappe.has_permission(GROUP, "read", doc=group.name, user=user)), read)
                self.assertEqual(bool(frappe.has_permission(GROUP, "write", doc=group.name, user=user)), write)
                self.assertEqual(bool(frappe.has_permission(GROUP, "delete", doc=group.name, user=user)), delete)

    def test_lists_show_only_own_and_member_groups(self):
        """A Desk user's group list has no one else's groups."""
        self.make_group("FA Grp List Mine")
        self.make_group("FA Grp List Other", members=(), user=OUTSIDER)
        with as_user(MEMBER):
            names = frappe.get_list(GROUP, pluck="name")
        self.assertIn("fa-grp-list-mine", names)
        self.assertNotIn("fa-grp-list-other", names)

    def test_removed_members_lose_access_hand_made_shares_stay(self):
        """Taking someone out stops sharing with them; a share someone made by hand is untouched."""
        group = self.make_group("FA Grp Unshare", members=(MEMBER,))
        add_docshare(GROUP, group.name, OUTSIDER, read=1, write=1, flags={"ignore_share_permission": True})
        with as_user(OWNER):
            group.reload()
            group.set("members", [m for m in group.members if m.user != MEMBER])
            group.save()
        self.assertFalse(get_share_name(GROUP, group.name, MEMBER, 0))
        self.assertTrue(frappe.db.get_value("DocShare", get_share_name(GROUP, group.name, OUTSIDER, 0), "write"))

    def test_removed_member_keeps_a_share_with_more_access(self):
        """Someone given more than read by hand keeps that share when they're taken out of the members."""
        group = self.make_group("FA Grp Keep Write", members=(MEMBER,))
        add_docshare(GROUP, group.name, MEMBER, read=1, write=1, flags={"ignore_share_permission": True})
        with as_user(OWNER):
            group.reload()
            group.set("members", [m for m in group.members if m.user != MEMBER])
            group.save()
        share_name = get_share_name(GROUP, group.name, MEMBER, 0)
        self.assertTrue(share_name)
        self.assertEqual(frappe.db.get_value("DocShare", share_name, "write"), 1)

    def test_only_editors_refresh_slot_availability(self):
        """The slots refresh saves the group, so members can't start it but the owner can."""
        group = self.make_group("FA Grp Refresh")
        with patch("frappe.enqueue") as enqueue:
            with as_user(MEMBER), self.assertRaises(frappe.PermissionError):
                update_availability_status_for_appointment_group(group.name)
            with as_user(OWNER):
                update_availability_status_for_appointment_group(group.name)
        enqueue.assert_called_once()


class TestGroupsApi(GroupAccessCase):
    def test_get_groups_splits_mine_and_others(self):
        """The owner sees it under their groups, the member under groups they're in, others not at all."""
        self.make_group("FA Grp Api")
        with as_user(OWNER):
            self.assertIn("fa-grp-api", [g["name"] for g in get_groups()["mine"]])
        with as_user(MEMBER):
            others = get_groups()["others"]

        api_group = None
        for group in others:
            if group["name"] == "fa-grp-api":
                api_group = group
        self.assertIsNotNone(api_group)
        self.assertEqual(api_group["owner"], OWNER)

        members = []
        for person in api_group["members"]:
            members.append((person["user"], person["is_mandatory"]))
        self.assertEqual(members, [(OWNER, 1), (MEMBER, 1)])
        with as_user(OUTSIDER):
            self.assertNotIn("fa-grp-api", [g["name"] for g in get_groups()["mine"] + get_groups()["others"]])

    def test_get_group_says_who_can_edit(self):
        group = self.make_group("FA Grp Api One")
        with as_user(OWNER):
            self.assertEqual((get_group(group.name)["is_owner"], get_group(group.name)["can_edit"]), (True, True))
        with as_user(MEMBER):
            self.assertEqual((get_group(group.name)["is_owner"], get_group(group.name)["can_edit"]), (False, False))
        with as_user(OUTSIDER), self.assertRaises(frappe.PermissionError):
            get_group(group.name)

    def test_calendar_problems_name_broken_required_calendars(self):
        group = self.make_group("FA Grp Api Calendars")
        broken = {self.member_calendar}
        with patch("frappe_appointment.api.groups.calendar_is_connected", side_effect=lambda c: c not in broken):
            with as_user(OWNER):
                problems = get_calendar_problems(group.name)
            found = [(p["calendar"], p["user"], p["is_me"]) for p in problems]
            self.assertEqual(found, [(self.member_calendar, MEMBER, False)])
            with as_user(MEMBER):
                self.assertTrue(get_calendar_problems(group.name)[0]["is_me"])

            # An optional member's calendar isn't read for free times, so it doesn't stop bookings.
            group.reload()
            group.members[1].is_mandatory = 0
            group.save(ignore_permissions=True)
            with as_user(OWNER):
                self.assertEqual(get_calendar_problems(group.name), [])

            # The calendar bookings are made in counts too.
            broken.add(self.owner_calendar)
            with as_user(OWNER):
                self.assertEqual([p["is_me"] for p in get_calendar_problems(group.name)], [True])
            with as_user(OUTSIDER), self.assertRaises(frappe.PermissionError):
                get_calendar_problems(group.name)

    def test_bookings_come_from_the_group_field(self):
        """Bookings are found by custom_appointment_group, with guests apart from members; outsiders get nothing."""
        group = self.make_group("FA Grp Bookings")
        insert_booking(
            group.name, "FA Grp Bookings with Karan", [{"email": "karan@example.com"}, member_participant(MEMBER)]
        )
        with as_user(MEMBER):
            bookings = get_group_bookings(group.name)
        self.assertEqual(
            [(b.subject, b.guests, b.members) for b in bookings],
            [("FA Grp Bookings with Karan", ["karan@example.com"], [MEMBER])],
        )
        with as_user(MEMBER):
            self.assertEqual(get_group_bookings(group.name, past=1), [])
        with as_user(OUTSIDER), self.assertRaises(frappe.PermissionError):
            get_group_bookings(group.name)

    def test_members_see_only_their_own_bookings(self):
        """The owner sees every booking and counts it; a member sees and counts only the ones they're in, so
        they don't see other members' guests."""
        group = self.make_group("FA Grp Own Bookings", members=(MEMBER, OUTSIDER))
        insert_booking(group.name, "FA Grp with Karan", [{"email": "karan@example.com"}, member_participant(MEMBER)])
        insert_booking(group.name, "FA Grp with Leena", [{"email": "leena@example.com"}, member_participant(OUTSIDER)])

        expected = {
            OWNER: ["FA Grp with Karan", "FA Grp with Leena"],
            MEMBER: ["FA Grp with Karan"],
            OUTSIDER: ["FA Grp with Leena"],
        }
        for user, subjects in expected.items():
            with self.subTest(user=user), as_user(user):
                bookings = get_group_bookings(group.name)
                self.assertEqual(sorted(b.subject for b in bookings), subjects)

                upcoming = None
                for summary in get_groups()["mine"] + get_groups()["others"]:
                    if summary["name"] == group.name:
                        upcoming = summary["upcoming"]
                self.assertEqual(upcoming, len(subjects))

    def test_search_people_lists_only_people_with_appointments(self):
        with as_user(OWNER):
            found = [p["user"] for p in search_people("fa_grp")]
        self.assertIn(MEMBER, found)
        self.assertNotIn(NO_CALENDAR, found)


class TestDeskUserPermissionPatch(GroupAccessCase):
    def custom_rules(self):
        return frappe.get_all("Custom DocPerm", filters={"parent": GROUP}, pluck="role")

    def test_adds_the_desk_user_rule_only_where_custom_rules_exist(self):
        """Sites without Custom DocPerm rows are left alone; on sites with them (where the Appointment
        Manager role was added), the Desk User rule is added once."""
        if self.custom_rules():
            self.skipTest("This site already has custom permissions for Appointment Group.")

        def remove_custom_rules():
            frappe.db.delete("Custom DocPerm", {"parent": GROUP})
            frappe.clear_cache(doctype=GROUP)

        self.addCleanup(remove_custom_rules)

        add_desk_user_group_permission.execute()
        self.assertEqual(self.custom_rules(), [])

        frappe.get_doc(
            {
                "doctype": "Custom DocPerm",
                "parent": GROUP,
                "parenttype": "DocType",
                "parentfield": "permissions",
                "role": "Appointment Manager",
                "read": 1,
                "write": 1,
                "create": 1,
            }
        ).insert(ignore_permissions=True)
        add_desk_user_group_permission.execute()
        add_desk_user_group_permission.execute()
        self.assertEqual(sorted(self.custom_rules()), ["Appointment Manager", "Desk User"])

        rule = frappe.get_all(
            "Custom DocPerm",
            filters={"parent": GROUP, "role": "Desk User"},
            fields=["if_owner", "create", "read", "write", "delete", "share"],
        )[0]
        self.assertEqual(
            (rule.if_owner, rule.create, rule.read, rule.write, rule.delete, rule.share), (1, 1, 1, 1, 1, 1)
        )
        self.assertTrue(frappe.has_permission(GROUP, "create", user=OWNER))


class TestPublicPageBookings(GroupAccessCase):
    def test_linking_a_booking_to_its_group_sends_the_confirmation_email(self):
        """The public group page links each booking to its group (custom_doctype_link_with_event), so the
        existing confirmation email goes to the guest, filed on the group."""
        group = self.make_group("FA Grp Public", response_email_template="[Default] Appointment Scheduled")
        start = frappe.utils.add_days(frappe.utils.now_datetime(), 3)
        event = frappe.get_doc(
            {
                "doctype": "Event",
                "subject": "FA Grp Public with Karan",
                "starts_on": start,
                "ends_on": frappe.utils.add_to_date(start, minutes=30),
                "event_type": "Private",
                "custom_appointment_group": group.name,
                "custom_meet_link": "https://meet.google.com/abc-defg-hij",
                "event_participants": [
                    {"email": "karan@example.com"},
                    {
                        "reference_doctype": "User Appointment Availability",
                        "reference_docname": MEMBER,
                        "email": MEMBER,
                    },
                ],
                "custom_doctype_link_with_event": [{"reference_doctype": GROUP, "reference_docname": group.name}],
            }
        )
        event.flags.ignore_validate = True
        event.db_insert()
        for child in event.get_all_children():
            child.parent = event.name
            child.db_insert()

        from frappe_appointment.overrides.event_override import send_meet_email

        # send_meet_email commits; keep the test's records inside the test transaction.
        with (
            patch(f"{EVENT_OVERRIDE}.send_email_template_mail") as send,
            patch(f"{EVENT_OVERRIDE}.add_ics_file_in_attachment", return_value="ics"),
            patch.object(frappe.db, "commit"),
        ):
            send_meet_email(frappe.get_doc("Event", event.name), group, None, {})
        send.assert_called_once()
        filed_on, _args, template = send.call_args.args
        self.assertEqual(
            (filed_on.doctype, filed_on.name, template), (GROUP, group.name, "[Default] Appointment Scheduled")
        )
        self.assertEqual(send.call_args.kwargs["recipients"], ["karan@example.com"])
