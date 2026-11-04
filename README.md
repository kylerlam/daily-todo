# Daily Todo — Browser Demo

This `codex/demo` branch is a standalone, static demo of Daily Todo. Open it and try the task list and calendar without signing in. Demo changes stay in your browser’s localStorage until the next Hong Kong calendar day.

The demo includes the production features through `e6f0f25` on `main` (`v0.2.3`). The public demo is available on Cloudflare Pages. [daily-todo-demo.pages.dev](https://daily-todo-demo.pages.dev/)

## Try the demo locally

Serve **only `dist/`** with any static HTTP server. There is no build step or application dependency. For example, from the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Python here is only a convenient local static file server; the deployed demo needs no Python runtime, SQLite, Pages Functions, or other backend. Use HTTP rather than opening `index.html` as a `file://` URL, because the browser loads JavaScript modules.

## What you can try

- Create, reschedule, complete, reorder, and delete tasks. Insert and toggle checkboxes in notes.
- Select dates, change months, and return to Today. The four samples show an overdue task, a completed task today, an unfinished task today, and an upcoming task. The calendar shows each task on its assigned date, including tasks completed early.
- Reload the page to keep changes on the same day. After midnight Hong Kong time, the demo restores four fresh examples the next time it runs. Use **Reset sample data** to do this immediately. The reset replaces only demo tasks and history.
- Switch between four languages and ten themes in Settings. The **Settings** title shows the version. There is no account, password change, or sign-out in the demo.
- Export the browser’s demo tasks and history as JSON or YML. YML uses JSON-compatible YAML 1.2 syntax. Export reads local data and uses the existing save picker/download flow. This branch has no import interface.

## Data and isolation

`dist/` has no API client, backend URL, API keys, or deployment credentials. The task store is `dist/demo-store.mjs`; it uses localStorage only. A Content Security Policy disables network connections (`connect-src 'none'`) and form submissions. Task titles and notes continue to render as text, with title, notes, date, and status validation at the storage boundary.

Storage belongs to a browser profile and site origin (scheme, hostname, and port). Tabs at the same origin share demo data; separate profiles, devices, and origins do not sync. Clearing site data, using private browsing, or changing the demo URL can remove or separate the data. Browser storage has a quota and is not a backup or a protected account. Avoid entering private information into a public demo, and export anything you want to retain.

If storage is blocked or full, the app reports that changes were not saved. Previous or unreadable demo data is replaced with fresh examples when storage is available.

The backend, Docker files, and their tests remain in the repository as production reference code. **Do not run `backend/server.py`, Docker Compose, or publish the repository root for this demo.** Deploy only `dist/`, on a separate static origin without proxying `/api` to the production service. Runtime databases, accounts, sessions, `.env`, private `docs/`, exports, and backups are excluded from Git and from the static deployment directory.

## Published Cloudflare Pages demo

- **Public URL:** [https://daily-todo-demo.pages.dev/](https://daily-todo-demo.pages.dev/).
- **Pages project:** `daily-todo-demo`.
- **Deployment method:** dashboard Direct Upload in the production environment, using only the static files from `dist/`.
- **Source branch:** `codex/demo`.

Direct Upload is manual: pushing this Git branch does **not** automatically update the public demo. To publish an update, check out the intended demo commit, verify that `dist/` contains only the static demo assets, then use **Pages → daily-todo-demo → Create deployment → Production** and upload the contents of `dist/` (or a ZIP with `index.html` at its root). Never upload the repository root, backend, runtime data, or private configuration.

Before packaging, check that `APP_VERSION` in `git show HEAD:dist/settings.mjs` matches the planned release tag. After deployment, confirm the same version appears in the **Settings** title.

The dashboard labels the Direct Upload production source as `main`; no Git repository is connected, and this label does not deploy the repository’s production branch. The uploaded file contents, rather than that label, identify this demo’s source. Automatic Git deployments would require a separate Git-integrated Pages project; see Cloudflare’s [Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Development checks

No dependency installation is needed for the unit tests:

```sh
node --test tests/*.test.mjs
node --check dist/app.js
for file in dist/*.mjs; do node --check "$file"; done
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

Demo tests cover the Hong Kong midnight reset, same-day persistence, date and task status updates, storage isolation, and local exports. Python tests check the retained production backend with temporary databases and loopback servers.

Released under the MIT License. The calendar and list layout takes inspiration from [HabitTrove](https://github.com/dohsimpson/HabitTrove); this application’s code is independently implemented.
