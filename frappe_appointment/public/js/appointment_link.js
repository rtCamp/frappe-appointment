var doctype = null;
var appointment_group = null;

const dialog_setup = {};

window.copy_to_clipboard = function (text) {
  if (!navigator.clipboard) {
    frappe.msgprint(__("Clipboard API not supported. Please copy the value manually: {0}", [text]));
    return;
  }
  navigator.clipboard.writeText(text).then(function () {
    frappe.toast(__("Link Copied"));
  });
};

function compose_mail(frm, subject, recipient, message) {
  const args = {
    doc: frm.doc,
    frm: frm,
    recipients: recipient,
    title: subject,
    subject: subject,
    message: message,
  };

  const email_accounts = frappe.boot.email_accounts
    .filter((account) => {
      return !["All Accounts", "Sent", "Spam", "Trash"].includes(account.email_account) && account.enable_outgoing;
    })
    .map((e) => e.email_id);

  new frappe.views.CommunicationComposer(args);
}

function generate_table(title, data) {
  var html = `<h4>${title}:</h4>`;
  html += `<table class="table table-bordered">
        <thead>
            <tr>
                <th>Event</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>`;
  data.forEach((event) => {
    html += `<tr>
            <td>${event.subject}</td>
            <td>${event.starts_on}</td>
            <td>${event.ends_on}</td>
            <td>${event.status}</td>
            <td><a href="${event.url}" target="_blank">Edit</a></td>
        </tr>`;
  });
  html += `</tbody></table>`;
  // html += "<hr>";
  return html;
}

function generate_appointment_dialogue(r, title) {
  var data = r.message;
  if (!data) {
    frappe.msgprint(__("No appointments found"));
    return;
  }

  const dialog = new frappe.ui.Dialog({
    title: __(title || "Appointments"),
    fields: [
      {
        fieldname: "appointments",
        fieldtype: "HTML",
      },
    ],
  });
  var html = "";
  if (data.ongoing.length > 0) {
    html += generate_table("Ongoing", data.ongoing);
  }
  if (data.upcoming.length > 0) {
    html += generate_table("Upcoming", data.upcoming);
  }
  if (data.past.length > 0) {
    html += generate_table("Past & Closed", data.past);
  }
  dialog.fields_dict.appointments.$wrapper.html(html);
  dialog.show();
}

