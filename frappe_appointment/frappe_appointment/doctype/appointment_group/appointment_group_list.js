frappe.listview_settings["Appointment Group"] = {
  onload: function (listview) {
    const user = frappe.session.user;
    listview.page.add_button(__("My Appointments"), function () {
      listview.filter_area.add([["Members", "user", "=", user]]);
      frappe.show_alert({
        message: __("Filtering by {0} in member list", [user]),
        indicator: "green",
      });
    });
  },
};
