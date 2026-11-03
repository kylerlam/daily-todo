from contextlib import closing
from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from backend.data_transfer import ImportDataError, MAX_IMPORT_BYTES, read_export
from backend.server import Store, dump_yaml


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.time = datetime.fromisoformat("2026-10-27T10:00:00+08:00")
        root = Path(self.directory.name)
        self.source = Store(root / "source", clock=lambda: self.time, timezone="Asia/Hong_Kong")
        self.target = Store(root / "target", clock=lambda: self.time, timezone="Asia/Hong_Kong")

    def on(self, day):
        self.time = datetime.fromisoformat(day + "T10:00:00+08:00")

    @staticmethod
    def rows(store):
        value = store.export()
        return {key: value[key] for key in ("tasks", "events")}

    def test_yml_and_json_preserve_non_english_and_literal_strings(self):
        task = self.source.create({"title": "学习 / study / estudiar / 學習", "day": "2026-10-28", "notes":
                            '2026-10-27\ntrue: yes # null\r\nquote " \\ tab\t emoji 🌱\u0085\u2028'})
        self.source.patch(task["id"], {"completed": True})
        original = self.source.export()
        with closing(self.target.connect()) as db:
            account = tuple(db.execute("SELECT * FROM accounts").fetchone())
        for content in (dump_yaml(original), json.dumps(original, ensure_ascii=False)):
            with self.subTest(format="YML" if content.startswith('"format"') else "JSON"):
                self.assertEqual(read_export(content), original)
                self.target.import_data(content)
                self.assertEqual(self.rows(self.target), self.rows(self.source))
        with closing(self.target.connect()) as db:
            self.assertEqual(tuple(db.execute("SELECT * FROM accounts").fetchone()), account)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0], 0)

    def test_id_collisions_remap_tasks_and_preserve_each_historical_day(self):
        existing = self.target.create({"title": "Keep local task", "notes": "Never overwrite"})
        before = self.rows(self.target)
        task = self.source.create({"title": "Old title", "notes": "Original notes"})
        self.source.create({"title": "Scheduled", "day": "2026-11-04"})
        self.on("2026-10-28")
        self.source.patch(task["id"], {"completed": True})
        self.on("2026-10-29")
        self.source.patch(task["id"], {"title": "New title", "notes": "Edited notes"})
        self.on("2026-10-30")
        self.source.patch(task["id"], {"completed": False})
        self.on("2026-10-31")
        self.source.patch(task["id"], {"discarded": True})
        original = self.source.export()
        result = self.target.import_data(dump_yaml(original))
        self.assertEqual(result, {"imported_tasks": 2, "skipped_tasks": 0})
        imported = self.rows(self.target)
        self.assertEqual(imported["tasks"][:1], before["tasks"])
        self.assertEqual(imported["events"][:1], before["events"])
        imported_ids = {row["id"] for row in imported["tasks"]} - {existing["id"]}
        self.assertEqual(len(imported_ids), 2)
        self.assertTrue(all(row["task_id"] in imported_ids for row in imported["events"][1:]))
        for key in ("tasks", "events"):
            source_rows = [{k: v for k, v in row.items() if k not in ("id", "task_id")}
                           for row in original[key]]
            imported_rows = [{k: v for k, v in row.items() if k not in ("id", "task_id")}
                             for row in imported[key][1:]]
            self.assertEqual(imported_rows, source_rows)
        for day in ("2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30",
                    "2026-10-31", "2026-11-01", "2026-11-04"):
            with self.subTest(day=day):
                expected = self.source.day(day)["tasks"]
                actual = [row for row in self.target.day(day)["tasks"] if row["id"] in imported_ids]
                self.assertEqual([{k: v for k, v in row.items() if k != "id"} for row in actual],
                                 [{k: v for k, v in row.items() if k != "id"} for row in expected])

    def test_repeat_import_skips_and_newer_prefix_only_appends_missing_history(self):
        task = self.source.create({"title": "Read daily", "notes": "Chapter one"})
        older = self.source.export()
        self.target.import_data(dump_yaml(older))
        first = self.rows(self.target)
        self.assertEqual(self.target.import_data(json.dumps(older)),
                         {"imported_tasks": 0, "skipped_tasks": 1})
        self.assertEqual(self.rows(self.target), first)
        self.on("2026-10-28")
        self.source.patch(task["id"], {"completed": True})
        self.on("2026-10-29")
        self.source.patch(task["id"], {"title": "Read book", "notes": "Finished"})
        newer = self.source.export()
        self.assertEqual(self.target.import_data(dump_yaml(newer)),
                         {"imported_tasks": 1, "skipped_tasks": 0})
        merged = self.rows(self.target)
        self.assertEqual(merged, self.rows(self.source))
        self.assertEqual(merged["events"][:1], first["events"])
        self.assertEqual(self.target.import_data(dump_yaml(older)),
                         {"imported_tasks": 0, "skipped_tasks": 1})
        self.assertEqual(self.rows(self.target), merged)
        assigned = self.target.day("2026-10-27")["tasks"][0]
        self.assertEqual(assigned["title"], "Read book")
        self.assertEqual(assigned["completed_at"], newer["events"][1]["state_at"])
        self.assertEqual(self.target.day("2026-10-28")["tasks"], [])

    def test_old_export_merges_new_assignment_without_duplication_and_fresh_import_keeps_priority(self):
        first = self.source.create({"title": "First", "day": "2026-10-29"})
        second = self.source.create({"title": "Second"})
        older = dump_yaml(self.source.export())
        self.target.import_data(older)
        self.on("2026-10-28")
        self.source.patch(second["id"], {"completed": True})
        self.source.patch(second["id"], {"completed": False})
        self.source.patch(second["id"], {"day": "2026-10-29"})
        self.source.patch(second["id"], {"before_id": first["id"]})
        newer = dump_yaml(self.source.export())
        self.assertEqual(self.target.import_data(newer), {"imported_tasks": 1, "skipped_tasks": 1})
        self.assertEqual(self.target.import_data(older), {"imported_tasks": 0, "skipped_tasks": 2})
        self.assertEqual(len(self.target.export()["tasks"]), 2)
        self.assertEqual(self.target.day("2026-10-27")["tasks"], [])
        restored = Store(self.target.path.parent / "restored", clock=lambda: self.time, timezone="Asia/Hong_Kong")
        restored.import_data(newer)
        self.assertEqual(self.rows(restored), self.rows(self.source))
        self.assertEqual([task["title"] for task in restored.day("2026-10-29")["tasks"]], ["Second", "First"])

    def test_import_preserves_local_priority_and_appends_arrivals_in_source_order(self):
        day = "2026-10-29"
        first = self.source.create({"title": "A", "day": day})
        second = self.source.create({"title": "B", "day": day})
        moved = self.source.create({"title": "C"})
        self.source.patch(second["id"], {"before_id": first["id"]})
        self.target.import_data(dump_yaml(self.source.export()))

        self.on("2026-10-28")
        self.source.patch(moved["id"], {"day": day})
        added = self.source.create({"title": "D", "day": day})
        self.source.patch(moved["id"], {"before_id": second["id"]})
        self.source.patch(added["id"], {"before_id": moved["id"]})
        newer = dump_yaml(self.source.export())

        self.assertEqual(self.target.import_data(newer), {"imported_tasks": 2, "skipped_tasks": 2})
        self.assertEqual([task["title"] for task in self.target.day(day)["tasks"]], ["B", "A", "D", "C"])
        merged = self.rows(self.target)
        self.assertEqual(self.target.import_data(newer), {"imported_tasks": 0, "skipped_tasks": 4})
        self.assertEqual(self.rows(self.target), merged)

    def test_divergent_history_rejects_entire_batch(self):
        self.source.create({"title": "New sibling must not leak"})
        shared = self.source.create({"title": "Shared origin"})
        base = self.source.export()
        base["tasks"] = [row for row in base["tasks"] if row["id"] == shared["id"]]
        base["events"] = [row for row in base["events"] if row["task_id"] == shared["id"]]
        self.target.import_data(dump_yaml(base))
        self.on("2026-10-28")
        self.source.patch(shared["id"], {"completed": True})
        local_id = self.target.export()["tasks"][0]["id"]
        self.target.patch(local_id, {"discarded": True})
        before = self.rows(self.target)
        with self.assertRaises(ImportDataError) as error:
            self.target.import_data(dump_yaml(self.source.export()))
        self.assertEqual(error.exception.code, "IMPORT_CONFLICT")
        self.assertEqual(self.rows(self.target), before)

    def test_database_failure_rolls_back_tasks_and_events(self):
        self.target.create({"title": "Existing"})
        self.source.create({"title": "Force insert failure"})
        before = self.rows(self.target)
        with closing(self.target.connect()) as db, db:
            db.execute("""CREATE TRIGGER fail_import BEFORE INSERT ON events
                WHEN NEW.title='Force insert failure'
                BEGIN SELECT RAISE(ABORT, 'simulated import failure'); END""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.target.import_data(dump_yaml(self.source.export()))
        self.assertEqual(self.rows(self.target), before)

    def test_invalid_schemas_and_histories_reject_without_changes(self):
        self.target.create({"title": "Keep local"})
        self.source.create({"title": "Imported"})
        valid = self.source.export()
        invalid = {}
        for name, path, replacement in (
                ("version", ("version",), True),
                ("unknown fields", ("accounts",), []),
                ("task id type", ("tasks", 0, "id"), True),
                ("bad day", ("tasks", 0, "day"), "2026-02-30"),
                ("orphan", ("events", 0, "task_id"), 999),
                ("bad kind", ("events", 0, "kind"), "done"),
                ("bad date", ("events", 0, "effective_date"), "2026-10-26"),
                ("naive timestamp", ("events", 0, "at"), "2026-10-27T10:00:00"),
                ("future state", ("events", 0, "state_at"), "2026-10-28T10:00:00+08:00"),
                ("last snapshot mismatch", ("tasks", 0, "notes"), "Different"),
                ("task surrogate", ("tasks", 0, "title"), "\ud800"),
                ("event surrogate", ("events", 0, "notes"), "\udfff")):
            value = deepcopy(valid)
            node = value
            for part in path[:-1]:
                node = node[part]
            node[path[-1]] = replacement
            invalid[name] = value
        for name, key in (("duplicate task ids", "tasks"), ("duplicate event ids", "events")):
            value = deepcopy(valid)
            value[key].append(deepcopy(value[key][0]))
            invalid[name] = value
        value = deepcopy(valid)
        value["events"] = []
        invalid["missing history"] = value
        value = deepcopy(valid)
        bad_timestamp = value["tasks"][0]["created_at"].replace("T", "\ud800")
        value["tasks"][0]["created_at"] = bad_timestamp
        value["events"][0]["at"] = bad_timestamp
        value["events"][0]["state_at"] = bad_timestamp
        invalid["timestamp surrogate"] = value
        before = self.rows(self.target)
        for name, value in invalid.items():
            with self.subTest(case=name), self.assertRaises(ImportDataError):
                self.target.import_data(json.dumps(value))
            self.assertEqual(self.rows(self.target), before)

    def test_unsafe_malformed_and_deep_documents_reject_without_changes(self):
        self.target.create({"title": "Keep local"})
        before = self.rows(self.target)
        documents = {
            "duplicate JSON keys": '{"format":"tdl-export","format":"tdl-export"}',
            "duplicate YML keys": '"format": "tdl-export"\n"format": "tdl-export"\n',
            "unsafe tag": '"tasks": !!python/object/apply:os.system ["touch /tmp/unsafe"]',
            "alias": '"tasks": &tasks []\n"events": *tasks\n',
            "deep JSON": "[" * 2000 + "0" + "]" * 2000,
            "invalid UTF-8 string": "\ud800",
            "non-finite number": '{"version": NaN}',
            "empty": "",
        }
        for name, content in documents.items():
            with self.subTest(case=name), self.assertRaises(ImportDataError):
                self.target.import_data(content)
            self.assertEqual(self.rows(self.target), before)

    def test_import_size_limit_counts_utf8_bytes_and_accepts_boundary(self):
        value = self.source.export()
        content = json.dumps(value)
        boundary = content + " " * (MAX_IMPORT_BYTES - len(content.encode("utf-8")))
        self.assertEqual(read_export(boundary), value)
        before = self.rows(self.target)
        for content in (boundary + " ", "é" * (MAX_IMPORT_BYTES // 2 + 1)):
            with self.subTest(bytes=len(content.encode("utf-8"))), self.assertRaises(ImportDataError) as error:
                self.target.import_data(content)
            self.assertEqual(error.exception.code, "IMPORT_TOO_LARGE")
            self.assertEqual(self.rows(self.target), before)


if __name__ == "__main__":
    unittest.main()
