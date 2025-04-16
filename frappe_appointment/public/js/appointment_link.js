var doctype = null;
var appointment_group = null;

const dialog_setup = {};

window.copy_to_clipboard = function (text) {
  if (!navigator.clipboard) {
    frappe.msgprint(__("Clipboard API not supported. Please copy the value manually: {0}", [text]));
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
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

function generate_table(data) {
  var html = `<table class="table table-bordered">
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
    reschedule_link = event.reschedule_url
      ? `<button class="btn btn-default btn-xs" onclick="window.copy_to_clipboard('${event.reschedule_url}')">Copy Reschedule Link</button>`
      : "";
    html += `<tr>
            <td>${event.subject}</td>
            <td>${event.starts_on}</td>
            <td>${event.ends_on}</td>
            <td>${event.status}</td>
            <td>
              <div style="display: grid;grid-template-columns: 1fr;gap: 10px;">
                <button class="btn btn-default btn-xs" onclick="window.open('${event.url}', '_blank')">Open Event</button>
                ${reschedule_link}
              </div>
            </td>
        </tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function create_meetings_section(frm, r, title = "Upcoming & Ongoing Meetings") {
  if (frm.doctype === "User Appointment Availability") {
    var html = "<div class='appointment-meeting-container'>";
    is_data_available = false;
    const data = r.message;
    if (data?.ongoing && data.ongoing.length > 0) {
      html += `<div class="appointment-meeting-box appointment-meeting-github" style="margin-top: 20px;">
        <h4>Ongoing Meetings</h4>
        ${generate_table(data.ongoing)}
      </div>`;
      is_data_available = true;
    }
    if (data?.upcoming && data.upcoming.length > 0) {
      html += `<div class="appointment-meeting-box appointment-meeting-github" style="margin-top: 20px;">
        <h4>Upcoming Meetings</h4>
        ${generate_table(data.upcoming)}
      </div>`;
      is_data_available = true;
    }
    if (!is_data_available) {
      html += `<div class="appointment-meeting-box appointment-meeting-github" style="margin-top: 20px;">
        <h4>No Meetings Found</h4>
      </div>`;
    }
    html += "</div>";

    var meeting_section = null;
    const sections = document.querySelectorAll(".form-dashboard-section");
    sections.forEach((section) => {
      if (section.querySelector(".appointment-meeting-container")) {
        meeting_section = section;
      }
    });

    if (meeting_section) {
      meeting_section.querySelector(".section-body").innerHTML = html;
    } else {
      frm.dashboard.add_section(html, __(title));
    }

    make_section_close();
  }
}

function make_section_close() {
  const sections = document.querySelectorAll(".form-dashboard-section");
  sections.forEach((section) => {
    if (section.querySelector(".appointment-meeting-container")) {
      if (!section.querySelector(".section-head").classList.contains("collapsed")) {
        section.querySelector(".section-head").click();
      }
    }
  });
}

function generate_appointment_dialogue(
  r,
  title,
  show_upcoming = true,
  show_past = true,
  show_ongoing = true,
  past_collapsed = true,
  frm = null
) {
  const data = r.message;
  if (!data) {
    frappe.msgprint(__("No appointments found"));
    return;
  }

  if (frm) {
    create_meetings_section(frm, r);
  }

  var fields = [];

  if (show_ongoing && data.ongoing.length > 0) {
    fields.push({
      fieldname: "ongoing_appointments_section",
      fieldtype: "Section Break",
      label: __("Ongoing Appointments"),
    });
    fields.push({
      fieldname: "ongoing_appointments",
      fieldtype: "HTML",
    });
  }
  if (show_upcoming && data.upcoming.length > 0) {
    fields.push({
      fieldname: "upcoming_appointments_section",
      fieldtype: "Section Break",
      label: __("Upcoming Appointments"),
    });
    fields.push({
      fieldname: "upcoming_appointments",
      fieldtype: "HTML",
    });
  }
  if (show_past && data.past.length > 0) {
    fields.push({
      fieldname: "past_appointments_section",
      fieldtype: "Section Break",
      label: __("Past & Closed Appointments"),
      collapsible: past_collapsed ? 1 : 0,
      collapsed: past_collapsed ? 1 : 0,
    });
    fields.push({
      fieldname: "past_appointments",
      fieldtype: "HTML",
    });
  }

  const dialog = new frappe.ui.Dialog({
    title: __(title || "Appointments"),
    fields: fields,
    size: "large",
  });
  if (show_ongoing && data.ongoing.length > 0) {
    dialog.fields_dict.ongoing_appointments.$wrapper.html(generate_table(data.ongoing));
    dialog.fields_dict.ongoing_appointments_section.wrapper.find(".section-head").css("font-size", "1.25em");
  }
  if (show_upcoming && data.upcoming.length > 0) {
    dialog.fields_dict.upcoming_appointments.$wrapper.html(generate_table(data.upcoming));
    dialog.fields_dict.upcoming_appointments_section.wrapper.find(".section-head").css("font-size", "1.25em");
  }
  if (show_past && data.past.length > 0) {
    dialog.fields_dict.past_appointments.$wrapper.html(generate_table(data.past));
    dialog.fields_dict.past_appointments_section.wrapper.find(".section-head").css("font-size", "1.25em");
  }
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
        if (doctype == "User Appointment Availability" && !frm.doc.__islocal) {
          frm.add_custom_button(__("Copy Personal Meeting Link"), () => {
            frm.trigger("copy_appointment_link");
          });

          const personal_meet_menu = frm.page.add_custom_button_group("Personal Meeting");
          frm.page.add_custom_menu_item(personal_meet_menu, __("Appointment Link with Duration"), () => {
            frm.trigger("copy_appointment_link_with_duration");
          });

          frm.page.add_custom_menu_item(personal_meet_menu, __("View Past Meetings"), () => {
            frm.trigger("view_personal_meetings");
          });

          frappe.call({
            method: "frappe_appointment.overrides.event_override.get_personal_meetings",
            args: {
              user: frm.doc.name,
              past_events: true,
            },
            callback: function (r) {
              create_meetings_section(frm, r);
            },
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

              frm.page.add_custom_menu_item(appointment_group_menu, __("Schedule"), () => {
                frm.trigger("schedule_appointment");
              });

              frm.page.add_custom_menu_item(appointment_group_menu, __("View"), () => {
                frm.trigger("view_appointment");
              });
            }
          },
        });
        dialog_setup[doctype] = true;
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
      copy_appointment_link: function (frm) {
        frappe.call({
          method: "frappe_appointment.api.personal_meet.get_schedular_link",
          args: {
            user: frm.doc.name,
          },
          callback: function (r) {
            if (r?.message?.url) {
              if (!navigator.clipboard) {
                frappe.msgprint(
                  __("Clipboard API not supported. Please copy the value manually: {0}", [r.message.url])
                );
                return;
              }
              navigator.clipboard.writeText(r.message.url).then(() => {
                frappe.toast(__("Link Copied"));
              });
            } else {
              frappe.msgprint(
                __("No appointment link found. Please make sure Personal Meetings are enabled for this user.")
              );
            }
          },
        });
      },
      copy_appointment_link_with_duration: function (frm) {
        frappe.call({
          method: "frappe_appointment.api.personal_meet.get_schedular_link",
          args: {
            user: frm.doc.name,
          },
          freeze: true,
          callback: function (r) {
            if (r.message?.available_durations && r.message.available_durations.length > 0) {
              const dialog = new frappe.ui.Dialog({
                title: __("Appointment Link"),
                fields: [
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

              var html = "";
              if (r.message.available_durations.length > 0) {
                html += "<ul style='display:grid;gap:5px;'>";
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
            } else {
              frappe.msgprint(
                __("No appointment link found. Please make sure Personal Meetings are enabled for this user.")
              );
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
            generate_appointment_dialogue(r, "Past Meetings", false, true, false, false, frm);
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
              fieldname: "appointment_link",
              fieldtype: "Data",
              label: __("Appointment Link"),
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
              fieldname: "copy_appointment_link",
              fieldtype: "Button",
              label: __("Copy Appointment Link"),
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
            dialog.fields_dict.appointment_link.set_value(appointment_link);
            dialog.fields_dict.send_schedular_email.input.disabled = false;
            dialog.fields_dict.copy_appointment_link.input.disabled = false;
          } else {
            dialog.fields_dict.appointment_link.set_value("");
            dialog.fields_dict.send_schedular_email.input.disabled = true;
            dialog.fields_dict.copy_appointment_link.input.disabled = true;
          }
        }
        update_link();
        dialog.fields_dict.external_email.$input.on("change", () => {
          update_link();
        });
        dialog.fields_dict.event_title.$input.on("change", () => {
          update_link();
        });
        dialog.fields_dict.appointment_group.$input_area.find(".link-btn > .btn-clear").on("click", () => {
          appointment_group = null;
          update_link();
        });
        dialog.fields_dict.appointment_group.$input.on("change awesomplete-selectcomplete", () => {
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
        dialog.fields_dict.copy_appointment_link.$input.on("click", () => {
          if (!appointment_link) {
            frappe.msgprint(__("Please enter an email to schedule with"));
            return;
          }
          if (!dialog.fields_dict.appointment_group.$input.val()) {
            frappe.msgprint(__("Please select an appointment group"));
            return;
          }
          if (!navigator.clipboard) return;
          navigator.clipboard.writeText(appointment_link).then(() => {
            frappe.toast(__("Link Copied"));
          });
        });
        dialog.fields_dict.send_schedular_email.$input.on("click", () => {
          if (!appointment_link) {
            frappe.msgprint(__("Please enter an email to schedule with"));
            return;
          }
          if (!dialog.fields_dict.appointment_group.$input.val()) {
            frappe.msgprint(__("Please select an appointment group"));
            return;
          }
          const link = dialog.fields_dict.appointment_link.value;
          const message = `<p>
                        Please select a time and date as per your availability through the appointment link given:

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
