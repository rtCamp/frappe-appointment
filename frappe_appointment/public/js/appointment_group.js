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

let days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
let todaySlotsData = {};

function getDay(date) {
  // get day of the week from date, considering Monday as the first day of the week
  let day = date.getDay() - 1;
  if (day == -1) {
    day = 6;
  }
  return day;
}

// HTML Updates
const manipulate = () => {
  /**
   * This function will generate the date element of the given month based on the year and month values.
   */
  let dayone = getDay(new Date(year, month, 1));
  let lastdate = new Date(year, month + 1, 0).getDate();
  let dayend = getDay(new Date(year, month, lastdate));

  let monthlastdate = new Date(year, month, 0).getDate();

  let lit = "";
  for (let i = dayone; i > 0; i--) {
    lit += `<li class="date past">${monthlastdate - i + 1}</li>`;
  }

  for (let i = 1; i <= lastdate; i++) {
    lit += `<li class="date">${i}</li>`;
  }

  for (let i = dayend; i < 6; i++) {
    lit += `<li class="date next">${i - dayend + 1}</li>`;
  }
  currdate.innerText = `${months[month]} ${year}`;
  day.innerHTML = lit;
};

const get_date_on_click = () => {
  /**
   * Add an onclick event to the dates of the current month based on valid start and end times
   */
  const vaild_start_date = new Date(todaySlotsData.valid_start_date);
  const valid_end_date = todaySlotsData.valid_end_date ? new Date(todaySlotsData.valid_end_date) : "";

  const dates = document.querySelectorAll(".date");

  dates.forEach((date) => {
    const selected_date = new Date(year, month + get_day_increment(date), parseInt(date.innerHTML));

    const available_days = todaySlotsData.available_days.map((day) => days.indexOf(day));

    // Check is day is available
    if (!available_days.includes(getDay(selected_date))) {
      date.classList.add("inactive");
      return;
    }

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
      year = selected_date.getFullYear();
      month = selected_date.getMonth();
      setURLSearchParam("date", get_date_str(selected_date));
      get_time_slots();
    });
  });
};

function update_active_date() {
  const dates = document.querySelectorAll(".date");
  dates.forEach((d) => {
    const selected_date = get_date_str(new Date(year, month + get_day_increment(d), parseInt(d.innerHTML)));

    if (selected_date == getURLSearchParam("date")) {
      d.classList.add("active");
    } else {
      d.classList.remove("active");
    }
  });
}

