frappe.ui.form.on("User", {
  refresh(frm) {
    frm.add_custom_button(
      __("Setup Google Calendar"),
      function () {
        frm.trigger("setup_new_google_calendar");
      },
      "Actions"
    );
    frm.add_custom_button(
      __("Setup User Availability"),
      function () {
        frm.trigger("setup_user_availability");
      },
      "Actions"
    );
  },
  setup_user_availability(frm) {
    frappe.call({
      method: "frappe_appointment.api.utils.check_google_calendar_setup",
      args: {
        user: frm.doc.name,
      },
      callback: function (r) {
        if (r?.message?.user_appointment_availability) {
          frappe.set_route("form", "User Appointment Availability", r.message.user_appointment_availability);
          return;
        }
        if (!r.message?.is_google_calendar_setup) {
          frappe.confirm(
            __("You don't have a Google Calendar setup yet. Would you like to setup it first?"),
            () => frm.trigger("setup_new_google_calendar"),
            () => frappe.set_route("user-appointment-availability/new")
          );
        } else if (!r.message?.is_google_calendar_enabled) {
          frappe.confirm(
            __("No Google Calendar is enabled for this user. Would you like to enable it first?"),
            () => {
              if (r.message.google_calendar_id) {
                frappe.set_route("form", "Google Calendar", r.message.google_calendar_id);
              } else {
                frappe.set_route("list", "Google Calendar", { user: frm.doc.name });
              }
            },
            () => frappe.set_route("user-appointment-availability/new")
          );
        } else if (!r.message?.is_google_calendar_authorized) {
          frappe.confirm(
            __("Google Calendar is not authorized for this user. Would you like to authorize it first?"),
            () => {
              if (r.message.google_calendar_id) {
                frappe.set_route("form", "Google Calendar", r.message.google_calendar_id);
              } else {
                frappe.set_route("list", "Google Calendar", { user: frm.doc.name, enable: 1 });
              }
            },
            () => frappe.set_route("user-appointment-availability/new")
          );
        } else {
          frappe.set_route("user-appointment-availability/new");
        }
      },
    });
  },
  setup_new_google_calendar(frm) {
    frappe.set_route("google-calendar/new");
  },
});
