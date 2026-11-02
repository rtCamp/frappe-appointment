__version__ = "1.2.1"

from frappe_appointment import monkey_patch

monkey_patch.patch_all()
