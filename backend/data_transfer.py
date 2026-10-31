"""Read Daily Todo exports and merge their original task history."""

from datetime import datetime
import json
import re
from zoneinfo import ZoneInfo


MAX_IMPORT_BYTES = 10 * 1024 * 1024


class ImportDataError(ValueError):
    def __init__(self, message="This is not a valid Daily Todo export.", code="INVALID_IMPORT"):
        super().__init__(message)
        self.code = code


def read_export(content):
    if not isinstance(content, str):
        raise ImportDataError()
    try:
        size = len(content.encode("utf-8"))
    except UnicodeError:
        raise ImportDataError() from None
    if size > MAX_IMPORT_BYTES:
        raise ImportDataError("Choose a file smaller than 10 MiB.", "IMPORT_TOO_LARGE")
    content = content.lstrip("\ufeff")

    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ImportDataError("Duplicate fields are not allowed.")
            result[key] = value
        return result

    def no_constant(value):
        raise ImportDataError()

    decoder = json.JSONDecoder(object_pairs_hook=unique_pairs, parse_constant=no_constant)
    try:
        return decoder.decode(content)
    except RecursionError:
        raise ImportDataError() from None
    except json.JSONDecodeError:
        pass
    except ValueError:
        raise ImportDataError() from None
    # Accept the small YAML grammar emitted by dump_yaml, never tags or aliases.
    # JSON-quoted strings preserve notes, newlines, and date-like text exactly.
    lines = []
    for line in content.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if "\t" in line or line.strip() in ("---", "..."):
            raise ImportDataError("Use an unmodified Daily Todo YML export.")
        indent = len(line) - len(line.lstrip(" "))
        if indent % 2 or indent > 6:
            raise ImportDataError()
        lines.append((indent, line[indent:]))
    if not lines:
        raise ImportDataError()

    def scalar(text):
        try:
            value = decoder.decode(text)
        except (ValueError, RecursionError):
            raise ImportDataError("Use an unmodified Daily Todo YML export.") from None
        if isinstance(value, (dict, list)) and value not in ({}, []):
            raise ImportDataError()
        return value

    def block(index, indent):
        sequence = lines[index][1] == "-" or lines[index][1].startswith("- ")
        result = [] if sequence else {}
        while index < len(lines) and lines[index][0] == indent:
            text = lines[index][1]
            if sequence:
                if not (text == "-" or text.startswith("- ")):
                    raise ImportDataError()
                rest = text[1:].strip()
            else:
                try:
                    key, end = decoder.raw_decode(text)
                except json.JSONDecodeError:
                    match = re.match(r"([A-Za-z_][A-Za-z_0-9]*):", text)
                    if not match:
                        raise ImportDataError() from None
                    key, end = match[1], match.end() - 1
                if not isinstance(key, str) or key in result or not text[end:].startswith(":"):
                    raise ImportDataError()
                rest = text[end + 1:].strip()
            index += 1
            if rest:
                value = scalar(rest)
            elif index < len(lines) and lines[index][0] == indent + 2:
                value, index = block(index, indent + 2)
            else:
                raise ImportDataError()
            if sequence:
                result.append(value)
            else:
                result[key] = value
        return result, index

    try:
        result, consumed = block(0, 0)
    except (ValueError, IndexError, RecursionError):
        raise ImportDataError() from None
    if consumed != len(lines):
        raise ImportDataError()
    return result


