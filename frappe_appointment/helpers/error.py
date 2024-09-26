import frappe


def send_http_response(status_code: int, data: object) -> None:
    frappe.response.http_status_code = status_code
    return data
