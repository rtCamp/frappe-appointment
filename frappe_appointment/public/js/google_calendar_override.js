frappe.ui.form.on("Google Calendar", {
  onload(frm) {
    if (frm.doc.__islocal) {
      const tour_name = "Google Calendar Setup";
      frm.tour.init({ tour_name }).then(() => frm.tour.start());
    }
  },
});
