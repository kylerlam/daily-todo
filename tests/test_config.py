import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfoNotFoundError

from backend.server import load_config


class ConfigTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        previous = Path.cwd()
        self.addCleanup(os.chdir, previous)
        os.chdir(directory.name)
        self.enterContext(patch.dict(os.environ, {}, clear=True))

    def config(self, content, path="app.toml"):
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return target

    def test_missing_optional_file_uses_defaults_without_writing_files(self):
        self.assertEqual(load_config(), {"timezone": "Asia/Hong_Kong", "secure_cookies": False})
        self.assertEqual(list(Path.cwd().iterdir()), [])

    def test_default_path_and_partial_config(self):
        self.config('[app]\nsecure_cookies = true\n', "config/app.toml")
        self.assertEqual(load_config(), {"timezone": "Asia/Hong_Kong", "secure_cookies": True})

    def test_explicit_path_uses_only_supported_app_values(self):
        self.config('[app]\ntimezone = "UTC"\nsecure_cookies = true\n', "chosen/config.toml")
        self.assertEqual(load_config("chosen/config.toml"), {"timezone": "UTC", "secure_cookies": True})

    def test_environment_overrides_file_with_explicit_values(self):
        path = self.config('[app]\ntimezone = "Europe/London"\nsecure_cookies = true\n')
        os.environ["TZ"] = "UTC"
        for setting, expected in (("true", True), ("1", True), ("FALSE", False), ("0", False)):
            with self.subTest(setting=setting):
                os.environ["SESSION_COOKIE_SECURE"] = setting
                self.assertEqual(load_config(path), {"timezone": "UTC", "secure_cookies": expected})

    def test_empty_secure_environment_does_not_override_file(self):
        path = self.config('[app]\nsecure_cookies = true\n')
        os.environ["SESSION_COOKIE_SECURE"] = ""
        self.assertTrue(load_config(path)["secure_cookies"])

    def test_unknown_keys_and_wrong_types_fail(self):
        invalid = (
            'unknown = 1\n',
            '[other]\ntimezone = "UTC"\n',
            'app = "not a table"\n',
            '[app]\nextra = true\n',
            '[app]\ntimezone = 8\n',
            '[app]\ntimezone = true\n',
            '[app]\nsecure_cookies = "false"\n',
            '[app]\nsecure_cookies = 1\n',
        )
        for content in invalid:
            with self.subTest(content=content), self.assertRaises(ValueError):
                load_config(self.config(content))

    def test_invalid_zone_and_secure_environment_fail(self):
        path = self.config('[app]\ntimezone = "Not/A_Timezone"\n')
        with self.assertRaises(ZoneInfoNotFoundError):
            load_config(path)
        os.environ["TZ"] = "UTC"
        self.assertEqual(load_config(path)["timezone"], "UTC")
        os.environ["TZ"] = "Not/A_Timezone"
        with self.assertRaises(ZoneInfoNotFoundError):
            load_config()
        os.environ["TZ"] = "UTC"
        for setting in ("yes", "enabled", " true "):
            with self.subTest(setting=setting), self.assertRaises(ValueError):
                os.environ["SESSION_COOKIE_SECURE"] = setting
                load_config()

    def test_required_missing_file_and_invalid_toml_fail(self):
        with self.assertRaises(FileNotFoundError):
            load_config("missing.toml")
        with self.assertRaises(ValueError):
            load_config(self.config("[app\n"))


if __name__ == "__main__":
    unittest.main()