def validate_export(value):
    def fields(item, expected):
        if not isinstance(item, dict) or set(item) != set(expected.split()):
            raise ImportDataError()

    def identifier(value):
        if type(value) is not int or not 0 < value < 2 ** 63:
            raise ImportDataError()

    def timestamp(value):
        try:
            if not isinstance(value, str):
                raise ValueError()
            value.encode("utf-8")
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                raise ValueError()
            return parsed
        except (TypeError, ValueError):
            raise ImportDataError() from None

    def day(value):
        try:
            from datetime import date
            if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError()
            date.fromisoformat(value)
        except ValueError:
            raise ImportDataError() from None

    def text(item):
        for key, limit in (("title", 300), ("notes", 5000)):
            value = item[key]
            if not isinstance(value, str) or len(value) > limit or (key == "title" and not value.strip()):
                raise ImportDataError()
            try:
                value.encode("utf-8")
            except UnicodeError:
                raise ImportDataError() from None

    fields(value, "format version timezone exported_at tasks events")
    if value["format"] != "tdl-export" or type(value["version"]) is not int or value["version"] != 1:
        raise ImportDataError()
    try:
        ZoneInfo(value["timezone"])
    except (TypeError, ValueError, KeyError, UnicodeError):
        raise ImportDataError() from None
    timestamp(value["exported_at"])
    if not isinstance(value["tasks"], list) or not isinstance(value["events"], list):
        raise ImportDataError()
    tasks, histories, event_ids = {}, {}, set()
    for task in value["tasks"]:
        fields(task, "id title notes created_at day")
        identifier(task["id"])
        if task["id"] in tasks:
            raise ImportDataError()
        text(task)
        timestamp(task["created_at"])
        day(task["day"])
        tasks[task["id"]] = task
        histories[task["id"]] = []
    for event in value["events"]:
        fields(event, "id task_id kind at effective_date state_at title notes")
        identifier(event["id"])
        identifier(event["task_id"])
        if event["id"] in event_ids or event["task_id"] not in tasks or event["kind"] not in ("todo", "complete", "discard"):
            raise ImportDataError()
        event_ids.add(event["id"])
        text(event)
        at, state_at = timestamp(event["at"]), timestamp(event["state_at"])
        day(event["effective_date"])
        if state_at > at or event["effective_date"] != event["at"][:10]:
            raise ImportDataError()
        if event["kind"] == "complete" and tasks[event["task_id"]]["day"] > event["effective_date"]:
            raise ImportDataError()
        histories[event["task_id"]].append(event)
    for task_id, task in tasks.items():
        history = histories[task_id]
        history.sort(key=lambda item: item["id"])
        if not history:
            raise ImportDataError()
        first = history[0]
        if first["kind"] != "todo" or first["at"] != task["created_at"] or first["state_at"] != first["at"]:
            raise ImportDataError()
        for previous, current in zip(history, history[1:]):
            if timestamp(current["at"]) < timestamp(previous["at"]):
                raise ImportDataError()
            expected = current["at"] if current["kind"] != previous["kind"] else previous["state_at"]
            if current["state_at"] != expected:
                raise ImportDataError()
        if (task["title"], task["notes"]) != (history[-1]["title"], history[-1]["notes"]):
            raise ImportDataError()
    return tasks, histories


def merge_export(db, value):
    tasks, histories = validate_export(value)
    existing = [dict(row) for row in db.execute("SELECT * FROM tasks ORDER BY id")]
    local_histories = {task["id"]: [] for task in existing}
    for row in db.execute("SELECT * FROM events ORDER BY id"):
        local_histories[row["task_id"]].append(dict(row))

    def identity(task, history):
        first = history[0]
        return task["created_at"], task["day"], first["title"], first["notes"]

    def events(history):
        return [{key: val for key, val in item.items() if key not in ("id", "task_id")} for item in history]

    candidates = {}
    for task in existing:
        candidates.setdefault(identity(task, local_histories[task["id"]]), []).append(task)
    used, plan, skipped = set(), [], 0
    for task_id, task in tasks.items():
        history = histories[task_id]
        incoming = events(history)
        matches = [item for item in candidates.get(identity(task, history), []) if item["id"] not in used]
        chosen = None
        for item in matches:
            local = events(local_histories[item["id"]])
            if incoming[:len(local)] == local or local[:len(incoming)] == incoming:
                chosen = item, len(local)
                break
        if chosen:
            local_task, count = chosen
            used.add(local_task["id"])
            if len(history) <= count:
                skipped += 1
            else:
                plan.append((task, history[count:], local_task["id"]))
        elif matches:
            raise ImportDataError("This task has conflicting history. No data was imported.", "IMPORT_CONFLICT")
        else:
            plan.append((task, history, None))
    pending = []
    for task, history, local_id in plan:
        if local_id is None:
            local_id = db.execute("INSERT INTO tasks(title,notes,created_at,day) VALUES(?,?,?,?)",
                                  (task["title"], task["notes"], task["created_at"], task["day"])).lastrowid
        else:
            db.execute("UPDATE tasks SET title=?,notes=? WHERE id=?", (task["title"], task["notes"], local_id))
        pending.extend((event, local_id) for event in history)
    for event, local_id in sorted(pending, key=lambda item: item[0]["id"]):
        db.execute("INSERT INTO events(task_id,kind,at,effective_date,state_at,title,notes) VALUES(?,?,?,?,?,?,?)",
                   (local_id, *(event[key] for key in ("kind", "at", "effective_date", "state_at", "title", "notes"))))
    return {"imported_tasks": len(plan), "skipped_tasks": skipped}
