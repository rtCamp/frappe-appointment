__version__ = "1.1.0"

from frappe_appointment import monkey_patch

monkey_patch.patch_all()
