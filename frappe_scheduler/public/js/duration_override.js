function duration_string_to_seconds(value) {
  if (!value) {
    return "0";
  }

  // try to parse int. If success, return it without any conversion
  if (!isNaN(value)) {
    return value;
  }

  let seconds = 0;
  // parts = [[2, "Days"], [5, "h"], [30, "M"], [10, "sec"]]
  // using regex, find all the numbers and units, and then convert to seconds
  let parts = value.match(/(\d+)\s*([a-zA-Z]+)/g);
  if (parts) {
    parts.forEach((part) => {
      let unit = part.match(/[a-zA-Z]/)[0].toLowerCase();
      let number = cint(part.match(/\d+/)[0]);
      if (unit === "d") {
        seconds += number * 24 * 60 * 60;
      } else if (unit === "h") {
        seconds += number * 60 * 60;
      } else if (unit === "m") {
        seconds += number * 60;
      } else if (unit === "s") {
        seconds += number;
      }
    });
  }
  return seconds.toString();
}

frappe.ui.form.ControlDuration = class extends frappe.ui.form.ControlDuration {
  bind_events() {
    super.bind_events();

    this.$wrapper.find(".duration-input").click((e) => {
      e.stopPropagation(); // prevent the focus event of $input from firing (in case of child table).
    });

    this.$wrapper.find(".duration-input").blur((e) => {
      // if blur event is due to clicking on the picker, or other input box, don't hide the picker.
      if (e.relatedTarget && e.relatedTarget.classList.contains("duration-input")) {
        return;
      }
      this.$picker.hide();
    });
  }

  parse(value) {
    return duration_string_to_seconds(value);
  }
};
