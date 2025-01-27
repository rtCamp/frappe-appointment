import base64
import urllib.parse

import frappe
import frappe.utils
import requests


def make_authorization_url():
    ap_settings = frappe.get_single("Appointment Settings")
    if not ap_settings.enable_zoom:
        frappe.throw(
            frappe._(
                "Zoom is not enabled. Please enable it from <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    CLIENT_ID = ap_settings.zoom_client_id
    REDIRECT_URI = frappe.utils.get_url("/api/method/frappe_appointment.helpers.zoom.zoom_callback", full_address=True)

    params = {"client_id": CLIENT_ID, "response_type": "code", "redirect_uri": REDIRECT_URI}
    url = "https://zoom.us/oauth/authorize?" + urllib.parse.urlencode(params)
    return url


def base64_encode(string):
    return base64.b64encode(string.encode()).decode()


@frappe.whitelist(allow_guest=True)
def zoom_callback(code=None):
    """
    Authorization code is sent to callback as per the API configuration
    """
    ap_settings = frappe.get_single("Appointment Settings")
    if not ap_settings.enable_zoom:
        frappe.throw(
            frappe._(
                "Zoom is not enabled. Please enable it from <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    CLIENT_ID = ap_settings.zoom_client_id
    CLIENT_SECRET = ap_settings.get_password("zoom_client_secret")

    if not CLIENT_ID or not CLIENT_SECRET:
        frappe.throw(
            frappe._(
                "Please set Zoom Client ID and Secret in <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    if not code:
        frappe.throw(frappe._("Authorization code is required."))

    g_calendar = frappe.cache.hget("google_calendar", "zoom_authorization_doc")
    if not g_calendar:
        frappe.throw(frappe._("Google Calendar not found."))

    g_calendar = frappe.get_doc("Google Calendar", g_calendar)

    REDIRECT_URI = frappe.utils.get_url("/api/method/frappe_appointment.helpers.zoom.zoom_callback", full_address=True)

    data = {"grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_URI}

    headers = {"Authorization": f"Basic {base64_encode(f'{CLIENT_ID}:{CLIENT_SECRET}')}"}

    response = requests.post("https://zoom.us/oauth/token", data=data, headers=headers)
    response = response.json()

    if "error" in response:
        frappe.throw(response["error"], response["reason"])

    frappe.db.set_value("Google Calendar", g_calendar.name, "custom_zoom_authorization_code", response["access_token"])
    frappe.db.set_value("Google Calendar", g_calendar.name, "custom_zoom_refresh_token", response["refresh_token"])
    frappe.db.set_value("Google Calendar", g_calendar.name, "custom_is_zoom_authorized", True)
    frappe.db.commit()  # nosemgrep : Manual commit required because setting value in db directly

    frappe.cache.hdel("google_calendar", "zoom_authorization_doc")
    frappe.msgprint(frappe._("Zoom authorized successfully."))

    frappe.local.response["type"] = "redirect"
    frappe.local.response["location"] = f"/app/form/Google Calendar/{g_calendar.name}"
    return


@frappe.whitelist()
def get_authorization_url(doc):
    try:
        doc = frappe.get_doc("Google Calendar", doc)
    except frappe.DoesNotExistError:
        frappe.throw(frappe._("Google Calendar not found."))
    frappe.cache.hset("google_calendar", "zoom_authorization_doc", doc.name)
    return {"url": make_authorization_url()}


def reauthorize_zoom(google_calendar):
    ap_settings = frappe.get_single("Appointment Settings")
    CLIENT_ID = ap_settings.zoom_client_id
    CLIENT_SECRET = ap_settings.get_password("zoom_client_secret")

    if not ap_settings.enable_zoom:
        frappe.throw(
            frappe._(
                "Zoom is not enabled. Please enable it from <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    if not CLIENT_ID or not CLIENT_SECRET:
        frappe.throw(
            frappe._(
                "Please set Zoom Client ID and Secret in <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    access_token = frappe.db.get_value("Google Calendar", google_calendar, "custom_zoom_authorization_code")
    refresh_token = frappe.db.get_value("Google Calendar", google_calendar, "custom_zoom_refresh_token")

    if not access_token or not refresh_token:
        frappe.throw(frappe._("Please authorize Zoom first."))

    data = {"grant_type": "refresh_token", "refresh_token": refresh_token}
    headers = {"Authorization": f"Basic {base64_encode(f'{CLIENT_ID}:{CLIENT_SECRET}')}"}
    response = requests.post("https://zoom.us/oauth/token", data=data, headers=headers)
    response = response.json()

    if "error" in response:
        frappe.throw(response["error"], response["reason"])

    access_token = response["access_token"]
    refresh_token = response["refresh_token"]
    frappe.db.set_value("Google Calendar", google_calendar, "custom_zoom_authorization_code", access_token)
    frappe.db.set_value("Google Calendar", google_calendar, "custom_zoom_refresh_token", refresh_token)
    frappe.db.set_value("Google Calendar", google_calendar, "custom_is_zoom_authorized", True)
    frappe.db.commit()  # nosemgrep : Manual commit required because setting value in db directly
    return access_token


def create_meeting(
    google_calendar: str, subject, starts_on, duration, description, timezone="Asia/Kolkata", members=None
):
    ap_settings = frappe.get_single("Appointment Settings")
    CLIENT_ID = ap_settings.zoom_client_id
    CLIENT_SECRET = ap_settings.get_password("zoom_client_secret")

    if not ap_settings.enable_zoom:
        frappe.throw(
            frappe._(
                "Zoom is not enabled. Please enable it from <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    if not CLIENT_ID or not CLIENT_SECRET:
        frappe.throw(
            frappe._(
                "Please set Zoom Client ID and Secret in <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    access_token = frappe.db.get_value("Google Calendar", google_calendar, "custom_zoom_authorization_code")
    refresh_token = frappe.db.get_value("Google Calendar", google_calendar, "custom_zoom_refresh_token")

    if not access_token or not refresh_token:
        frappe.throw(frappe._("Please authorize Zoom first."))

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

    response = requests.post("https://api.zoom.us/v2/users/me/meetings", json=data, headers=headers)
    is_error = not response.ok
    response = response.json()

    if is_error:
        if "code" in response and response["code"] == 124:
            access_token = reauthorize_zoom(google_calendar)
            headers = {"Authorization": f"Bearer {access_token}"}
            response = requests.post("https://api.zoom.us/v2/users/me/meetings", json=data, headers=headers)
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
    ap_settings = frappe.get_single("Appointment Settings")
    CLIENT_ID = ap_settings.zoom_client_id
    CLIENT_SECRET = ap_settings.get_password("zoom_client_secret")

    if not ap_settings.enable_zoom:
        frappe.throw(
            frappe._(
                "Zoom is not enabled. Please enable it from <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    if not CLIENT_ID or not CLIENT_SECRET:
        frappe.throw(
            frappe._(
                "Please set Zoom Client ID and Secret in <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    access_token = frappe.db.get_value("Google Calendar", google_calendar, "custom_zoom_authorization_code")
    refresh_token = frappe.db.get_value("Google Calendar", google_calendar, "custom_zoom_refresh_token")

    if not access_token or not refresh_token:
        frappe.throw(frappe._("Please authorize Zoom first."))

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
        access_token = reauthorize_zoom(google_calendar)
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.patch(f"https://api.zoom.us/v2/meetings/{meeting_id}", json=data, headers=headers)
        if response.ok:
            return True
        res = response.json()
    raise Exception(res)


def delete_meeting(google_calendar: str, meeting_id):
    ap_settings = frappe.get_single("Appointment Settings")
    CLIENT_ID = ap_settings.zoom_client_id
    CLIENT_SECRET = ap_settings.get_password("zoom_client_secret")

    if not ap_settings.enable_zoom:
        frappe.throw(
            frappe._(
                "Zoom is not enabled. Please enable it from <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    if not CLIENT_ID or not CLIENT_SECRET:
        frappe.throw(
            frappe._(
                "Please set Zoom Client ID and Secret in <a href='/app/appointment-settings'>Appointment Settings</a>."
            )
        )

    access_token = frappe.db.get_value("Google Calendar", google_calendar, "custom_zoom_authorization_code")
    refresh_token = frappe.db.get_value("Google Calendar", google_calendar, "custom_zoom_refresh_token")

    if not access_token or not refresh_token:
        frappe.throw(frappe._("Please authorize Zoom first."))

    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.delete(f"https://api.zoom.us/v2/meetings/{meeting_id}", headers=headers)
    if response.ok:
        return True
    res = response.json()
    if "code" in res and res["code"] == 124:
        access_token = reauthorize_zoom(google_calendar)
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.delete(f"https://api.zoom.us/v2/meetings/{meeting_id}", headers=headers)
        if response.ok:
            return True
        res = response.json()
    raise Exception(res)
