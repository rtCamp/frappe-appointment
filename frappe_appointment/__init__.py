__version__ = "1.1.3"

from frappe_appointment import monkey_patch

monkey_patch.patch_all()
