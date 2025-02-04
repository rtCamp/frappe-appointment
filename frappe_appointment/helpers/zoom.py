import base64

import frappe
import frappe.utils
import requests


def base64_encode(string):
    return base64.b64encode(string.encode()).decode()


def reauthorize_zoom():
    zoom_settings = frappe.get_single("Zoom Settings")

    if not zoom_settings.enable_zoom:
        frappe.throw(
            frappe._("Zoom is not enabled. Please enable it from <a href='/app/zoom-settings'>Zoom Settings</a>.")
        )

    ACCOUNT_ID = zoom_settings.account_id
    CLIENT_ID = zoom_settings.client_id
    CLIENT_SECRET = zoom_settings.get_password("client_secret", raise_exception=False)

    if not CLIENT_ID or not CLIENT_SECRET or not ACCOUNT_ID:
        frappe.throw(
            frappe._("Please set Zoom Client ID and Secret in <a href='/app/zoom-settings'>Zoom Settings</a>.")
        )

    data = {"grant_type": "account_credentials", "account_id": ACCOUNT_ID}
    headers = {"Authorization": f"Basic {base64_encode(f'{CLIENT_ID}:{CLIENT_SECRET}')}"}

    response = requests.post("https://zoom.us/oauth/token", data=data, headers=headers)
    response = response.json()

    if "error" in response:
        frappe.throw(response["error"], response["reason"])

    access_token = response["access_token"]

    zoom_settings.reload()
    zoom_settings.access_token = access_token
    zoom_settings.save(ignore_permissions=True)

    return access_token


def create_meeting(
    google_calendar: str, subject, starts_on, duration, description, timezone="Asia/Kolkata", members=None
):
    zoom_settings = frappe.get_single("Zoom Settings")

    if not zoom_settings.enable_zoom:
        frappe.throw(
            frappe._("Zoom is not enabled. Please enable it from <a href='/app/zoom-settings'>Zoom Settings</a>.")
        )

    access_token = zoom_settings.get_password("access_token", raise_exception=False)

    if not access_token:
        access_token = reauthorize_zoom()

    headers = {"Authorization": f"Bearer {access_token}"}

    data = {
        "topic": subject,
        "type": 2,
        "start_time": frappe.utils.get_datetime(starts_on).isoformat(),
        "duration": duration,
        "timezone": timezone,
        "agenda": description,
    }

    if members and isinstance(members, list) and len(members) > 0:
        data["schedule_for"] = ";".join(members)

    g_calendar = frappe.get_doc("Google Calendar", google_calendar)

    user_email = g_calendar.custom_zoom_user_email

    if not user_email:
        frappe.throw(
            frappe._(
                f"Please set Zoom User Email in <a href='/app/google-calendar/{google_calendar}'>Google Calendar</a>."
            )
        )

    response = requests.post(f"https://api.zoom.us/v2/users/{user_email}/meetings", json=data, headers=headers)
    is_error = not response.ok
    response = response.json()

    if is_error:
        if "code" in response and response["code"] == 124:
            access_token = reauthorize_zoom()
            headers = {"Authorization": f"Bearer {access_token}"}
            response = requests.post(f"https://api.zoom.us/v2/users/{user_email}/meetings", json=data, headers=headers)
            is_error = not response.ok
            response = response.json()
        else:
            frappe.throw(response["message"])

    if is_error:
        frappe.throw(response["message"])

    link = response["join_url"]
    return link, response


def update_meeting(
    google_calendar: str, meeting_id, subject, starts_on, duration, description, timezone="Asia/Kolkata", members=None
):
    zoom_settings = frappe.get_single("Zoom Settings")

    if not zoom_settings.enable_zoom:
        frappe.throw(
            frappe._("Zoom is not enabled. Please enable it from <a href='/app/zoom-settings'>Zoom Settings</a>.")
        )

    access_token = zoom_settings.get_password("access_token", raise_exception=False)

    if not access_token:
        access_token = reauthorize_zoom(google_calendar)

    headers = {"Authorization": f"Bearer {access_token}"}

    data = {
        "topic": subject,
        "type": 2,
        "start_time": frappe.utils.get_datetime(starts_on).isoformat(),
        "duration": duration,
        "timezone": timezone,
        "agenda": description,
    }

    if members and isinstance(members, list) and len(members) > 0:
        data["schedule_for"] = ";".join(members)

    response = requests.patch(f"https://api.zoom.us/v2/meetings/{meeting_id}", json=data, headers=headers)
    if response.ok:
        return True
    res = response.json()
    if "code" in res and res["code"] == 124:
        access_token = reauthorize_zoom()
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.patch(f"https://api.zoom.us/v2/meetings/{meeting_id}", json=data, headers=headers)
        if response.ok:
            return True
        res = response.json()
    raise Exception(res)


def delete_meeting(google_calendar: str, meeting_id):
    zoom_settings = frappe.get_single("Zoom Settings")

    if not zoom_settings.enable_zoom:
        frappe.throw(
            frappe._("Zoom is not enabled. Please enable it from <a href='/app/zoom-settings'>Zoom Settings</a>.")
        )

    access_token = zoom_settings.get_password("access_token", raise_exception=False)

    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.delete(f"https://api.zoom.us/v2/meetings/{meeting_id}", headers=headers)
    if response.ok:
        return True
    res = response.json()
    if "code" in res and res["code"] == 124:
        access_token = reauthorize_zoom()
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.delete(f"https://api.zoom.us/v2/meetings/{meeting_id}", headers=headers)
        if response.ok:
            return True
        res = response.json()
    if "code" in res and res["code"] == 3001:  # Meeting not found
        return True
    raise Exception(res)