function update_time_slots_html() {
  if (!todaySlotsData.all_available_slots_for_data) {
    return;
  }

  all_available_slots_for_data = todaySlotsData.all_available_slots_for_data;

  const timeslot_container = document.querySelector(".timeslot-container");

  timeslot_container.innerHTML = "";

  for (let index = 0; index < all_available_slots_for_data.length; index++) {
    let start_time = new Date(all_available_slots_for_data[index].start_time);
    let end_time = new Date(all_available_slots_for_data[index].end_time);

    const format_am_pm_start = format_am_pm(start_time);
    const format_am_pm_end = format_am_pm(end_time);

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

  if (all_available_slots_for_data.length == 0) {
    timeslot_container.innerHTML = `<div class="timeslot-empty">No open time slots</div>`;
  }
}

function update_calander() {
  /*** Main function to update calander ui */
  manipulate();
  update_active_date();
  get_date_on_click();
  update_time_slots_html();
  set_month_arrow_state();

  const date = new Date(todaySlotsData.date);
  today_day.innerHTML = `${days[getDay(date)]} ${date.getDate()}`;
}

// API Calls
function get_time_slots(re_call = true, date_change_behavior = "next") {
  show_loader();
  frappe
    .call("frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group.get_time_slots_for_day", {
      appointment_group_id: get_appointment_group(),
      date: getURLSearchParam("date"),
      user_timezone_offset: -new Date().getTimezoneOffset(),
    })
    .then((r) => {
      if (!r?.message) {
        return setdaySlotsData();
      }

      if (r.message.is_invalid_date) {
        if (date_change_behavior == "next") {
          date = new Date(r.message.next_valid_date);
        } else {
          date = new Date(r.message.prev_valid_date);
        }
        setURLSearchParam("date", get_date_str(date));
        year = date.getFullYear();
        month = date.getMonth();
        todaySlotsData = r.message;
        if (re_call) {
          get_time_slots(false);
        } else {
          setdaySlotsData();
        }
        return;
      }

      setdaySlotsData(r.message);
    });
}

function setdaySlotsData(daySlotsData = false) {
  if (!daySlotsData) {
    daySlotsData = {
      all_available_slots_for_data: [],
      appointment_group_id: get_appointment_group(),
      date: getURLSearchParam("date"),
      valid_start_date: todaySlotsData?.valid_start_date || new Date().toUTCString(),
      valid_end_date: todaySlotsData?.valid_end_date || new Date().toUTCString(),
      available_days: todaySlotsData?.available_days || [],
    };
  }
  todaySlotsData = daySlotsData;
  update_calander();
  hide_loader();
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
      user_timezone_offset: -new Date().getTimezoneOffset(),
      ...get_all_query_param(),
      event_participants: !getURLSearchParam("event_participants")
        ? []
        : getURLSearchParam("event_participants").replaceAll("\\", ""),
      custom_doctype_link_with_event: !getURLSearchParam("custom_doctype_link_with_event")
        ? []
        : getURLSearchParam("custom_doctype_link_with_event").replaceAll("\\", ""),
    })
    .then((r) => {
      let url = new URL(window.location.href);
      params = get_all_query_param();
      Object.keys(params).forEach(function (key) {
        url.searchParams.delete(key);
      });
      const updatedURL = url.toString();
      history.replaceState(null, null, updatedURL);
      hide_loader();
      $("#cal-main-container").remove();
      $("#appointment-success").removeClass("hidden");
    })
    .catch((e) => {
      cancel_button.click();
      hide_loader();
    });
}

// Helpers

function get_day_increment(date) {
  let increment = 0;

  if (date.classList.contains("next")) {
    increment = 1;
  } else if (date.classList.contains("past")) {
    increment = -1;
  }

  return increment;
}

function change_month_active_state(value, icon) {
  const vaild_start_date = new Date(todaySlotsData.valid_start_date);
  const valid_end_date = todaySlotsData.valid_end_date ? new Date(todaySlotsData.valid_end_date) : "";

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

function check_one_time_schedule() {
  show_loader();
  frappe
    .call("frappe_appointment.overrides.event_override.check_one_time_schedule", {
      appointment_group_id: get_appointment_group(),
      custom_doctype_link_with_event: !getURLSearchParam("custom_doctype_link_with_event")
        ? []
        : getURLSearchParam("custom_doctype_link_with_event").replaceAll("\\", ""),
    })
    .then((r) => {
      get_time_slots();
      manipulate();
    })
    .catch((e) => {
      cancel_button.click();
      hide_loader();
    });
}

// Events
document.addEventListener("DOMContentLoaded", function () {
  // set_date();
  // check_one_time_schedule();
  // Redirect to the new UI at '/schedule/gr/:appointment_group_id?...'
  const appointment_group_id = get_appointment_group();
  window.location.href = `/schedule/gr/${appointment_group_id}${window.location.search}`;
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

  add_event_slots(todaySlotsData.all_available_slots_for_data[select_index]);
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
    date = icon.id === "calendar-prev" ? new Date(year, month + 1, 0) : new Date(year, month, 1);
    year = date.getFullYear();
    month = date.getMonth();
    setURLSearchParam("date", get_date_str(date));
    get_time_slots(true, icon.id === "calendar-prev" ? "prev" : "next");
    cancel_button.click();
  });
});
