frappe.ui.form.on("Google Calendar", {
  custom_authorize_zoom: function (frm) {
    frappe.call({
      method: "frappe_appointment.helpers.zoom.get_authorization_url",
      args: {
        doc: frm.doc.name,
      },
      callback: function (r) {
        if (r.message) {
          window.location.href = r.message.url;
        }
      },
    });
  },
});
