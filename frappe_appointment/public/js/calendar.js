let date = new Date();
let year = date.getFullYear();
let month = date.getMonth();

const day = document.querySelector(".calendar-dates");
const currdate = document.querySelector(".calendar-current-date");
const prenexIcons = document.querySelectorAll(".calendar-navigation span");
const submit_button = document.querySelector(".submit");
const cancel_button = document.querySelector(".cancel");
const loading_container = document.querySelector(".loading-container");
const today_day = document.querySelector(".today-day");

// Array of month names
const months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
let todaySlotsData = {};

// HTML Updates
const manipulate = () => {
	let dayone = new Date(year, month, 1).getDay();
	let lastdate = new Date(year, month + 1, 0).getDate();
	let dayend = new Date(year, month, lastdate).getDay();

	let monthlastdate = new Date(year, month, 0).getDate();

	let lit = "";
	for (let i = dayone; i > 0; i--) {
		lit += `<li class="inactive">${monthlastdate - i + 1}</li>`;
	}

	for (let i = 1; i <= lastdate; i++) {
		lit += `<li class="date">${i}</li>`;
	}

	for (let i = dayend; i < 6; i++) {
		lit += `<li class="inactive">${i - dayend + 1}</li>`;
	}
	currdate.innerText = `${months[month]} ${year}`;
	day.innerHTML = lit;
};

const get_date_on_click = () => {
	const vaild_start_date = new Date(todaySlotsData.valid_start_date);
	const valid_end_date = todaySlotsData.valid_end_date
		? new Date(todaySlotsData.valid_end_date)
		: "";

	const dates = document.querySelectorAll(".date");

	dates.forEach((date) => {
		const selected_date = new Date(year, month, parseInt(date.innerHTML));

		if (selected_date < vaild_start_date) {
			date.classList.add("inactive");
			return;
		}

		if (valid_end_date != "" && valid_end_date < selected_date) {
			date.classList.add("inactive");
			return;
		}

		date.addEventListener("click", () => {
			dates.forEach((d) => {
				if (d.classList.contains("active")) {
					d.classList.remove("active");
				}
			});

			date.classList.add("active");
			setURLSearchParam("date", get_date_str(selected_date));
			get_time_slots();
		});
	});
};

function update_active_date() {
	const dates = document.querySelectorAll(".date");
	dates.forEach((d) => {
		const selected_date = get_date_str(new Date(year, month, parseInt(d.innerHTML)));

		if (selected_date == getURLSearchParam("date")) {
			d.classList.add("active");
		} else {
			d.classList.remove("active");
		}
	});
}

function update_time_slots_html() {
	if (!todaySlotsData.all_avaiable_slots_for_data) {
		return;
	}

	all_avaiable_slots_for_data = todaySlotsData.all_avaiable_slots_for_data;

	const timeslot_container = document.querySelector(".timeslot-container");

	timeslot_container.innerHTML = "";

	for (let index = 0; index < all_avaiable_slots_for_data.length; index++) {
		const format_am_pm_start = format_am_pm(
			new Date(all_avaiable_slots_for_data[index].start_time)
		);
		const format_am_pm_end = format_am_pm(
			new Date(all_avaiable_slots_for_data[index].end_time)
		);

		const div = document.createElement("div");

		div.className = "timeslot";

		div.textContent = `${format_am_pm_start} - ${format_am_pm_end}`;

		div.addEventListener("click", function (ele) {
			const all_time_slots = document.querySelectorAll(".timeslot");

			all_time_slots.forEach((slot) => {
				slot.classList.remove("timeslot-active");
			});

			div.classList.add("timeslot-active");
			submit_button.classList.remove("submit-inactive");
		});

		timeslot_container.append(div);
	}

	if (all_avaiable_slots_for_data.length == 0) {
		timeslot_container.innerHTML = `<div class="timeslot-empty">No open time slots</div>`;
	}
}

function update_calander() {
	manipulate();
	update_active_date();
	get_date_on_click();
	update_time_slots_html();
	set_month_arrow_state();

	const date = new Date(todaySlotsData.date);
	today_day.innerHTML = `${days[date.getDay()]} ${date.getDate()}`;
}

// API Calls
function get_time_slots() {
	show_loader();
	frappe
		.call(
			"frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group.get_time_slots_for_day",
			{
				appointment_group_id: get_appointment_group(),
				date: getURLSearchParam("date"),
			}
		)
		.then((r) => {
			if (r.message.is_invalid_date) {
				date = new Date(r.message.valid_start_date);
				setURLSearchParam("date", get_date_str(date));
				year = date.getFullYear();
				month = date.getMonth();
				todaySlotsData = r.message;
				get_time_slots();
				return;
			}
			todaySlotsData = r.message;
			update_calander();
			hide_loader();
		}).catch((e) => {
			hide_loader();
		});
}

