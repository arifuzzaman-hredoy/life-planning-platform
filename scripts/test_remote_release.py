import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("remote_release.py")
SPEC = importlib.util.spec_from_file_location("life_planning_remote_release", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class RemoteReleaseOutputTests(unittest.TestCase):
    def test_decodes_paramiko_byte_output(self):
        self.assertEqual(
            MODULE.decode_channel_output(b"line one\nline two\n"),
            "line one\nline two\n",
        )

    def test_replaces_invalid_utf8_without_crashing(self):
        self.assertEqual(
            MODULE.decode_channel_output(b"ok\xff"),
            "ok\ufffd",
        )

    def test_accepts_text_output(self):
        self.assertEqual(MODULE.decode_channel_output("ready\n"), "ready\n")


if __name__ == "__main__":
    unittest.main()
