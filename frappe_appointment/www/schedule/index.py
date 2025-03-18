import json
import re

import frappe

no_cache = 1

SCRIPT_TAG_PATTERN = re.compile(r"\<script[^<]*\</script\>")
CLOSING_SCRIPT_TAG_PATTERN = re.compile(r"</script\>")


def get_context(context):
    csrf_token = frappe.sessions.get_csrf_token()
    # nosemgrep
    frappe.db.commit()
    if frappe.session.user == "Guest":
        boot = frappe.website.utils.get_boot_data()
    else:
        try:
            boot = frappe.sessions.get()
        except Exception as e:
            raise frappe.SessionBootFailed from e
    boot["push_relay_server_url"] = frappe.conf.get("push_relay_server_url")

    # add server_script_enabled in boot
    if "server_script_enabled" in frappe.conf:
        enabled = frappe.conf.server_script_enabled
    else:
        enabled = True
    boot["server_script_enabled"] = enabled
    boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))
    boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)

    boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)
    boot_json = json.dumps(boot_json)

    context.update(
        {
            "build_version": frappe.utils.get_build_version(),
            "boot": boot_json,
            "csrf_token": csrf_token,
        }
    )

    context["app_name"] = "Scheduler"

    return context
