<div align="center">
<img src="https://github.com/user-attachments/assets/a34e9ad0-0cba-44d4-a6e5-11b331554294" height="128" alt="Frappe Scheduler">
<h2>Frappe Scheduler</h2>
   Frappe app designed to streamline meeting scheduling with smart integrations.
</div>
<br>
<div align="center">
<img src="https://github.com/user-attachments/assets/a5711327-477a-45aa-a9d8-acef1ab00848" style="width:80%" alt="Frappe Scheduler">
</div>

## Key Features

- **[Personal Meetings](https://github.com/rtCamp/frappe-scheduler/wiki/Personal-Meetings)**: Share a personal scheduling link for one-on-one meetings.  
- **[Group Meetings](https://github.com/rtCamp/frappe-scheduler/wiki/Group-Meetings)**: Share a group scheduling link to coordinate meetings with multiple participants. 
- **Google Calendar Integration**: Syncs with Google Calendar to prevent scheduling conflicts.
- **ERPNext Leave Integration**: Blocks time slots based on ERPNext leave records.
- **Zoom & Google Meet Integration**: Auto-generates meeting links for Zoom and Google Meet.
- **Rescheduling Support**: Enables participants to reschedule meetings easily.
 

## Installation

Run the following command to install the app.

```bash
bench get-app git@github.com:rtCamp/frappe-scheduler.git
bench --site [site-name] install-app frappe-scheduler
bench --site [site-name] migrate
bench restart
```

For local development, check out our dev-tool for seamlessly building Frappe apps: [frappe-manager](https://github.com/rtCamp/Frappe-Manager)  
NOTE: If using `frappe-manager`, you might require to `fm restart` to provision the worker queues.

## System Setup
Visit the detailed [System Setup Guide](https://github.com/rtCamp/frappe-scheduler/wiki/System-Setup) on wiki.

## Documentation

Please refer to our [Wiki](https://github.com/rtCamp/frappe-scheduler/wiki/) for details.

## Contribution Guide

Please read [contribution.md](./CONTRIBUTING.md) for details.

## License

This project is licensed under the [AGPLv3 License](./LICENSE).
