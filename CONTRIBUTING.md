## Contribution Guide

1. Create a new Frappe site with [Frappe Manager](https://github.com/rtCamp/frappe-manager).

2. Install the app on the site.

```bash
bench get-app https://github.com/rtCamp/frappe-scheduler
bench --site [site-name] install-app frappe_scheduler
```

2. Set up [pre-commit](https://pre-commit.com/) in the app.

```bash
pre-commit install
```

3. Push the code to the given branch.

```bash
git pull origin main # Make sure to pull the latest changes before making the PR

git checkout -b "new/branch"
git add --all
git commit -m ".."
git push origin "new/branch"
```

For branch names and commit messages, follow the guidelines at: https://www.conventionalcommits.org/en/v1.0.0/