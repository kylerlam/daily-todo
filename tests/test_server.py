from contextlib import closing
from datetime import datetime, timezone
from http.client import HTTPConnection
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch

from backend.server import MAX_BODY, RequestError, Store, dump_yaml, make_server


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.time = datetime.fromisoformat("2026-10-29T10:00:00+08:00")
        self.store = Store(self.directory.name, clock=lambda: self.time, timezone="Asia/Hong_Kong")

    def on(self, day):
        self.time = datetime.fromisoformat(day + "T10:00:00+08:00")

    def test_pending_carries_until_completion_and_history_keeps_earlier_day(self):
        task = self.store.create({"title": "学习", "notes": "三小时"})
        self.on("2026-10-30")
        self.assertEqual(self.store.day("2026-10-30")["summary"]["pending"], 1)
        done = self.store.patch(task["id"], {"completed": True})
        self.assertTrue(done["completed"])
        self.assertEqual(self.store.day("2026-10-29")["summary"], {"total": 1, "completed": 0, "pending": 1})
        self.assertEqual(self.store.day("2026-10-30")["summary"], {"total": 1, "completed": 1, "pending": 0})
        self.on("2026-10-31")
        self.assertEqual(self.store.day("2026-10-31")["tasks"], [])
        self.assertEqual(self.store.current()["tasks"], [])
        reopened = Store(self.directory.name, clock=lambda: self.time, timezone="Asia/Hong_Kong")
        self.assertEqual(reopened.day("2026-10-30")["tasks"][0]["completed_at"], done["completed_at"])

    def test_later_undo_and_second_completion_do_not_rewrite_old_completion(self):
        task = self.store.create({"title": "跑步"})
        first = self.store.patch(task["id"], {"completed": True})
        self.on("2026-10-30")
        self.store.patch(task["id"], {"completed": False})
        self.assertEqual(self.store.day("2026-10-29")["tasks"][0]["completed_at"], first["completed_at"])
        self.assertFalse(self.store.day("2026-10-30")["tasks"][0]["completed"])
        self.on("2026-10-31")
        second = self.store.patch(task["id"], {"completed": True})
        self.assertNotEqual(first["completed_at"], second["completed_at"])
        self.assertEqual(self.store.day("2026-10-30")["summary"]["pending"], 1)
        self.assertEqual(self.store.day("2026-10-29")["summary"]["completed"], 1)
        self.assertEqual(len(self.store.export()["events"]), 4)

    def test_same_day_undo_uses_day_end_state_and_keeps_events(self):
        task = self.store.create({"title": "任务"})
        self.store.patch(task["id"], {"completed": True})
        self.store.patch(task["id"], {"completed": True})
        self.store.patch(task["id"], {"completed": False})
        self.assertEqual(self.store.day("2026-10-29")["summary"], {"total": 1, "completed": 0, "pending": 1})
        self.assertEqual([e["kind"] for e in self.store.export()["events"]], ["todo", "complete", "todo"])

    def test_edit_snapshot_preserves_past_title_and_original_completion_date(self):
        task = self.store.create({"title": "旧标题", "notes": "旧备注"})
        done = self.store.patch(task["id"], {"completed": True})
        self.on("2026-10-30")
        edited = self.store.patch(task["id"], {"title": "新标题", "notes": "新备注"})
        previous = self.store.day("2026-10-29")["tasks"][0]
        self.assertEqual((previous["title"], previous["notes"]), ("旧标题", "旧备注"))
        self.assertEqual(edited["completed_at"], done["completed_at"])
        self.assertEqual(self.store.day("2026-10-30")["tasks"], [])

    def test_discard_keeps_past_pending_and_does_not_count_as_done(self):
        task = self.store.create({"title": "暂时做不了"})
        self.on("2026-10-30")
        self.store.patch(task["id"], {"discarded": True})
        discarded = self.store.day("2026-10-30")
        self.assertTrue(discarded["tasks"][0]["discarded"])
        self.assertEqual(discarded["summary"], {"total": 1, "completed": 0, "pending": 0})
        self.assertEqual(self.store.day("2026-10-29")["summary"]["pending"], 1)
        self.on("2026-10-31")
        self.assertEqual(self.store.day("2026-10-31")["tasks"], [])
        self.store.patch(task["id"], {"discarded": False})
        self.assertEqual(self.store.day("2026-10-31")["summary"]["pending"], 1)

    def test_future_schedule_backdated_creation_and_timezone(self):
        future = self.store.create({"title": "明天", "day": "2026-10-30"})
        self.assertEqual(self.store.day("2026-10-29")["tasks"], [])
        self.assertEqual(self.store.current()["tasks"][0]["id"], future["id"])
        with self.assertRaises(RequestError):
            self.store.patch(future["id"], {"completed": True})
        self.assertEqual(len(self.store.export()["events"]), 1)
        self.store.create({"title": "今天补录旧安排", "day": "2026-10-01"})
        self.assertEqual(self.store.day("2026-10-28")["tasks"], [])
        self.time = datetime(2026, 10, 29, 16, 1, tzinfo=timezone.utc)
        self.assertEqual(self.store.today(), "2026-10-30")
        self.store.patch(future["id"], {"completed": True})
        self.assertEqual(self.store.day("2026-10-30")["summary"]["completed"], 1)

    def test_month_summaries_match_each_day_including_leap_year(self):
        self.on("2024-02-27")
        task = self.store.create({"title": "月底"})
        self.on("2024-02-28")
        self.store.patch(task["id"], {"completed": True})
        month = self.store.month("2024-02")
        self.assertEqual(len(month["days"]), 29)
        for item in month["days"]:
            self.assertEqual({k: v for k, v in item.items() if k != "date"}, self.store.day(item["date"])["summary"])

    def test_validation_and_failed_transaction_leave_no_partial_write(self):
        invalid = [{}, [], {"title": " "}, {"title": "a" * 301}, {"title": "a", "notes": "x" * 5001},
                   {"title": "a", "day": "2026-02-30"}, {"title": "a", "day": "2026-1-01"},
                   {"title": "a", "extra": 1}, {"title": True}, {"title": "\ud800"}]
        for value in invalid:
            with self.subTest(value=str(value)[:50]), self.assertRaises(RequestError):
                self.store.create(value)
        self.assertEqual(self.store.export()["tasks"], [])
        with patch.object(self.store, "append_event", side_effect=sqlite3.IntegrityError("simulated failure")):
            with self.assertRaises(sqlite3.IntegrityError):
                self.store.create({"title": "必须回滚"})
        self.assertEqual(self.store.export()["tasks"], [])
        task = self.store.create({"title": "原样"})
        for value in ({}, {"completed": 1}, {"discarded": "yes"}, {"day": "2026-10-30"},
                      {"completed": True, "discarded": False}):
            with self.subTest(value=value), self.assertRaises(RequestError):
                self.store.patch(task["id"], value)
        with patch.object(self.store, "append_event", side_effect=sqlite3.IntegrityError("simulated failure")):
            with self.assertRaises(sqlite3.IntegrityError):
                self.store.patch(task["id"], {"title": "改坏了", "completed": True})
        self.assertEqual(self.store.current()["tasks"][0]["title"], "原样")
        self.assertEqual(len(self.store.export()["events"]), 1)
        with self.assertRaises(RequestError):
            self.store.patch(9999, {"completed": True})
        for value in ("2026-13", "0000-01", "2026-1", "not-a-month"):
            with self.assertRaises(RequestError):
                self.store.month(value)

    def test_history_is_append_only_in_database(self):
        self.store.create({"title": "不可覆盖"})
        with closing(self.store.connect()) as db, db:
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("UPDATE events SET kind='complete'")
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute("DELETE FROM events")


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        (root / "dist").mkdir()
        (root / "dist/index.html").write_text("<main>Todo</main>")
        (root / "secret.txt").write_text("secret")
        self.store = Store(root / "data", timezone="Asia/Hong_Kong")
        self.server = make_server("127.0.0.1", 0, self.store, root / "dist")
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop)
        self.cookie = ""
        status, headers, _ = self.request("POST", "/api/auth/login", {"username": "admin", "password": "admin123"})
        self.assertEqual(status, 200)
        self.cookie = headers["Set-Cookie"].split(";", 1)[0]

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method, path, data=None, body=None, headers=None):
        connection = HTTPConnection(*self.server.server_address, timeout=3)
        try:
            payload = json.dumps(data).encode() if data is not None else body
            h = {"Content-Type": "application/json", "Cookie": self.cookie, **(headers or {})}
            connection.request(method, path, body=payload, headers=h)
            response = connection.getresponse()
            content = response.read()
            return response.status, dict(response.getheaders()), content
        finally:
            connection.close()

    def test_api_create_patch_day_month_export_and_static(self):
        status, _, body = self.request("POST", "/api/tasks", {"title": "中文任务"})
        self.assertEqual(status, 201)
        task = json.loads(body)
        status, _, body = self.request("PATCH", f'/api/tasks/{task["id"]}', {"completed": True})
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["completed"])
        today = self.store.today()
        for path in ("/api/tasks", f"/api/day?date={today}"):
            status, _, body = self.request("GET", path)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)["summary"]["completed"], 1)
        status, _, body = self.request("GET", f"/api/month?month={today[:7]}")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(json.loads(body)["days"]), 28)
        status, headers, body = self.request("GET", "/api/export?format=json")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")
        self.assertEqual(headers["Content-Disposition"], f'attachment; filename="tdl-{today}.json"')
        self.assertEqual(len(json.loads(body)["events"]), 2)
        self.assertEqual(self.request("GET", "/api/health")[0], 200)
        self.assertEqual(self.request("GET", "/calendar/2026-10-30")[2], b"<main>Todo</main>")
        self.assertEqual(self.request("HEAD", "/")[2], b"")

    def test_yaml_export_is_default_with_complete_history_and_safe_strings(self):
        title = 'yes: #todo "中文" \\ 😀'
        notes = '2026-10-30\nnull\r\nyes\tno\x00\x1f\x7f\x85\x9f\u2028\u2029---\n!!python/object: {}'
        task = self.store.create({"title": title, "notes": notes})
        self.store.patch(task["id"], {"completed": True})
        for suffix in ("", "?format=yml", "?format=yaml"):
            with self.subTest(suffix=suffix):
                status, headers, body = self.request("GET", "/api/export" + suffix)
                self.assertEqual(status, 200)
                self.assertEqual(headers["Content-Type"], "application/yaml; charset=utf-8")
                self.assertEqual(headers["Content-Disposition"], f'attachment; filename="tdl-{self.store.today()}.yml"')
                text = body.decode("utf-8")
                self.assertTrue(text.startswith('"format": "tdl-export"\n'))
                self.assertIn('"tasks":\n  -\n    "id": 1\n', text)
                self.assertIn('"events":\n  -\n    "id": 1\n', text)
                self.assertIn('    "title": "yes: #todo \\"中文\\" \\\\ 😀"\n', text)
                self.assertIn('    "kind": "complete"\n', text)
                self.assertIn('\\nnull\\r\\nyes\\tno\\u0000\\u001f\\u007f\\u0085\\u009f\\u2028\\u2029', text)
                for line in text.splitlines():
                    stripped = line.lstrip()
                    if stripped.startswith(('"title": ', '"notes": ')):
                        key, encoded = stripped.split(": ", 1)
                        self.assertEqual(json.loads(encoded), title if key == '"title"' else notes)
                try:
                    import yaml
                except ImportError:
                    pass  # Exact scalar and structure checks above do not need a dependency.
                else:
                    actual = yaml.safe_load(text)
                    expected = self.store.export()
                    self.assertEqual(actual["exported_at"], str(actual["exported_at"]))
                    actual.pop("exported_at")
                    expected.pop("exported_at")
                    self.assertEqual(actual, expected)

    def test_export_formats_reject_unknown_and_duplicate_queries(self):
        for query in ("format=xml", "format=", "format=json&format=yml", "extra=1", "format=yml&extra=1"):
            with self.subTest(query=query):
                status, headers, body = self.request("GET", "/api/export?" + query)
                self.assertEqual(status, 400)
                self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")
                self.assertIsInstance(json.loads(body)["error"], str)

    def test_invalid_http_inputs_and_traversal_have_json_errors(self):
        requests = [("GET", "/api/day?date=2026-02-30", None),
                    ("GET", "/api/day?date=2026-01-01&date=2026-01-02", None),
                    ("GET", "/api/month?month=2026-13", None),
                    ("GET", "/api/day", None),
                    ("POST", "/api/tasks", b"{"),
                    ("POST", "/api/tasks", b"x" * (MAX_BODY + 1)),
                    ("POST", "/api/tasks", b"[]"),
                    ("GET", "/%2e%2e/secret.txt", None)]
        for method, path, body in requests:
            with self.subTest(path=path):
                status, headers, content = self.request(method, path, body=body)
                self.assertEqual(status, 400)
                self.assertIn("application/json", headers["Content-Type"])
                self.assertIsInstance(json.loads(content)["error"], str)
        self.assertEqual(self.request("DELETE", "/api/tasks/1")[0], 405)
        self.assertEqual(self.request("GET", "/missing.js")[0], 404)
        self.assertEqual(self.request("GET", "/api/unknown")[0], 404)


class YamlTests(unittest.TestCase):
    def test_scalar_types_empty_collections_and_nested_structures(self):
        data = {"empty_list": [], "empty_dict": {}, "nested": [{"date": "2026-10-30", "yes": "yes",
                "null": "null", "nothing": None, "flag": True, "count": 7}, [False, 0, ""]]}
        expected = ('"empty_list": []\n"empty_dict": {}\n"nested":\n  -\n'
                    '    "date": "2026-10-30"\n    "yes": "yes"\n    "null": "null"\n'
                    '    "nothing": null\n    "flag": true\n    "count": 7\n'
                    '  -\n    - false\n    - 0\n    - ""\n')
        self.assertEqual(dump_yaml(data), expected)
        self.assertEqual(dump_yaml([]), "[]\n")
        self.assertEqual(dump_yaml({}), "{}\n")


if __name__ == "__main__":
    unittest.main()
