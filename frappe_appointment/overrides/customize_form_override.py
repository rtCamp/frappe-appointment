from frappe.custom.doctype.customize_form.customize_form import CustomizeForm


class CareersOverrideCustomizeForm(CustomizeForm):
	"""Need of override
	    1. Frappe, by default, does not allow updating the core doctype properties(Like req,hidden etc). Given overwrite allows importing the defined profile in customization.

	Args:
	    CustomizeForm (class): Default class
	"""

	def allow_property_change(self, prop, meta_df, df):
		"""
		Check if a given property can be exported or not

		Returns:
		    boolean
		"""
		if prop == "hidden":
			return True

		if prop == "read_only":
			return True

		if prop == "depends_on":
			return True

		if prop == "reqd":
			return True

		if prop == "options" and df.get("fieldtype") == "Select":
			return True
		super().allow_property_change(prop, meta_df, df)
