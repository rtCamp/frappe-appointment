import json

import frappe
from frappe.core.doctype.communication.email import add_attachments
from frappe.desk.form.load import get_document_email
from frappe.email.email_body import get_message_id
from frappe.utils import add_to_date, get_string_between, now, nowdate, time_diff


def send_email_template_mail(doc, args, email_template, recipients=None, attachments=None):
    """Send Email for Job Applicants"""

    email_template = frappe.get_doc("Email Template", email_template)

    email_message = ""

    if email_template.use_html:
        email_message = email_template.response_html
    else:
        email_message = email_template.response

    email_subject = email_template.subject

    # Make Email subject as well  as meesage dynamic based on args value
    message = frappe.render_template(email_message, args)
    subject = frappe.render_template(email_subject, args)

    send_after = None
    if email_template.get("custom_time_to_send_email"):
        send_after = get_send_after(email_template)

    sender = email_template.get("custom_sender_email", None)

    # Create Communication Entry while sending the mail. This will require to show the email in Job Applicant DocType
    comm = frappe.get_doc(
        {
            "doctype": "Communication",
            "subject": subject,
            "content": message,
            "sender": sender,
            "recipients": recipients[0],
            "reference_doctype": doc.doctype,
            "reference_name": doc.name,
            "email_template": email_template,
            "message_id": get_string_between("<", get_message_id(), ">"),
            "communication_type": "Communication",
            "has_attachment": 1 if attachments else 0,
        }
    )
    comm.insert(ignore_permissions=True)

    # if not committed, delayed task doesn't find the communication
    if attachments:
        if isinstance(attachments, str):
            attachments = json.loads(attachments)

        new_attachments = []

        for attachment in attachments:
            _file = frappe.get_doc("File", attachment["fid"], ignore_permissions=True)
            fcontent = _file.get_content()
            new_attachments.append({"fname": _file.file_name, "fcontent": fcontent})

        attachments = new_attachments
        add_attachments(comm.name, attachments)

    document_email = get_document_email(doc.doctype, doc.name)

    frappe.sendmail(
        recipients=recipients,
        sender=sender,
        send_after=send_after,
        subject=subject,
        message=message,
        reference_doctype=doc.doctype,
        reference_name=doc.name,
        reply_to=document_email,
        attachments=attachments,
    )


# Need to part of rtCamp app
def get_send_after(doc):
    """Get thhe email send after value

    Args:
        doc (obj): Email Template DocType Object

    Returns:
        string: datatime string for email send
    """
    if doc.custom_time_to_send_email <= 0 or doc.custom_time_to_send_email > 24:
        return None

    hours_value = doc.custom_time_to_send_email if doc.custom_time_to_send_email != 24 else 0

    hours_value = f"0{hours_value}" if hours_value < 10 else hours_value

    reference_date = nowdate()
    reference_datetime = reference_date + f" {hours_value}:00:00.000000"

    """
    Example:
    Case 1:
        now = 12/01/2023 12:00:00
        reference_datetime = 12/01/2023 13:00:00
        The time_difference will be a positive value in this case, so there's no need to change it.

    Case 2:
        now = 12/01/2023 13:00:00
        reference_datetime = 12/01/2023 12:00:00
        The time_difference will be a negative value in this case, so update the time to the next day with the given time.
     """
    time_differnce = time_diff(reference_datetime, now()).total_seconds()

    if time_differnce <= 0:
        reference_date = add_to_date(nowdate(), days=1)
        reference_datetime = reference_date + f" {hours_value}:00:00.000000"

    return reference_datetime
