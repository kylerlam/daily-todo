# Daily Todo

A small personal todo list and calendar, released under the MIT License. The calendar and task list sit side by side on desktop and stack on mobile. The frontend uses plain HTML, CSS, and JavaScript; the backend uses Python's standard library and SQLite. No application dependencies or frontend build step are required.

## Tasks and daily history

- The calendar shows each task on its assigned date.
- You can check off tasks early or after their assigned date. The calendar updates the assigned day's list, and the completion timestamp records when you checked the task off.
- Change the **Task date** of an unfinished task to move it to another day's list. **Task list** groups unfinished tasks and tasks completed today by their assigned dates. The **Today** group uses today's date.
- Press and hold a task's three-dot button, then drag the handle to change its priority among unfinished tasks on the same date. With the button focused, use **Alt+↑** or **Alt+↓**.
- Use **More actions → Delete** to permanently remove a task and its history from the database, calendar, and subsequent exports.

This version provides tasks and a calendar. It does not include recurring habits.

## Sign-in and settings

The application has a separate sign-in page and one account. Registration is disabled.

On the first start, including an upgrade of a database without an account, the default credentials are:

```text
Username: admin
Password: admin123
```

After signing in, open **Settings → Account** to change the username and password. Enter the current password to save changes. A new password must contain 8–256 characters; leave it empty to keep the existing password. Saving account settings signs out every session, including the current one. Sign in again using the updated credentials. Restarting the application does not reset an existing account to the defaults.

Password fields have an eye button to show or hide the value. The default-credentials panel is hidden until the server confirms it should be shown. After the first successful change to a different password, the whole panel disappears permanently, including after a restart or a later change back to the original password. Renaming the account, leaving the new password empty, or submitting the same password does not trigger this flag. Existing databases are migrated by checking the stored password hash, not by guessing from the username.

Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes with 600,000 iterations. Sessions last 30 days, survive server restarts, and use an HttpOnly, SameSite=Strict cookie; only a hash of each session token is stored. Signing out revokes that session. Task and export APIs require a valid session. Login attempts are limited to 10 per client IP in five minutes.

### Languages and themes

Settings are also available on the sign-in page. Language and theme choices are saved in the current browser.

- **Languages:** English (`en`, the default), Spanish (`es`), Simplified Chinese (`zh-CN`), and Traditional Chinese (`zh-TW`).
- **Fresh and minimal, themes 1–5:** White, Mint, Sky, Lavender, and Peach.
- **Theme 6:** Glass.
- **Gradient themes 7–10:** Aurora, Sunset, Ocean, and Twilight.

White is the default theme.

## Run with Docker

Build the local image from the repository root, then prepare and start the deployment folder:

```sh
docker compose build
mkdir -p "daily todo/data"
cp -n "daily todo/config/app.example.toml" "daily todo/config/app.toml"
cd "daily todo"
TDL_UID="$(id -u)" TDL_GID="$(id -g)" docker compose up -d
```

Keep an existing `app.toml` when upgrading; `cp -n` will not overwrite it. The deployment layout is:

```text
daily todo/
  docker-compose.yml          # Runs the already-built tdl:local image
  config/
    app.example.toml          # Committed configuration template
    app.toml                  # Local runtime configuration; ignored by Git
  data/
    todo.sqlite3              # Primary database, including account and sessions
    daily-todo.yml            # Task/history copy refreshed by HTTP export
```

