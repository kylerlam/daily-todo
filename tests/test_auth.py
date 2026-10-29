from contextlib import closing
from datetime import datetime, timedelta
from http.client import HTTPConnection
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch

from backend.server import SESSION_SECONDS, Store, make_server


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        (root / "dist").mkdir()
        (root / "dist/index.html").write_text("private app")
        (root / "dist/login.html").write_text("sign in")
        (root / "dist/style.css").write_text("body{}")
        self.now = datetime.fromisoformat("2026-10-30T10:00:00+08:00")
        self.store = Store(root / "data", clock=lambda: self.now, timezone="Asia/Hong_Kong")
        self.server = make_server("127.0.0.1", 0, self.store, root / "dist")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop)

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method, path, data=None, cookie="", headers=None):
        connection = HTTPConnection(*self.server.server_address, timeout=10)
        try:
            connection.request(method, path, body=json.dumps(data) if data is not None else None,
                               headers={"Content-Type": "application/json", "Cookie": cookie, **(headers or {})})
            response = connection.getresponse()
            content = response.read()
            return response.status, dict(response.getheaders()), json.loads(content) if content.startswith(b"{") else content
        finally:
            connection.close()

    def login(self, username="admin", password="admin123"):
        status, headers, data = self.request("POST", "/api/auth/login", {"username": username, "password": password})
        self.assertEqual(status, 200)
        self.assertEqual(data, {"user": {"username": username}})
        return headers["Set-Cookie"].split(";", 1)[0], headers["Set-Cookie"]

    def test_public_status_default_login_and_protected_data(self):
        self.assertEqual(self.request("GET", "/api/auth/status")[2],
                         {"authenticated": False, "user": None, "registration_enabled": False})
        self.assertEqual(self.request("GET", "/api/health")[0], 200)
        self.assertEqual(self.request("GET", "/login.html")[2], b"sign in")
        self.assertEqual(self.request("GET", "/style.css")[0], 200)
        status, headers, _ = self.request("GET", "/")
        self.assertEqual((status, headers["Location"]), (302, "/login.html"))
        for path in ("/api/tasks", "/api/day?date=2026-10-30", "/api/month?month=2026-10", "/api/export", "/api/export?format=json"):
            status, _, data = self.request("GET", path)
            self.assertEqual((status, data["code"]), (401, "AUTH_REQUIRED"))
        self.assertEqual(self.request("POST", "/api/tasks", {"title": "private"})[0], 401)
        cookie, header = self.login()
        for flag in ("HttpOnly", "SameSite=Strict", "Path=/", f"Max-Age={SESSION_SECONDS}"):
            self.assertIn(flag, header)
        self.assertNotIn("Secure", header)
        self.assertEqual(self.request("GET", "/api/auth/status", cookie=cookie)[2],
                         {"authenticated": True, "user": {"username": "admin"}, "registration_enabled": False})
        self.assertEqual(self.request("POST", "/api/tasks", {"title": "private"}, cookie)[0], 201)
        self.assertEqual(self.request("GET", "/api/tasks", cookie=cookie)[2]["tasks"][0]["title"], "private")
        self.assertEqual(self.request("GET", "/", cookie=cookie)[2], b"private app")
        status, headers, _ = self.request("GET", "/login.html", cookie=cookie)
        self.assertEqual((status, headers["Location"]), (302, "/"))
        with closing(self.store.connect()) as db:
            account = dict(db.execute("SELECT * FROM accounts").fetchone())
            session = dict(db.execute("SELECT * FROM sessions").fetchone())
            self.assertNotIn("admin123", account.values())
            self.assertNotEqual(session["token_hash"], cookie.split("=", 1)[1])
            self.assertEqual(len(session["token_hash"]), 64)

    def test_wrong_credentials_have_same_error_and_logout_revokes_session(self):
        responses = [self.request("POST", "/api/auth/login", value) for value in (
            {"username": "admin", "password": "wrong"}, {"username": "unknown", "password": "admin123"})]
        self.assertEqual(responses[0][2], responses[1][2])
        self.assertEqual((responses[0][0], responses[0][2]["code"]), (401, "INVALID_CREDENTIALS"))
        cookie, _ = self.login()
        status, headers, data = self.request("POST", "/api/auth/logout", {}, cookie)
        self.assertEqual((status, data), (200, {"ok": True}))
        self.assertIn("Max-Age=0", headers["Set-Cookie"])
        self.assertEqual(self.request("GET", "/api/tasks", cookie=cookie)[0], 401)

    def test_sessions_survive_restart_but_expire(self):
        cookie, _ = self.login()
        restarted = Store(Path(self.directory.name) / "data", clock=lambda: self.now, timezone="Asia/Hong_Kong")
        token = cookie.split("=", 1)[1]
        self.assertEqual(restarted.session_user(token), {"username": "admin"})
        self.now += timedelta(seconds=SESSION_SECONDS)
        self.assertIsNone(restarted.session_user(token))
        self.assertEqual(self.request("GET", "/api/tasks", cookie=cookie)[0], 401)

    def test_account_update_checks_current_password_revokes_all_sessions(self):
        first, _ = self.login()
        second, _ = self.login()
        status, _, data = self.request("PATCH", "/api/account", {
            "username": "new-user", "current_password": "wrong", "new_password": "better-password"}, first)
        self.assertEqual((status, data["code"]), (400, "INVALID_CURRENT_PASSWORD"))
        self.assertEqual(self.request("GET", "/api/tasks", cookie=first)[0], 200)
        for value, code in (({"username": "x", "current_password": "admin123"}, "INVALID_USERNAME"),
                            ({"username": "bad\nname", "current_password": "admin123"}, "INVALID_USERNAME"),
                            ({"username": "ok", "current_password": "admin123", "new_password": "short"}, "INVALID_PASSWORD")):
            status, _, data = self.request("PATCH", "/api/account", value, first)
            self.assertEqual((status, data["code"]), (400, code))
        status, headers, data = self.request("PATCH", "/api/account", {
            "username": "new-user", "current_password": "admin123", "new_password": "better-password"}, first)
        self.assertEqual((status, data), (200, {"reauthenticate": True}))
        self.assertIn("Max-Age=0", headers["Set-Cookie"])
        for cookie in (first, second):
            self.assertEqual(self.request("GET", "/api/tasks", cookie=cookie)[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/login", {"username": "admin", "password": "admin123"})[0], 401)
        self.assertEqual(self.request("POST", "/api/auth/login", {"username": "new-user", "password": "admin123"})[0], 401)
        Store(Path(self.directory.name) / "data", clock=lambda: self.now, timezone="Asia/Hong_Kong")
        self.login("new-user", "better-password")

    def test_username_only_change_keeps_password_and_revokes_session(self):
        cookie, _ = self.login()
        self.assertEqual(self.request("PATCH", "/api/account", {
            "username": "renamed", "current_password": "admin123"}, cookie)[0], 200)
        self.assertEqual(self.request("GET", "/api/tasks", cookie=cookie)[0], 401)
        self.login("renamed", "admin123")

    def test_registration_csrf_and_content_type_are_rejected(self):
        for path in ("/api/auth/register", "/api/register"):
            self.assertEqual(self.request("POST", path, {})[2]["code"], "REGISTRATION_DISABLED")
        for origin in ("null", "http://evil.example", "http://localhost:1"):
            status, _, data = self.request("POST", "/api/auth/login", {"username": "admin", "password": "admin123"},
                                           headers={"Origin": origin})
            self.assertEqual((status, data["code"]), (403, "CSRF_REJECTED"))
        status, _, data = self.request("POST", "/api/auth/login", {}, headers={"Content-Type": "text/plain"})
        self.assertEqual((status, data["code"]), (415, "UNSUPPORTED_CONTENT_TYPE"))
        host, port = self.server.server_address
        status, _, _ = self.request("POST", "/api/auth/login", {"username": "admin", "password": "admin123"},
                                    headers={"Origin": f"http://{host}:{port}"})
        self.assertEqual(status, 200)

    def test_login_rate_limit_expires_instead_of_permanent_lock(self):
        with patch("backend.server.time.monotonic", return_value=1000):
            for _ in range(10):
                self.assertEqual(self.request("POST", "/api/auth/login", {"username": "admin", "password": "wrong"})[0], 401)
            status, _, data = self.request("POST", "/api/auth/login", {"username": "admin", "password": "admin123"})
            self.assertEqual((status, data["code"]), (429, "RATE_LIMITED"))
        with patch("backend.server.time.monotonic", return_value=1301):
            self.login()

    def test_export_excludes_authentication_and_migration_preserves_history(self):
        task = self.store.create({"title": "must survive"})
        self.store.patch(task["id"], {"completed": True})
        expected = self.store.export()
        with closing(self.store.connect()) as db, db:
            db.execute("DROP TABLE sessions")
            db.execute("DROP TABLE accounts")
        migrated = Store(Path(self.directory.name) / "data", clock=lambda: self.now, timezone="Asia/Hong_Kong")
        self.assertEqual(migrated.export(), expected)
        cookie, _ = self.login()
        status, _, data = self.request("GET", "/api/export?format=json", cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(data, expected)
        self.assertEqual(set(data), {"format", "version", "timezone", "exported_at", "tasks", "events"})
        self.assertEqual(migrated.day("2026-10-30")["summary"]["completed"], 1)

    def test_cookie_secure_can_be_enabled_for_tls_proxy(self):
        with patch.dict(os.environ, {"SESSION_COOKIE_SECURE": "1"}):
            server = make_server("127.0.0.1", 0, self.store, Path(self.directory.name) / "dist")
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = HTTPConnection(*server.server_address, timeout=10)
            connection.request("POST", "/api/auth/login", json.dumps({"username": "admin", "password": "admin123"}),
                               {"Content-Type": "application/json"})
            response = connection.getresponse()
            self.assertIn("Secure", response.getheader("Set-Cookie"))
            response.read()
            connection.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
