The given Docs will cover how as end user we can use `Frappe Appointments`

1. Install the app

```
bench get-app git@github.com:rtCamp/frappe-appointment.git
bench --site {sitename} install-app frappe-appointment
```

2. Integrate Google Calendar into frappe site

    - The Google API credentials with Google Calendar Events CRUD permission will be required to fetch the calendar data in the app.
    - Add the api key in Google Settings.
    - Settings: `Integrations > Google Settings`
    
3. Add the user's Google Calendar

    - After adding the API credentials, add the user's Google Calendar and authorize the app. 
    - This will require to make the events, fetch the event information etc.
    - DocType: `Google Calendar`


4. Add the User Appointment Availability

    - Add the user's availability for the week. This will be used while fetching the free slots for the user.
    - DocType: `User Appointment Availability`

5. Add Appointment Group

    - Select the members and create a group to set up the page for scheduling the meeting.
    - Mark `Publish On Website` as true for make the page public.
    - You can define the `webhook` endpoint that the app will call when an event is created. Additionally, you can also pass the data in query parameters.
    - DocType: `Appointment Group`

