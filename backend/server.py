"""Small persistent todo API and static frontend server (Python standard library)."""

import calendar
from collections import defaultdict, deque
from contextlib import closing
from datetime import date, datetime
import hashlib
import hmac
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
import unicodedata
from urllib.parse import parse_qs, unquote, urlsplit
from zoneinfo import ZoneInfo


MAX_BODY = 32768
PASSWORD_ITERATIONS = 600000
SESSION_SECONDS = 30 * 24 * 60 * 60


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PASSWORD_ITERATIONS).hex()


def dump_yaml(value):
    # JSON quoting preserves string types; also escape YAML line breaks and C1 controls.
    escapes = {code: f"\\u{code:04x}" for code in (*range(0x7f, 0xa0), 0x2028, 0x2029, 0xfffe, 0xffff)}

    def scalar(item):
        if not (item is None or type(item) in (str, bool, int) or item == [] or item == {}):
            raise TypeError("Unsupported YAML export value")
        return json.dumps(item, ensure_ascii=False).translate(escapes)

    def lines(item, indent):
        if not isinstance(item, (dict, list)) or not item:
            return [" " * indent + scalar(item)]
        entries = item.items() if isinstance(item, dict) else ((None, child) for child in item)
        result = []
        for key, child in entries:
            prefix = " " * indent + (scalar(key) + ":" if isinstance(item, dict) else "-")
            if isinstance(child, (dict, list)) and child:
                result.append(prefix)
                result.extend(lines(child, indent + 2))
            else:
                result.append(prefix + " " + scalar(child))
        return result

    return "\n".join(lines(value, 0)) + "\n"


class RequestError(Exception):
    def __init__(self, message, status=400, code="INVALID_REQUEST"):
        super().__init__(message)
        self.status = status
        self.code = code


def valid_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise RequestError("Use the YYYY-MM-DD date format.", code="INVALID_DATE_FORMAT")
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        raise RequestError("The date is invalid.", code="INVALID_DATE") from None


def validate_fields(data, allowed):
    if not isinstance(data, dict):
        raise RequestError("The request must be a JSON object.", code="INVALID_BODY")
    if data.keys() - allowed:
        raise RequestError("The request contains unsupported fields.", code="UNKNOWN_FIELDS")
    for field, limit in (("title", 300), ("notes", 5000)):
        if field in data:
            if not isinstance(data[field], str):
                raise RequestError(f"{field} must be text.", code=f"INVALID_{field.upper()}")
            try:
                data[field].encode("utf-8")
            except UnicodeError:
                raise RequestError(f"{field} contains invalid text.", code=f"INVALID_{field.upper()}") from None
            if len(data[field]) > limit or (field == "title" and not data[field].strip()):
                raise RequestError(f"{field} has an invalid length.", code=f"INVALID_{field.upper()}")
    for field in ("completed", "discarded"):
        if field in data and type(data[field]) is not bool:
            raise RequestError(f"{field} must be a boolean.", code="INVALID_BOOLEAN")


def credential_text(value, code, minimum, maximum):
    if not isinstance(value, str) or not minimum <= len(value) <= maximum:
        raise RequestError("The account field has an invalid length or type.", code=code)
    try:
        value.encode("utf-8")
    except UnicodeError:
        raise RequestError("The account field contains invalid text.", code=code) from None
    return value


