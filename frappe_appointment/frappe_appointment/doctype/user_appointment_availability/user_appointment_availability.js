// Copyright (c) 2023, rtCamp and contributors
// For license information, please see license.txt

var og_slug = null;

frappe.ui.form.on("User Appointment Availability", {
  refresh(frm) {
    og_slug = frm.doc.slug;
    if (frm.doc.__islocal) {
      frm.set_value("user", frappe.session.user);
      frappe.call({
        method:
          "frappe_appointment.frappe_appointment.doctype.appointment_settings.appointment_settings.get_default_email_template",
        callback: function (r) {
          if (r.message?.personal) {
            frm.set_value("response_email_template", r.message.personal);
          }
        },
      });
    }
  },
  slug(frm) {
    regex = /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/;
    if (frm.doc.slug === "" || frm.doc.slug === og_slug) {
      frm.set_df_property("slug", "description", "");
    } else if (!regex.test(frm.doc.slug)) {
      frm.set_df_property(
        "slug",
        "description",
        "<p class='red'>Slug can only contain lowercase letters, numbers, underscores (_) and hyphens (-), and cannot start or end with a hyphen.</p>"
      );
    } else {
      frappe.call({
        method:
          "frappe_appointment.frappe_appointment.doctype.user_appointment_availability.user_appointment_availability.is_slug_available",
        args: {
          slug: frm.doc.slug,
        },
        callback: function (r) {
          if (r.message) {
            if (r.message.is_available) {
              frm.set_df_property("slug", "description", "<p class='green'>Available</p>");
            } else if (r.message.suggested_slug) {
              frm.set_df_property(
                "slug",
                "description",
                `<p class='red'>This slug is not available. You can use <a class="desc_link" id="suggested_slug">${r.message.suggested_slug}</a> instead.</p>`
              );

              $("#suggested_slug").unbind("click"); // Prevent multiple click events
              $("#suggested_slug").click(function () {
                frm.set_value("slug", $(this).text());
              });
            } else {
              frm.set_df_property(
                "slug",
                "description",
                "<p class='red'>This slug is not available. Please choose another.</p>"
              );
            }
          }
        },
      });
    }
  },
  onload(frm) {
    if (frm.doc.__islocal) {
      const tour_name = "User Appointment Availability Setup";
      frm.tour.init({ tour_name }).then(() => frm.tour.start());
    }
  },
});
