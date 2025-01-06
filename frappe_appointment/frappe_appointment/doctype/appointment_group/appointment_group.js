frappe.ui.form.on("Appointment Group", {
    refresh: function (frm) {
        if (!frm.doc.available_slots_data) {
            $(".available-slots-section").remove();
            return;
        }
        addAvailableSlotsInfo(frm);
        frm.add_custom_button(__("Update Slots Availability"), function () {
            update_slots_availability(frm);
        });
    },
});


frappe.realtime.on("appointment_group_availability_updated", function (data) {
    frappe.show_alert({
        message:__('Slots availability updated'),
        indicator:'green'
    }, 5);
    cur_frm.reload_doc();
});

function update_slots_availability(frm) {
    frappe.show_alert({
        message:__('Updating slots availability in background'),
        indicator:'blue'
    }, 5);
    frappe.call({
        method: "frappe_appointment.tasks.verify_availability.update_availability_status_for_appointment_group",
        args: {
            appointment_group: frm.doc.name,
        },
        callback: function (response) {
        },
    });
}


function addAvailableSlotsInfo(frm) {
    data = frm.doc.available_slots_data;
    last_updated = frm.doc.slots_data_updated_at;
    if (!data)
        return;
    data = JSON.parse(data);
    if (data.length == 0) {
        return;
    }
    let available_slots = [];
    for (let date in data) {
        available_slots.push({
            date: date,
            slots: data[date]
        });
    }
    
    let table = $(`<table class="table table-bordered small" style="white-space: nowrap;"></table>`);
    let thead = $(`<thead></thead>`).appendTo(table);
    let tbody = $(`<tbody></tbody>`).appendTo(table);
    let tr = $(`<tr></tr>`).appendTo(thead);
    available_slots.forEach(slot => {
            tr.append(`<th>${slot.date}</th>`);
        });
    let tr2 = $(`<tr></tr>`).appendTo(tbody);
    available_slots.forEach(slot => {
        tr2.append(`<td>${slot.slots}</td>`);
    });
    $(".available-slots-section").remove();
    let html = "";
    if (last_updated) {
        const last_updated_str = frappe.datetime.str_to_user(last_updated);
        html += "<h6>Last Updated: " + last_updated_str + "</h6>";
    }
    html += "<div class='available-slots-section'>";
    html += table.prop('outerHTML');
    html += "</div>";
    frm.dashboard.add_section(html, __("Available Slots"), "available-slots-section overflow-x-scroll");
}