# Daily Todo

A small personal todo list and calendar, released under the MIT License. The calendar and task list sit side by side on desktop and stack on mobile. The frontend uses plain HTML, CSS, and JavaScript; the backend uses Python's standard library and SQLite. No application dependencies or frontend build step are required.

## Tasks and daily history

- Add tasks, edit their notes, and check them off. Completed titles and notes are crossed out. Today's completed tasks remain on the main list; earlier completions are available in the calendar.
- Select a calendar date to review completed and unfinished tasks. Select the month heading to choose a month and year, or use **Today** to return to the current day.
- Unfinished tasks carry forward. Completion is recorded on the day you actually check the task off, rather than its scheduled start date.
- Past dates preserve the text and status at the end of that day. Completing, renaming, reopening, or stopping a task later does not rewrite an earlier day's snapshot.
- If you complete and undo a task on the same day, that day's final status is shown. The underlying events are retained. Past dates are read-only; backdating a completion is not supported.
- A future start date keeps a task visible as planned work. It cannot be completed before that date.
- Use **More actions → Stop doing** for tasks you no longer intend to finish. This removes them from the active list while retaining their history, with a separate stopped status that does not count as completion.

This version provides tasks and a calendar. It does not include recurring habits or an import interface.

## Sign-in and settings

The application has a separate sign-in page and one account. Registration is disabled.

On the first start, including an upgrade of a database without an account, the default credentials are:

```text
Username: admin
Password: admin123
```

After signing in, open **Settings → Account** to change the username and password. Enter the current password to save changes. A new password must contain 8–256 characters; leave it empty to keep the existing password. Saving account settings signs out every session, including the current one. Sign in again using the updated credentials. Restarting the application does not reset an existing account to the defaults.

Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes with 600,000 iterations. Sessions last 30 days, survive server restarts, and use an HttpOnly, SameSite=Strict cookie; only a hash of each session token is stored. Signing out revokes that session. Task and export APIs require a valid session. Login attempts are limited to 10 per client IP in five minutes.

### Languages and themes

Settings are also available on the sign-in page. Language and theme choices are saved in the current browser.

- **Languages:** English (`en`, the default), Spanish (`es`), Simplified Chinese (`zh-CN`), and Traditional Chinese (`zh-TW`).
- **Fresh and minimal, themes 1–5:** White, Mint, Sky, Lavender, and Peach.
- **Theme 6:** Glass.
- **Gradient themes 7–10:** Aurora, Sunset, Ocean, and Twilight.

White is the default theme.

## Run with Docker

From the project directory:

```sh
mkdir -p data
TDL_UID="$(id -u)" TDL_GID="$(id -g)" docker compose up -d --build
```

Open [http://localhost:3456](http://localhost:3456), sign in, and change the default credentials in Settings. Compose binds to `127.0.0.1` by default, so the service is available only on the host computer. The container runs as the supplied UID/GID and needs write access to `data/`.

To use the app from a phone on the same trusted network, create a local `.env` file:

```dotenv
TDL_UID=1000
TDL_GID=1000
TDL_BIND_ADDRESS=0.0.0.0
```

Replace the UID and GID with the output of `id -u` and `id -g` on the host, then run `docker compose up -d`. Connect the phone to the same network and open `http://<host-lan-address>:3456` using the host's LAN address. Binding to `0.0.0.0` makes the service listen on all host interfaces; access still depends on the host firewall and network.

The same container can be used on a Docker-capable NAS. Adapt the host data-folder path, UID/GID, port, and network configuration to that NAS; a NAS deployment is not performed by the local commands above.

Common commands:

```sh
docker compose ps
docker compose logs --tail=50 app
docker compose restart
docker compose down
```

After editing source files, run `docker compose up -d --build` again. Stopping, restarting, or rebuilding the container does not clear the bind-mounted data directory.

### HTTPS reverse proxy

For access through an HTTPS reverse proxy, pass the original public `Host` header and terminate TLS at the proxy. Set this in `.env` and recreate the container:

```dotenv
SESSION_COOKIE_SECURE=true
```

```sh
docker compose up -d
```

Compose explicitly passes this setting to the server. It marks session cookies as Secure; enable it only when the browser accesses the app over HTTPS. It does not provide TLS itself and is not inferred from forwarded headers. Leave it false for ordinary local HTTP or LAN HTTP access. Requests with an `Origin` header must match the request's `Host`.

## Export data

**Export data** downloads YML (YAML) by default, with JSON available as an alternative. Both contain all tasks and their history events. Exports exclude account credentials and sessions and do not modify existing data. There is currently no application interface for importing an export.

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

## Long-term storage and recovery

The database is `data/todo.sqlite3`. While the service runs, SQLite may also create `-wal` and `-shm` files. Tasks and append-only history snapshots are stored in the database; the application does not automatically expire task history. Historical records are protected against application-level updates and deletion. Long-term availability still depends on retaining the data and maintaining usable backups.

For a complete backup, stop the container, copy the entire `data/` directory, and start the container again. To restore, stop the container, retain a copy of the current data, put the backed-up directory back at the same mounted path, and restart to verify it. Do not copy only the main database file while the service is running and omit its WAL. A database backup includes account and session records as well as task history; a YML/JSON export does not.

The app does not schedule external backups. Keep the database, exports, and configuration in locations you control. The Git ignore rules exclude runtime data, exports, backups, local `.env` files, and private `docs/`. Review files before publishing a repository and do not force-add private data.

## Development and verification

Run directly with Python 3.13:

```sh
python3 backend/server.py
```

The direct server defaults to `127.0.0.1:8080`. Its environment variables are:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Listening interface; Docker sets `0.0.0.0` inside the container. |
| `PORT` | `8080` | Server port; Compose publishes it as host port 3456. |
| `DATA_DIR` | `./data` | SQLite data directory. |
| `DIST_DIR` | `./dist` | Static frontend directory. |
| `TZ` | `Asia/Hong_Kong` | Application date boundaries. |
| `SESSION_COOKIE_SECURE` | `false` | Set to `true` or `1` when using HTTPS. |

Tests and static checks use Python's standard library and Node.js 22. They do not require dependency installation. The optional YAML round-trip assertion uses PyYAML only when it is already installed; otherwise exact structure and scalar checks still run.

```sh
python3 -m unittest discover -s tests -v
node --test tests/*.test.mjs
node --check dist/app.js
for file in dist/*.mjs; do node --check "$file"; done
docker compose config --quiet
```

Python integration tests start temporary loopback HTTP servers and use temporary databases. They do not write to the application's real `data/` directory. The tests cover daily history, transactional persistence, input validation, exports, sign-in, session expiry and revocation, account changes, registration restrictions, and request-origin checks. Node tests cover export-save ordering and cancellation, language selection and translations, and theme preferences.

The calendar and list layout takes inspiration from [HabitTrove](https://github.com/dohsimpson/HabitTrove). This application's code is independently implemented.