class Store:
    def __init__(self, data_dir, clock=None, timezone=None):
        self.zone = ZoneInfo(timezone or os.environ.get("TZ", "Asia/Hong_Kong"))
        self.clock = clock or (lambda: datetime.now(self.zone))
        directory = Path(data_dir)
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / "todo.sqlite3"
        with closing(self.connect()) as db, db:
            db.executescript("""
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY,
                    title TEXT NOT NULL,
                    notes TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    day TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY,
                    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
                    kind TEXT NOT NULL CHECK(kind IN ('todo', 'complete', 'discard')),
                    at TEXT NOT NULL,
                    effective_date TEXT NOT NULL,
                    state_at TEXT NOT NULL,
                    title TEXT NOT NULL,
                    notes TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS events_task_date ON events(task_id, effective_date, id);
                CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events
                    BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
                CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events
                    BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY CHECK(id = 1),
                    username TEXT NOT NULL UNIQUE,
                    salt TEXT NOT NULL,
                    password_hash TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                    expires_at INTEGER NOT NULL
                );
            """)
            salt = secrets.token_hex(16)
            if db.execute("SELECT 1 FROM accounts WHERE id=1").fetchone() is None:
                db.execute("INSERT OR IGNORE INTO accounts VALUES(1,?,?,?)",
                           ("admin", salt, password_hash("admin123", salt)))

    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        return db

    def now(self):
        return self.clock().astimezone(self.zone).isoformat(timespec="microseconds")

    def today(self):
        return self.now()[:10]

    def login(self, data):
        validate_fields(data, {"username", "password"})
        username = credential_text(data.get("username"), "INVALID_USERNAME", 0, 64)
        password = credential_text(data.get("password"), "INVALID_PASSWORD", 0, 256)
        with closing(self.connect()) as db, db:
            db.execute("BEGIN IMMEDIATE")
            account = db.execute("SELECT * FROM accounts WHERE id=1").fetchone()
            matches = hmac.compare_digest(password_hash(password, account["salt"]), account["password_hash"])
            if not hmac.compare_digest(username.encode(), account["username"].encode()) or not matches:
                raise RequestError("Invalid username or password.", 401, "INVALID_CREDENTIALS")
            token = secrets.token_urlsafe(32)
            now = int(datetime.fromisoformat(self.now()).timestamp())
            db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
            db.execute("INSERT INTO sessions VALUES(?,1,?)", (hashlib.sha256(token.encode()).hexdigest(), now + SESSION_SECONDS))
            return token, {"username": account["username"]}

    def session_user(self, token):
        if not token:
            return None
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        now = int(datetime.fromisoformat(self.now()).timestamp())
        with closing(self.connect()) as db, db:
            row = db.execute("""SELECT a.username FROM sessions s JOIN accounts a ON a.id=s.user_id
                WHERE s.token_hash=? AND s.expires_at > ?""", (token_hash, now)).fetchone()
            return {"username": row["username"]} if row else None

    def logout(self, token):
        if token:
            with closing(self.connect()) as db, db:
                db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))

    def update_account(self, data):
        validate_fields(data, {"username", "current_password", "new_password"})
        username = credential_text(data.get("username"), "INVALID_USERNAME", 2, 64)
        if username != username.strip() or any(unicodedata.category(c) == "Cc" for c in username):
            raise RequestError("Use a username without control characters or outer spaces.", code="INVALID_USERNAME")
        current = credential_text(data.get("current_password"), "INVALID_CURRENT_PASSWORD", 0, 256)
        new_password = None
        if "new_password" in data:
            new_password = credential_text(data["new_password"], "INVALID_PASSWORD", 8, 256)
        with closing(self.connect()) as db, db:
            db.execute("BEGIN IMMEDIATE")
            account = db.execute("SELECT * FROM accounts WHERE id=1").fetchone()
            if not hmac.compare_digest(password_hash(current, account["salt"]), account["password_hash"]):
                raise RequestError("The current password is incorrect.", code="INVALID_CURRENT_PASSWORD")
            if username != account["username"] or new_password is not None:
                salt = secrets.token_hex(16) if new_password is not None else account["salt"]
                hashed = password_hash(new_password, salt) if new_password is not None else account["password_hash"]
                db.execute("UPDATE accounts SET username=?,salt=?,password_hash=? WHERE id=1", (username, salt, hashed))
            db.execute("DELETE FROM sessions")

    @staticmethod
    def append_event(db, task_id, kind, now, state_at, title, notes):
        db.execute(
            "INSERT INTO events(task_id,kind,at,effective_date,state_at,title,notes) VALUES(?,?,?,?,?,?,?)",
            (task_id, kind, now, now[:10], state_at, title, notes),
        )

    @staticmethod
    def task(row):
        return {
            "id": row["id"], "title": row["title"], "notes": row["notes"],
            "created_at": row["created_at"], "day": row["day"],
            "completed": row["kind"] == "complete",
            "completed_at": row["state_at"] if row["kind"] == "complete" else None,
            "discarded": row["kind"] == "discard",
        }

    @staticmethod
    def latest(db, task_id):
        row = db.execute("""
            SELECT t.*, e.kind, e.state_at FROM tasks t JOIN events e ON e.id =
                (SELECT MAX(id) FROM events WHERE task_id = t.id) WHERE t.id = ?
        """, (task_id,)).fetchone()
        if row is None:
            raise RequestError("The task was not found.", 404, "NOT_FOUND")
        return row

    def create(self, data):
        validate_fields(data, {"title", "notes", "day"})
        if "title" not in data:
            raise RequestError("Enter a task title.", code="MISSING_TITLE")
        title, notes = data["title"].strip(), data.get("notes", "")
        with closing(self.connect()) as db, db:
            db.execute("BEGIN IMMEDIATE")
            now = self.now()
            day = valid_date(data.get("day", now[:10]))
            task_id = db.execute(
                "INSERT INTO tasks(title,notes,created_at,day) VALUES(?,?,?,?)",
                (title, notes, now, day),
            ).lastrowid
            self.append_event(db, task_id, "todo", now, now, title, notes)
            return self.task(self.latest(db, task_id))

    def patch(self, task_id, data):
        validate_fields(data, {"title", "notes", "completed", "discarded"})
        if not data:
            raise RequestError("Provide at least one change.", code="EMPTY_UPDATE")
        if "completed" in data and "discarded" in data:
            raise RequestError("Change only one task status at a time.", code="CONFLICTING_STATUS")
        with closing(self.connect()) as db, db:
            db.execute("BEGIN IMMEDIATE")
            now = self.now()
            old = self.latest(db, task_id)
            title = data.get("title", old["title"]).strip()
            notes = data.get("notes", old["notes"])
            kind = old["kind"]
            if "completed" in data:
                kind = "complete" if data["completed"] else "todo"
            if "discarded" in data:
                kind = "discard" if data["discarded"] else "todo"
            if kind == "complete" and old["day"] > now[:10]:
                raise RequestError("A task cannot be completed before its scheduled day.", code="FUTURE_COMPLETION")
            if (title, notes, kind) != (old["title"], old["notes"], old["kind"]):
                state_at = now if kind != old["kind"] else old["state_at"]
                db.execute("UPDATE tasks SET title=?, notes=? WHERE id=?", (title, notes, task_id))
                self.append_event(db, task_id, kind, now, state_at, title, notes)
            return self.task(self.latest(db, task_id))

    def rows_on(self, db, selected):
        return db.execute("""
            SELECT t.id, t.created_at, t.day, e.title, e.notes, e.kind, e.state_at
            FROM tasks t JOIN events e ON e.id = (
                SELECT MAX(id) FROM events WHERE task_id=t.id AND effective_date <= ?
            ) WHERE t.day <= ? ORDER BY t.day, t.id
        """, (selected, selected)).fetchall()

    def day_payload(self, db, selected, today):
        tasks = [self.task(row) for row in self.rows_on(db, selected)
                 if row["kind"] == "todo" or row["state_at"][:10] == selected]
        return self.envelope(selected, today, tasks)

    @staticmethod
    def envelope(selected, today, tasks):
        return {"date": selected, "today": today, "tasks": tasks, "summary": {
            "total": len(tasks),
            "completed": sum(t["completed"] for t in tasks),
            "pending": sum(not t["completed"] and not t["discarded"] for t in tasks),
        }}

    def day(self, selected):
        selected = valid_date(selected)
        with closing(self.connect()) as db, db:
            return self.day_payload(db, selected, self.today())

    def current(self):
        today = self.today()
        with closing(self.connect()) as db, db:
            rows = db.execute("""
                SELECT t.*, e.kind, e.state_at FROM tasks t JOIN events e ON e.id =
                    (SELECT MAX(id) FROM events WHERE task_id=t.id) ORDER BY t.day, t.id
            """).fetchall()
            tasks = [self.task(row) for row in rows if row["kind"] == "todo"
                     or (row["kind"] == "complete" and row["state_at"][:10] == today)]
            return self.envelope(today, today, tasks)

    def month(self, month):
        if not isinstance(month, str) or not re.fullmatch(r"\d{4}-\d{2}", month):
            raise RequestError("Use the YYYY-MM month format.", code="INVALID_MONTH_FORMAT")
        first = date.fromisoformat(valid_date(month + "-01"))
        today = self.today()
        days = []
        with closing(self.connect()) as db, db:
            db.execute("BEGIN")
            for number in range(1, calendar.monthrange(first.year, first.month)[1] + 1):
                selected = first.replace(day=number).isoformat()
                days.append({"date": selected, **self.day_payload(db, selected, today)["summary"]})
        return {"month": month, "days": days}

    def export(self):
        with closing(self.connect()) as db, db:
            db.execute("BEGIN")
            return {"format": "tdl-export", "version": 1, "timezone": str(self.zone),
                    "exported_at": self.now(),
                    "tasks": [dict(row) for row in db.execute("SELECT * FROM tasks ORDER BY id")],
                    "events": [dict(row) for row in db.execute("SELECT * FROM events ORDER BY id")]}