function add_event_slots(time_slots) {
	show_loader();
	frappe
		.call("frappe_appointment.overrides.event_override.create_event_for_appointment_group", {
			appointment_group_id: get_appointment_group(),
			start_time: time_slots.start_time,
			end_time: time_slots.end_time,
			subject: getURLSearchParam("subject"),
			date: getURLSearchParam("date"),
			...get_all_query_param(),
			event_participants: !getURLSearchParam("event_participants")
				? []
				: getURLSearchParam("event_participants").replaceAll("\\", ""),
			custom_doctype_link_with_event: !getURLSearchParam("custom_doctype_link_with_event")
				? []
				: getURLSearchParam("custom_doctype_link_with_event").replaceAll("\\", ""),
		})
		.then((r) => {
			frappe.show_alert("Successfully selected the slots. Thank you!", 5);
			setTimeout(() => {
				hide_loader();
				window.location.href = "/";
			}, 3000);
		})
		.catch((e) => {
			cancel_button.click();
			hide_loader();
		});
}

// Helpers

function change_month_active_state(value, icon) {
	const vaild_start_date = new Date(todaySlotsData.valid_start_date);
	const valid_end_date = todaySlotsData.valid_end_date
		? new Date(todaySlotsData.valid_end_date)
		: "";

	if (icon.id === "calendar-prev") {
		const last_date = new Date(year, month, 0);

		if (last_date < vaild_start_date) {
			icon.classList.add("inactive-month");
		} else {
			icon.classList.remove("inactive-month");
		}
	} else {
		const next_date = new Date(year, month + value, 1);

		if (valid_end_date != "" && valid_end_date < next_date) {
			icon.classList.add("inactive-month");
		} else {
			icon.classList.remove("inactive-month");
		}
	}
}

function set_date() {
	if (!getURLSearchParam("date")) {
		setURLSearchParam("date", get_today_str());
	} else {
		date = new Date(getURLSearchParam("date"));
		year = date.getFullYear();
		month = date.getMonth();
	}
}

function get_date_str(date) {
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function get_today_str() {
	return get_date_str(new Date());
}

function setURLSearchParam(key, value) {
	const url = new URL(window.location.href);
	url.searchParams.set(key, value);
	window.history.pushState({ path: url.href }, "", url.href);
}

function get_appointment_group() {
	const list = window.location.href.split("/");
	return list[list.length - 1].split("?")[0];
}

function getURLSearchParam(key) {
	const url = new URL(window.location.href);
	return url.searchParams.get(key);
}

function format_am_pm(date) {
	let hours = date.getHours();
	let minutes = date.getMinutes();
	let ampm = hours >= 12 ? "PM" : "AM";
	hours = hours % 12;
	hours = hours ? hours : 12;
	minutes = minutes < 10 ? "0" + minutes : minutes;
	return hours + ":" + minutes + " " + ampm;
}

function get_all_query_param() {
	const url = new URL(window.location.href);
	query = {};

	for (const param of url.searchParams) {
		query[param[0]] = param[1];
	}

	return query;
}

function show_loader() {
	loading_container.classList.add("loading-container-active");
	document.body.classList.add("disable-body");
}

function hide_loader() {
	loading_container.classList.remove("loading-container-active");
	document.body.classList.remove("disable-body");
}

function set_month_arrow_state() {
	prenexIcons.forEach((icon) => {
		change_month_active_state(1, icon);
	});
}

// Events
document.addEventListener("DOMContentLoaded", function () {
	set_date();
	get_time_slots();
	manipulate();
});

submit_button.addEventListener("click", function () {
	const all_time_slots = document.querySelectorAll(".timeslot");

	let select_index = -1;

	for (let index = 0; index < all_time_slots.length; index++) {
		if (all_time_slots[index].classList.contains("timeslot-active")) {
			select_index = index;
			break;
		}
	}

	add_event_slots(todaySlotsData.all_avaiable_slots_for_data[select_index]);
});

cancel_button.addEventListener("click", function () {
	const all_time_slots = document.querySelectorAll(".timeslot");
	for (let index = 0; index < all_time_slots.length; index++) {
		all_time_slots[index].classList.remove("timeslot-active");
	}
	submit_button.classList.add("submit-inactive");
});

prenexIcons.forEach((icon) => {
	icon.addEventListener("click", () => {
		month = icon.id === "calendar-prev" ? month - 1 : month + 1;
		date =
			icon.id === "calendar-prev" ? new Date(year, month + 1, 0) : new Date(year, month, 1);
		year = date.getFullYear();
		month = date.getMonth();
		setURLSearchParam("date", get_date_str(date));
		get_time_slots();
		cancel_button.click();
	});
});