$(document).on("form-refresh", function (event, frm) {
  if (!doctype || doctype != frm.doctype) {
    doctype = frm.doctype;
    function get_recipient() {
      if (frm.email_field) {
        return frm.doc[frm.email_field];
      } else {
        return frm.doc.email_id || frm.doc.email || "";
      }
    }

    if (dialog_setup[doctype]) {
      return;
    }

    frappe.ui.form.on(doctype, {
      refresh: function (frm) {
        if (doctype == "User Appointment Availability") {
          const personal_meet_menu = frm.page.add_custom_button_group("Personal Meeting");
          frm.page.add_custom_menu_item(personal_meet_menu, __("Copy Schedular Link"), function () {
            frm.trigger("copy_scheduler_link");
          });

          frm.page.add_custom_menu_item(personal_meet_menu, __("View Meetings"), function () {
            frm.trigger("view_personal_meetings");
          });
        }
        frappe.call({
          method:
            "frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group.get_appointment_groups_from_doctype",
          args: {
            doctype: doctype,
          },
          callback: function (r) {
            if (r.message) {
              var appointment_groups = r.message;
              if (appointment_groups.length == 0) {
                return;
              }
              if (appointment_groups.length == 1) {
                appointment_group = appointment_groups[0];
              }

              const appointment_group_menu = frm.page.add_custom_button_group("Appointments");

              frm.page.add_custom_menu_item(appointment_group_menu, __("Schedule"), function () {
                frm.trigger("schedule_appointment");
              });

              frm.page.add_custom_menu_item(appointment_group_menu, __("View"), function () {
                frm.trigger("view_appointment");
              });
              dialog_setup[doctype] = true;
            }
          },
        });
      },
      view_appointment: function (frm) {
        frappe.call({
          method: "frappe_appointment.overrides.event_override.get_events_from_doc",
          args: {
            doctype: doctype,
            docname: frm.docname,
            past_events: true,
          },
          freeze: true,
          callback: function (r) {
            generate_appointment_dialogue(r, "Appointments");
          },
        });
      },
      copy_scheduler_link: function (frm) {
        frappe.call({
          method: "frappe_appointment.api.personal_meet.get_schedular_link",
          args: {
            user: frm.doc.name,
          },
          freeze: true,
          callback: function (r) {
            if (r.message) {
              const dialog = new frappe.ui.Dialog({
                title: __("Scheduler Link"),
                fields: [
                  {
                    fieldname: "scheduler_link",
                    fieldtype: "Data",
                    label: __("Scheduler Link"),
                    read_only: 1,
                    default: r.message.url,
                  },
                  {
                    fieldname: "copy_scheduler_link",
                    fieldtype: "Button",
                    label: __("Copy Link"),
                  },
                  {
                    fieldname: "section_break_1",
                    fieldtype: "Section Break",
                    label: __("Available Meeting Durations:"),
                  },
                  {
                    fieldname: "meeting_durations",
                    fieldtype: "HTML",
                  },
                ],
              });
              dialog.fields_dict.copy_scheduler_link.$input.on("click", function () {
                if (!r.message) {
                  frappe.msgprint(__("No link found"));
                  return;
                }
                if (!navigator.clipboard) return;
                navigator.clipboard.writeText(r.message.url).then(function () {
                  frappe.toast(__("Link Copied"));
                });
              });
              var html = "";
              if (r.message.available_durations.length > 0) {
                html += "<ul>";
                r.message.available_durations.forEach((duration) => {
                  const title = duration.label;
                  const duration_str = duration.duration_str;
                  const link = duration.url;
                  html += `<li>${title} (${duration_str}) <button class="btn btn-default btn-xs" onclick="window.copy_to_clipboard('${link}')">Copy Link</button></li>`;
                });
                html += "</ul>";
              }
              dialog.fields_dict.meeting_durations.$wrapper.html(html);
              dialog.show();
            }
          },
        });
      },
      view_personal_meetings: function (frm) {
        frappe.call({
          method: "frappe_appointment.overrides.event_override.get_personal_meetings",
          args: {
            user: frm.doc.name,
            past_events: true,
          },
          freeze: true,
          callback: function (r) {
            generate_appointment_dialogue(r, "Personal Meetings");
          },
        });
      },
      schedule_appointment: function (frm) {
        var email_id = get_recipient();
        var appointment_link = null;
        const dialog = new frappe.ui.Dialog({
          title: __("Schedule Appointment"),
          fields: [
            {
              fieldname: "appointment_group",
              fieldtype: "Link",
              options: "Appointment Group",
              label: __("Appointment Group"),
              default: appointment_group?.name,
              link_filters: `[["Appointment Group","linked_doctype","=","${doctype}"]]`,
              description: appointment_group
                ? null
                : __(
                    "Multiple appointment groups are available for this doctype. Please select one to schedule an appointment."
                  ),
              reqd: 1,
            },
            {
              fieldname: "event_title",
              fieldtype: "Data",
              label: __("Event Title"),
              default: frm.doc.title || frm.doc.name,
              reqd: 1,
            },
            {
              fieldname: "external_email",
              fieldtype: "Data",
              label: __("To"),
              default: email_id,
              reqd: 1,
            },
            {
              fieldname: "scheduler_link",
              fieldtype: "Data",
              label: __("Scheduler Link"),
              read_only: 1,
              hidden: 1,
            },
            {
              fieldname: "section_break_1",
              fieldtype: "Section Break",
            },
            {
              fieldname: "send_schedular_email",
              fieldtype: "Button",
              label: __("Send Email"),
            },
            {
              fieldname: "column_break_1",
              fieldtype: "Column Break",
            },
            {
              fieldname: "copy_scheduler_link",
              fieldtype: "Button",
              label: __("Copy Scheduler Link"),
            },
          ],
        });
        function update_link() {
          if (
            appointment_group &&
            appointment_group.name &&
            dialog.fields_dict.external_email.$input.val() &&
            dialog.fields_dict.event_title.$input.val()
          ) {
            appointment_link = `${
              appointment_group.route
            }?subject=${dialog.fields_dict.event_title.$input.val()}&event_participants=[{"reference_doctype":"${doctype}","reference_docname":"${
              frm.docname
            }","email":"${dialog.fields_dict.external_email.$input.val()}"}]&custom_doctype_link_with_event=[{"reference_doctype":"${doctype}","reference_docname":"${
              frm.docname
            }","value":"${dialog.fields_dict.external_email.$input.val()}"}]`;
            dialog.fields_dict.scheduler_link.set_value(appointment_link);
            dialog.fields_dict.send_schedular_email.input.disabled = false;
            dialog.fields_dict.copy_scheduler_link.input.disabled = false;
          } else {
            dialog.fields_dict.scheduler_link.set_value("");
            dialog.fields_dict.send_schedular_email.input.disabled = true;
            dialog.fields_dict.copy_scheduler_link.input.disabled = true;
          }
        }
        update_link();
        dialog.fields_dict.external_email.$input.on("change", function () {
          update_link();
        });
        dialog.fields_dict.event_title.$input.on("change", function () {
          update_link();
        });
        dialog.fields_dict.appointment_group.$input_area.find(".link-btn > .btn-clear").on("click", function () {
          appointment_group = null;
          update_link();
        });
        dialog.fields_dict.appointment_group.$input.on("change awesomplete-selectcomplete", function () {
          if (dialog.fields_dict.appointment_group.$input.val()) {
            frappe.call({
              method:
                "frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group.get_appointment_group_from_id",
              args: {
                appointment_group_id: dialog.fields_dict.appointment_group.$input.val(),
              },
              callback: function (r) {
                appointment_group = r.message;
                update_link();
              },
            });
          } else {
            appointment_group = null;
            update_link();
          }
        });
        dialog.fields_dict.copy_scheduler_link.$input.on("click", function () {
          if (!appointment_link) {
            frappe.msgprint(__("Please enter an email to schedule with"));
            return;
          }
          if (!dialog.fields_dict.appointment_group.$input.val()) {
            frappe.msgprint(__("Please select an appointment group"));
            return;
          }
          if (!navigator.clipboard) return;
          navigator.clipboard.writeText(appointment_link).then(function () {
            frappe.toast(__("Link Copied"));
          });
        });
        dialog.fields_dict.send_schedular_email.$input.on("click", function () {
          if (!appointment_link) {
            frappe.msgprint(__("Please enter an email to schedule with"));
            return;
          }
          if (!dialog.fields_dict.appointment_group.$input.val()) {
            frappe.msgprint(__("Please select an appointment group"));
            return;
          }
          const link = dialog.fields_dict.scheduler_link.value;
          const message = `<p>
                        Please select a time and date as per your availability through the scheduler link given:

                        <a href='${link}'>
                            Link
                        </a>
                    </p>`;
          compose_mail(
            frm,
            `Schedule an Appointment: ${dialog.fields_dict.event_title.value}`,
            dialog.fields_dict.external_email.value,
            message
          );
        });

        dialog.show();
      },
    });
  }
});
