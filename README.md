# Daily Todo — Browser Demo

This `codex/browser-demo` branch is a standalone, static demo of Daily Todo. Open it and try the task list and calendar without signing in. The fictional examples and your changes stay in your browser’s localStorage. Visitors do not share a database.

The demo is based on committed version `ddf98ad` of the production application. The production version remains on `main`. The public demo is available at **[daily-todo-demo.pages.dev](https://daily-todo-demo.pages.dev/)** on Cloudflare Pages. It is separate from the NAS-hosted production application.

## Try the demo locally

Serve **only `dist/`** with any static HTTP server. There is no build step or application dependency. For example, from the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Python here is only a convenient local static file server; the deployed demo needs no Python runtime, SQLite, Pages Functions, or other backend. Use HTTP rather than opening `index.html` as a `file://` URL, because the browser loads JavaScript modules.

## What you can try

- Create and edit tasks and notes, complete or reopen them, and stop tasks you no longer plan to do.
- Select dates, change months, and return to Today. Unfinished tasks carry forward; past days preserve their historical text and status. Future tasks cannot be completed early. Date boundaries use `Asia/Hong_Kong`.
- Reload the page to keep changes in the same browser. Use **Reset sample data** to replace this demo’s tasks and history with fresh examples. Reset requires confirmation and only overwrites `daily-todo-demo-v1`; other localStorage entries and appearance preferences are left alone.
- Switch between four languages and ten themes in Settings. There is no account, password change, or sign-out in the demo.
- Export the browser’s demo tasks and history as JSON or YML. YML uses JSON-compatible YAML 1.2 syntax. Export reads local data and uses the existing save picker/download flow. This branch has no import interface.

## Data and isolation

`dist/` has no API client, backend URL, API keys, or deployment credentials. The task store is `dist/demo-store.mjs`; it uses localStorage only. A Content Security Policy disables network connections (`connect-src 'none'`) and form submissions. Task titles and notes continue to render as text, with title, notes, date, and status validation at the storage boundary.

Storage belongs to a browser profile and site origin (scheme, hostname, and port). Tabs at the same origin share demo data; separate profiles, devices, and origins do not sync. Clearing site data, using private browsing, or changing the demo URL can remove or separate the data. Browser storage has a quota and is not a backup or a protected account. Avoid entering private information into a public demo, and export anything you want to retain.

If storage is blocked or full, the app reports that changes were not saved. Invalid saved data is preserved until you explicitly reset the samples. There is no network fallback. A reset does not repair browser storage permissions.

The backend, Docker files, and their tests remain in the repository as production reference code. **Do not run `backend/server.py`, Docker Compose, or publish the repository root for this demo.** Deploy only `dist/`, on a separate static origin without proxying `/api` to the production service. Runtime databases, accounts, sessions, `.env`, private `docs/`, exports, and backups are excluded from Git and from the static deployment directory.

## Published Cloudflare Pages demo

- **Public URL:** [https://daily-todo-demo.pages.dev/](https://daily-todo-demo.pages.dev/).
- **Pages project:** `daily-todo-demo`.
- **Deployment method:** dashboard Direct Upload, production environment, using only the 11 static files from `dist/`. No build command, environment variables, secrets, Functions, Workers, or database are required.
- **Source:** `codex/browser-demo`; the deployed assets were uploaded from commit `9baf40eb58306c2ed23977504aad12241d257fb3`. Later documentation-only commits leave those assets unchanged.

Direct Upload is manual: pushing this Git branch does **not** automatically update the public demo. To publish an update, check out the intended demo commit, verify that `dist/` contains only the static demo assets, then use **Pages → daily-todo-demo → Create deployment → Production** and upload the contents of `dist/` (or a ZIP with `index.html` at its root). Never upload the repository root, backend, runtime data, or private configuration.

The dashboard labels the Direct Upload production source as `main`; no Git repository is connected, and this label does not deploy the repository’s production branch. The uploaded file contents, rather than that label, identify this demo’s source. Automatic Git deployments would require a separate Git-integrated Pages project; see Cloudflare’s [Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/).

Public HTTPS verification confirmed that all 11 hosted assets exactly match the committed `dist/` files. Create/edit/complete, calendar history, reload persistence, and reset were tested, with no `/api` requests or browser console errors. Repeat those checks after future uploads. Browser storage is specific to the demo URL and is not shared with the NAS production application.

## Development checks

No dependency installation is needed for the unit tests:

```sh
node --test tests/*.test.mjs
node --check dist/app.js
for file in dist/*.mjs; do node --check "$file"; done
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

Demo tests exercise event-based history, validation, browser storage isolation and failure handling, and local export ordering/cancellation. Python tests use temporary databases and loopback servers and continue checking the retained production backend; passing them does not imply that a backend is running in the demo. Browser validation should use a static server serving only `dist/`, with network requests and console errors monitored.

Released under the MIT License. The calendar and list layout takes inspiration from [HabitTrove](https://github.com/dohsimpson/HabitTrove); this application’s code is independently implemented.
