let date = new Date();
let year = date.getFullYear();
let month = date.getMonth();

const day = document.querySelector(".calendar-dates");

const currdate = document.querySelector(".calendar-current-date");

const prenexIcons = document.querySelectorAll(".calendar-navigation span");

console.log('call...................')


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

// Function to generate the calendar
const manipulate = () => {
	// Get the last date of the month
	let dayone = new Date(year, month, 1).getDay();
	let lastdate = new Date(year, month + 1, 0).getDate();
	let dayend = new Date(year, month, lastdate).getDay();

	// Get the last date of the previous month
	let monthlastdate = new Date(year, month, 0).getDate();
	// Variable to store the generated calendar HTML
	let lit = "";
	for (let i = dayone; i > 0; i--) {
		lit += `<li class="inactive">${monthlastdate - i + 1}</li>`;
	}
	// Loop to add the dates of the current month
	for (let i = 1; i <= lastdate; i++) {
		// Check if the current date is today
		let isToday =
			i === date.getDate() && month === date.getMonth() && year === date.getFullYear()
				? "active"
				: "";
		lit += `<li class="${isToday} date">${i}</li>`;
	}
	for (let i = dayend; i < 6; i++) {
		lit += `<li class="inactive">${i - dayend + 1}</li>`;
	}
	currdate.innerText = `${months[month]} ${year}`;

	day.innerHTML = lit;
	//   get_date_on_click();
};

// Attach a click event listener to each icon
prenexIcons.forEach((icon) => {
	// When an icon is clicked
	icon.addEventListener("click", () => {
		month = icon.id === "calendar-prev" ? month - 1 : month + 1;

		if (month < 0 || month > 11) {
			date = new Date(year, month, new Date().getDate());
			year = date.getFullYear();
			month = date.getMonth();
		} else {
			date = new Date();
		}
		manipulate();
		get_date_on_click();
	});
});

const get_date_on_click = () => {
	const dates = document.querySelectorAll("li");
	dates.forEach((date) => {
		date.addEventListener("click", () => {
			dates.forEach((d) => {
				if (d.classList.contains("active")) {
					d.classList.remove("active");
				}
			});
			date.classList.add("active");
			const selected_date = new Date(year, month, parseInt(date.innerHTML));
			console.log(selected_date);
		});
	});
};

$(document).ready(function () {
	manipulate();
	get_date_on_click();
});