def make_server(host, port, store, dist_dir):
    dist = Path(dist_dir).resolve()
    secure_cookie = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() in ("1", "true")
    attempts = defaultdict(deque)
    attempts_lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def send_bytes(self, body, content_type, status=200, filename=None):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
            if self.pending_cookie is not None:
                self.send_header("Set-Cookie", self.pending_cookie)
            if filename:
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def send_json(self, value, status=200, filename=None):
            self.send_bytes(json.dumps(value, ensure_ascii=False).encode(), "application/json; charset=utf-8", status, filename)

        def session_token(self):
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get("Cookie", ""))
            except CookieError:
                return ""
            return cookie["tdl_session"].value if "tdl_session" in cookie else ""

        def set_session_cookie(self, token=""):
            cookie = SimpleCookie()
            cookie["tdl_session"] = token
            cookie["tdl_session"]["path"] = "/"
            cookie["tdl_session"]["httponly"] = True
            cookie["tdl_session"]["samesite"] = "Strict"
            cookie["tdl_session"]["max-age"] = SESSION_SECONDS if token else 0
            if secure_cookie:
                cookie["tdl_session"]["secure"] = True
            self.pending_cookie = cookie.output(header="").strip()

        def check_mutation(self):
            origin = self.headers.get("Origin")
            if origin is not None:
                try:
                    parsed = urlsplit(origin)
                    valid = (parsed.scheme in ("http", "https") and
                             parsed.netloc.lower() == self.headers.get("Host", "").lower() and
                             not (parsed.path or parsed.query or parsed.fragment))
                except ValueError:
                    valid = False
                if not valid:
                    raise RequestError("Cross-origin requests are not allowed.", 403, "CSRF_REJECTED")
            if self.headers.get_content_type() != "application/json":
                raise RequestError("Use application/json.", 415, "UNSUPPORTED_CONTENT_TYPE")

        def check_login_limit(self):
            now = time.monotonic()
            with attempts_lock:
                for ip in list(attempts):
                    while attempts[ip] and attempts[ip][0] <= now - 300:
                        attempts[ip].popleft()
                    if not attempts[ip]:
                        del attempts[ip]
                history = attempts[self.client_address[0]]
                if len(history) >= 10:
                    raise RequestError("Too many login attempts. Try again in five minutes.", 429, "RATE_LIMITED")
                history.append(now)

        def body(self):
            if self.headers.get("Transfer-Encoding"):
                raise RequestError("Chunked requests are not supported.", code="UNSUPPORTED_TRANSFER_ENCODING")
            try:
                length = int(self.headers.get("Content-Length", ""))
            except ValueError:
                raise RequestError("The request length is invalid.", code="INVALID_CONTENT_LENGTH") from None
            if not 0 < length <= MAX_BODY:
                raise RequestError("The request body is too large or empty.", code="BODY_TOO_LARGE")
            if self.headers.get_content_type() != "application/json":
                raise RequestError("Use application/json.", 415, "UNSUPPORTED_CONTENT_TYPE")
            try:
                return json.loads(self.rfile.read(length))
            except (ValueError, UnicodeError):
                raise RequestError("The JSON body is invalid.", code="INVALID_JSON") from None

        def handle_request(self):
            self.pending_cookie = None
            try:
                parsed = urlsplit(self.path)
                path = unquote(parsed.path)
                query = parse_qs(parsed.query, keep_blank_values=True)
                mutation = self.command not in ("GET", "HEAD")
                if mutation:
                    self.check_mutation()
                token = self.session_token()
                self.user = store.session_user(token)
                if path in ("/api/auth/register", "/api/register"):
                    raise RequestError("Registration is disabled.", 403, "REGISTRATION_DISABLED")
                if path == "/api/auth/status" and not mutation:
                    return self.send_json({"authenticated": self.user is not None, "user": self.user,
                                           "registration_enabled": False})
                if path == "/api/auth/login" and self.command == "POST":
                    self.check_login_limit()
                    token, user = store.login(self.body())
                    self.set_session_cookie(token)
                    with attempts_lock:
                        attempts.pop(self.client_address[0], None)
                    return self.send_json({"user": user})
                if path == "/api/auth/logout" and self.command == "POST":
                    validate_fields(self.body(), set())
                    store.logout(token)
                    self.set_session_cookie()
                    return self.send_json({"ok": True})
                if (path == "/api" or path.startswith("/api/")) and path != "/api/health" and self.user is None:
                    raise RequestError("Sign in to continue.", 401, "AUTH_REQUIRED")
                if path == "/api/account" and self.command == "PATCH":
                    store.update_account(self.body())
                    self.set_session_cookie()
                    return self.send_json({"reauthenticate": True})
                if self.command in ("GET", "HEAD"):
                    if path == "/api/health":
                        with closing(store.connect()) as db:
                            db.execute("SELECT 1")
                        return self.send_json({"ok": True, "today": store.today()})
                    if path == "/api/tasks":
                        return self.send_json(store.current())
                    if path in ("/api/day", "/api/month"):
                        key = "date" if path.endswith("day") else "month"
                        if set(query) != {key} or len(query[key]) != 1:
                            raise RequestError(f"Provide exactly one {key} parameter.", code="INVALID_QUERY")
                        value = store.day(query[key][0]) if key == "date" else store.month(query[key][0])
                        return self.send_json(value)
                    if path == "/api/export":
                        if query and (set(query) != {"format"} or len(query["format"]) != 1):
                            raise RequestError("Provide at most one format parameter.", code="INVALID_QUERY")
                        export_format = query.get("format", ["yml"])[0]
                        if export_format not in ("json", "yml", "yaml"):
                            raise RequestError("The export format must be yml, yaml or json.", code="INVALID_EXPORT_FORMAT")
                        data = store.export()
                        if export_format == "json":
                            return self.send_json(data, filename=f"tdl-{store.today()}.json")
                        return self.send_bytes(dump_yaml(data).encode(), "application/yaml; charset=utf-8",
                                               filename=f"tdl-{store.today()}.yml")
                    if path == "/api" or path.startswith("/api/"):
                        raise RequestError("The endpoint was not found.", 404, "NOT_FOUND")
                    return self.static(path)
                if self.command == "POST" and path == "/api/tasks":
                    return self.send_json(store.create(self.body()), 201)
                match = re.fullmatch(r"/api/tasks/(\d+)", path)
                if self.command == "PATCH" and match:
                    return self.send_json(store.patch(int(match[1]), self.body()))
                raise RequestError("This method is not allowed.", 405, "METHOD_NOT_ALLOWED")
            except RequestError as error:
                self.send_json({"error": str(error), "code": error.code}, error.status)
            except (sqlite3.DatabaseError, OSError):
                self.send_json({"error": "Unable to read or save data. Try again later.", "code": "STORAGE_ERROR"}, 500)

        def static(self, path):
            if "\x00" in path:
                raise RequestError("The path is invalid.", code="INVALID_PATH")
            if path == "/login.html" and self.user is not None:
                self.send_response(302)
                self.send_header("Location", "/")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            target = (dist / path.lstrip("/")).resolve()
            if not target.is_relative_to(dist):
                raise RequestError("The path is invalid.", code="INVALID_PATH")
            if not target.is_file():
                if Path(path).suffix:
                    raise RequestError("The file was not found.", 404, "NOT_FOUND")
                target = dist / "index.html"
            if target == dist / "index.html" and self.user is None:
                self.send_response(302)
                self.send_header("Location", "/login.html")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if not target.is_file():
                raise RequestError("The frontend has not been built.", 404, "FRONTEND_NOT_BUILT")
            content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
                content_type += "; charset=utf-8"
            self.send_bytes(target.read_bytes(), content_type)

        do_GET = handle_request
        do_HEAD = handle_request
        do_POST = handle_request
        do_PATCH = handle_request
        do_DELETE = handle_request
        do_PUT = handle_request

    return ThreadingHTTPServer((host, port), Handler)


if __name__ == "__main__":
    store = Store(os.environ.get("DATA_DIR", "./data"))
    server = make_server(os.environ.get("HOST", "127.0.0.1"), int(os.environ.get("PORT", "8080")), store,
                         os.environ.get("DIST_DIR", "./dist"))
    print(f"TDL running at http://{server.server_address[0]}:{server.server_address[1]}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