Open [http://localhost:3456](http://localhost:3456), sign in, and change the default credentials in Settings. Compose binds to `127.0.0.1` by default, so the service is available only on the host computer. The container runs as the supplied UID/GID and needs write access to `daily todo/data/`. Configuration is mounted read-only into the container.

When upgrading from a version that mounted the repository-root `data/` folder, stop the existing container first. Copy the complete old data folder into an empty `daily todo/data/` before starting this version, including any SQLite WAL files. Keep the old folder until you have verified the upgrade. Do not overwrite a populated destination database or combine SQLite files; use the application's export/import flow when merging separate installations.

To use the app from a phone on the same trusted network, create a local `.env` beside the Compose file you use:

```dotenv
TDL_UID=1000
TDL_GID=1000
TDL_BIND_ADDRESS=0.0.0.0
```

Replace the UID and GID with the output of `id -u` and `id -g` on the host, then run `docker compose up -d` from that folder. Connect the phone to the same network and open `http://<host-lan-address>:3456` using the host's LAN address. Binding to `0.0.0.0` makes the service listen on all host interfaces; access still depends on the host firewall and network.

The repository-root `compose.yaml` is the development entry point: `docker compose up -d --build` builds from source and mounts the same `daily todo/data/` and `daily todo/config/` directories. The deployment folder's `docker-compose.yml` only runs `tdl:local`; it has no build instructions. Use one entry point at a time.

For a Docker-capable NAS, copy the deployment folder and provide an image built for the NAS CPU architecture. A local image is not automatically available on another machine. For example, save it on the build machine and load the transferred archive on the NAS:

```sh
# Build machine
docker save -o tdl-local.tar tdl:local

# NAS, after transferring the archive and deployment folder
docker load -i tdl-local.tar
cd "daily todo"
TDL_UID="$(id -u)" TDL_GID="$(id -g)" docker compose up -d
```

Adapt ownership, ports, and networking to the NAS. The copied data directory contains private records and account data. These are deployment instructions, not a claim that a NAS installation has been performed.

Common commands:

```sh
docker compose ps
docker compose logs --tail=50 app
docker compose restart
docker compose down
```

After editing source files, rebuild from the repository root with `docker compose build`, then recreate the service from the deployment folder with `docker compose up -d`. Alternatively, use the root development entry point with `--build`. Stopping, restarting, or rebuilding the container does not clear the bind-mounted data directory.

## Configuration and HTTPS

Edit the host-side `daily todo/config/app.toml`:

```toml
[app]
timezone = "Asia/Hong_Kong"
secure_cookies = false
```

Only these two keys are supported. Restart the container after changing the file. Invalid configuration, an invalid time zone, or an unsupported key stops startup instead of silently continuing with different settings.

For access through an HTTPS reverse proxy, pass the original public `Host` header, terminate TLS at the proxy, and set `secure_cookies = true`. This marks session cookies as Secure; enable it only when the browser accesses the app over HTTPS. It does not provide TLS itself and is not inferred from forwarded headers. Leave it false for ordinary local HTTP or LAN HTTP access. Requests with an `Origin` header must match the request's `Host`.

Environment values take priority over the configuration file: `TZ` overrides the time zone, and a nonempty `SESSION_COOKIE_SECURE` overrides `secure_cookies`. The latter accepts `true`, `false`, `1`, or `0`; an empty value does not override the file. Compose already passes `SESSION_COOKIE_SECURE`, so this optional `.env` setting enables Secure cookies without editing TOML:

```dotenv
SESSION_COOKIE_SECURE=true
```

```sh
docker compose up -d
```

Recreating with `docker compose up -d` applies a changed environment value. Compose sets `CONFIG_FILE=/app/config/app.toml` and mounts `config/` read-only. An environment variable must be passed into the container to override server settings; merely adding an unrelated variable such as `TZ` to `.env` does not automatically pass it through Compose.

## Export and import data

**Export data** downloads YML (YAML) by default, with JSON available as an alternative. Both contain all tasks and their history events. Exports exclude account credentials and sessions and do not modify task history. Each authenticated HTTP export also atomically saves a YML copy as `daily todo/data/daily-todo.yml`, even when the requested download is JSON. This is a snapshot from the export request, not a live-synchronized file; later task changes appear in it only after another export. Deleting a task does not change exports or backups already saved; importing an old export can restore a deleted task.

On desktop browsers that implement the File System Access save picker, in a secure context such as localhost or HTTPS, the app opens the system save dialog before fetching the export. Choose a folder and filename there. Cancelling the picker stops the operation without starting a fallback download. A failed write or close attempts to abort the writable stream and does not report success.

Other browsers use a normal download. The destination is controlled by browser and operating-system settings. On iPhone, after downloading, use **Share → Save to Files** to choose a location. Plain HTTP on a LAN address does not enable the save picker; normal download remains available.

Authenticated API routes:

```text
GET /api/export                 YML, the default
GET /api/export?format=yml       YML
GET /api/export?format=yaml      YML alias
GET /api/export?format=json      JSON
```

Keep exports private: they contain personal task records even though authentication data is excluded.

### Import an existing export

Open **Settings → Data**, choose a `.yml`, `.yaml`, or `.json` file exported by this application, and select **Import**. Files must be valid UTF-8 and at most 10 MiB before upload encoding. Choosing a file alone does not import it.

YML imports support this application's limited export syntax: JSON-quoted string scalars and two-space block indentation. Arbitrary third-party YAML, anchors, aliases, and tags are not supported. Use the original export rather than converting it through another application.

Import merges task history without clearing existing data. An identical export or an older history prefix is skipped. A compatible newer history adds its missing events. Diverging history rejects the entire batch, so existing history is not overwritten by an incompatible import. Imported account credentials and sessions are not part of this format.

## Long-term storage and recovery

The primary database is `daily todo/data/todo.sqlite3`. While the service runs, SQLite may also create `-wal` and `-shm` files. Tasks, priority order, history events, account credentials, and sessions are persisted in this host-mounted directory. The application does not automatically expire task history. Changes to task text, dates, and status append history events. Deleting a task removes that task and all its events in one transaction. Long-term availability depends on retaining the data and maintaining usable backups.

For a complete backup, stop the container, copy the entire `daily todo/data/` directory and retain `daily todo/config/app.toml`, then start the container again. To restore, stop the container, retain a copy of the current data, put the backed-up directory and configuration back at the same mounted paths, and restart to verify them. Do not copy only the main database file while the service is running and omit its WAL. A database backup includes account and session records as well as task history; a YML/JSON export and `daily-todo.yml` do not.

The app does not schedule external backups. Keep the database, exports, and configuration in locations you control. The Git ignore rules exclude runtime data, exports, backups, local `.env` files, and private `docs/`. Review files before publishing a repository and do not force-add private data.

## Development and verification

Run directly with Python 3.13:

```sh
CONFIG_FILE="daily todo/config/app.toml" DATA_DIR="daily todo/data" python3 backend/server.py
```

The direct server defaults to `127.0.0.1:8080`. Its environment variables are:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Listening interface; Docker sets `0.0.0.0` inside the container. |
| `PORT` | `8080` | Server port; Compose publishes it as host port 3456. |
| `DATA_DIR` | `./data` | SQLite data directory. |
| `DIST_DIR` | `./dist` | Static frontend directory. |
| `CONFIG_FILE` | Optional `./config/app.toml` | Main-process configuration file; an explicitly selected file must exist. Compose sets `/app/config/app.toml`. |
| `TZ` | Configured time zone, otherwise `Asia/Hong_Kong` | Overrides application date boundaries when provided. |
| `SESSION_COOKIE_SECURE` | Configured value, otherwise `false` | A nonempty value overrides configuration; use `true` or `1` for HTTPS. |

Tests and static checks use Python's standard library and Node.js 22. They do not require dependency installation. The optional YAML round-trip assertion uses PyYAML only when it is already installed; otherwise exact structure and scalar checks still run.

```sh
python3 -m unittest discover -s tests -v
node --test tests/*.test.mjs
node --check dist/app.js
for file in dist/*.mjs; do node --check "$file"; done
docker compose config --quiet
docker compose -f "daily todo/docker-compose.yml" config --quiet
```

Python integration tests start temporary loopback HTTP servers and use temporary databases. They do not write to the application's real data directory. The tests cover configuration, daily history, transactional persistence, input validation, exports and imports, sign-in, session expiry and revocation, account changes, default-credential visibility, registration restrictions, and request-origin checks. Node tests cover export-save ordering and cancellation, import-file checks, password visibility, language selection and translations, and theme preferences.

The calendar and list layout takes inspiration from [HabitTrove](https://github.com/dohsimpson/HabitTrove). This application's code is independently implemented.
