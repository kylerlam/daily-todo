# Daily Todo — Browser Demo

This `codex/browser-demo` branch is a standalone, static demo of Daily Todo. Open it and try the task list and calendar without signing in. The fictional examples and your changes stay in your browser’s localStorage. Visitors do not share a database.

The demo is based on committed version `ddf98ad` of the production application. The production version remains on `main`. This branch contains code prepared for hosting; no public demo URL or Cloudflare deployment has been created.

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

## Cloudflare Pages settings

Create a Pages project connected to `kylerlam/daily-todo`, using these settings:

| Setting | Value |
| --- | --- |
| Production branch | `codex/browser-demo` |
| Framework preset | None |
| Root directory | Repository root (leave blank) |
| Build command | `exit 0` |
| Build output directory | `dist` |
| Environment variables / secrets | None |
| Functions, Workers, databases | None |

These follow Cloudflare’s [Static HTML guide](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) and [build configuration reference](https://developers.cloudflare.com/pages/configuration/build-configuration/). The output directory contains the ready-to-serve `index.html` and assets. For a manual Direct Upload, upload only the contents of `dist/`. If enabling Git integration, select the demo branch explicitly and limit preview builds to that branch so production branches are not accidentally published by this Pages project.

After deployment, verify the demo banner, create/edit/complete, calendar history, reload persistence, reset, and a browser Network log with no `/api` requests. No demo URL is recorded until a real deployment exists.

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
