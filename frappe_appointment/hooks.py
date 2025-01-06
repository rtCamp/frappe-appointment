app_name = "frappe_appointment"
app_title = "Frappe Appointment"
app_publisher = "rtCamp"
app_description = "The appointment scheduling app with team support in Frappe."
app_email = "sys@rtcamp.com"
app_license = "GNU AFFERO GENERAL PUBLIC LICENSE (v3)"
# required_apps = []

fixtures = [
    {
        "dt": "Custom Field",
        "filters": [
            [
                "module",
                "in",
                [
                    "Frappe Appointment",
                ],
            ],
        ],
    },
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/frappe_appointment/css/frappe_appointment.css"
# app_include_js = "/assets/frappe_appointment/js/frappe_appointment.js"

# include js, css files in header of web template
# web_include_css = "/assets/frappe_appointment/css/frappe_appointment.css"
# web_include_js = "/assets/frappe_appointment/js/frappe_appointment.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "frappe_appointment/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "frappe_appointment.utils.jinja_methods",
# 	"filters": "frappe_appointment.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "frappe_appointment.install.before_install"
# after_install = "frappe_appointment.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "frappe_appointment.uninstall.before_uninstall"
# after_uninstall = "frappe_appointment.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "frappe_appointment.utils.before_app_install"
# after_app_install = "frappe_appointment.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "frappe_appointment.utils.before_app_uninstall"
# after_app_uninstall = "frappe_appointment.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "frappe_appointment.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

override_doctype_class = {
    "Event": "frappe_appointment.overrides.event_override.EventOverride",
    "Google Calendar": "frappe_appointment.overrides.google_calendar_override.GoogleCalendarOverride",
    "Customize Form": "frappe_appointment.overrides.customize_form_override.CareersOverrideCustomizeForm",
}

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
    "Leave Application": {
        "on_submit": "frappe_appointment.overrides.leave_application_override.on_submit",
        "on_cancel": "frappe_appointment.overrides.leave_application_override.on_cancel_and_on_trash",
        "on_trash": "frappe_appointment.overrides.leave_application_override.on_cancel_and_on_trash",
    },
}

# Scheduled Tasks
# ---------------

scheduler_events = {
    # "all": [
    # 	"frappe_appointment.tasks.all"
    # ],
    "daily": [
        "frappe_appointment.tasks.reminder_google_calendar_auth.send_reminder_mail",
        "frappe_appointment.tasks.verify_availability.verify_appointment_group_members_availabililty",
    ],
    # "hourly": [
    # 	"frappe_appointment.tasks.hourly"
    # ],
    # "weekly": [
    # 	"frappe_appointment.tasks.weekly"
    # ],
    # "monthly": [
    # 	"frappe_appointment.tasks.monthly"
    # ],
}

# Testing
# -------

# before_tests = "frappe_appointment.install.before_tests"

update_website_context = "frappe_appointment.overrides.website_context.website_context"

# Overriding Methods
# ------------------------------
#
override_whitelisted_methods = {
    "frappe.integrations.doctype.google_calendar.google_calendar.google_callback": "frappe_appointment.overrides.google_calendar_override.google_callback"
}
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "frappe_appointment.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["frappe_appointment.utils.before_request"]
# after_request = ["frappe_appointment.utils.after_request"]

# Job Events
# ----------
# before_job = ["frappe_appointment.utils.before_job"]
# after_job = ["frappe_appointment.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"frappe_appointment.auth.validate"
# ]
