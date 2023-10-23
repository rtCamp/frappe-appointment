import frappe
from frappe.utils import nowdate, add_to_date, time_diff, now, get_string_between
from frappe.email.email_body import get_message_id
from frappe.desk.form.load import get_document_email


def send_email_template_mail(doc, args, email_template, recipients=None):
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

	send_after = get_send_after(email_template)

	sender = email_template.custom_sender_email

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
			"has_attachment": 0,
			"communication_type": "Communication",
		}
	)
	comm.insert(ignore_permissions=True)

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

	hours_value = (
		doc.custom_time_to_send_email if doc.custom_time_to_send_email != 24 else 0
	)

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
