__version__ = "0.0.1"

from frappe_appointment import monkey_patch

monkey_patch.patch_all()
