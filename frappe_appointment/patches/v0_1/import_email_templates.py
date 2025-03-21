import frappe

EMAIL_TEMPLATES = [
    {
        "custom_schedule_sending_email": "Send after",
        "custom_sender_email": "hr@example.com",
        "custom_time": -1,
        "custom_time_to_send_email": 0,
        "docstatus": 0,
        "doctype": "Email Template",
        "enabled": 1,
        "modified": "2025-02-17 11:59:18.019434",
        "name": "[Default] Appointment Group Availability",
        "reference_doctype": "Appointment Group",
        "response": '<div class="ql-editor read-mode"><p><br></p></div>',
        "response_html": '<div>Hi,</div>\n<br>\n<div>This is a notification that the available slots for <a href="{{ job_opening_doc_url }}">{{ job_opening }}</a> are running low.</div>\n<br>\n<div>\n  <p><b>Current Slots Available:</b> {{ total_slots }} {# (Minimum Slot Threshold: {{ min_threshold }}) #}</p>\n</div>\n<br>\n{# {% if daywise_slots_data %}\n<div><b>Daywise Slots Data:</b></div>\n<br>\n{{ daywise_slots_data }}\n<br>\n{% endif %} #}\n<div>Please update the slots at the earliest to avoid missing any potential candidates. For further assistance, feel free to reach out.</div>\n<br>\nThank you!\n<br>\n--\n',
        "subject": "Action Required: Low Slot Availability for {{ job_opening }}",
        "use_html": 1,
    },
    {
        "custom_schedule_sending_email": "Send after",
        "custom_sender_email": "hr@example.com",
        "custom_time": -1,
        "custom_time_to_send_email": 0,
        "docstatus": 0,
        "doctype": "Email Template",
        "enabled": 1,
        "modified": "2025-02-17 00:23:49.662459",
        "name": "[Default] Appointment Scheduled",
        "reference_doctype": "Appointment Group",
        "response": '<div class="ql-editor read-mode"><p>Hello,</p><p><br></p><p>Thank you for taking the time to schedule a meeting with us about {{ event.subject }}.</p><p>{% set formatted_starts_on = frappe.utils.get_datetime(event.starts_on) %}</p><p><br></p><p>Your appointment is scheduled for {{ formatted_starts_on.strftime(\'%A\') }}, {{ formatted_starts_on.strftime(\'%d %B %Y\') }} at {{ formatted_starts_on.strftime("%I:%M %P") }} IST.</p><p><br></p><p>Please join the meeting using this link: {{ meet_link }}</p><p><br></p><p><span style="background-color: transparent; color: rgb(0, 0, 0);">We are looking forward to speaking with you!</span></p><p><br></p><p><span style="background-color: transparent; color: rgb(0, 0, 0);">Regards,</span></p><p><span style="color: rgb(18, 19, 23);">--</span></p></div>',
        "response_html": None,
        "subject": "[Frappe Appointment] Appointment Scheduled - {{ event.subject }}",
        "use_html": 0,
    },
]


def import_email_templates():
    for email_template in EMAIL_TEMPLATES:
        frappe.get_doc(email_template).insert(ignore_permissions=True, ignore_if_duplicate=True)
    frappe.db.commit()


def execute():
    import_email_templates()
