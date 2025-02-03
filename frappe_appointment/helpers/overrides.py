from functools import wraps

import frappe


def add_response_code(func):
    """Function to add response code to the response"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        resp = func(*args, **kwargs)
        if type(resp) is tuple:
            resp, status_code = resp
            # set status code in response
            frappe.local.response.http_status_code = status_code
        return resp

    return wrapper
