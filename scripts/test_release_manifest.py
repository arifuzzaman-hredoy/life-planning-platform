import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import release_manifest


class ReleaseManifestTests(unittest.TestCase):
    def test_sha256_is_stable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.tar"
            path.write_bytes(b"life-planning")
            self.assertEqual(
                release_manifest.sha256(path),
                "56221ae2fdace350cb63cfb6eeb21165abfe08a8eb5d1886676ed3ec7cec9910",
            )

    @patch("release_manifest.subprocess.check_output")
    def test_image_id_requires_digest(self, check_output):
        check_output.return_value = "not-a-digest\n"
        with self.assertRaises(ValueError):
            release_manifest.image_id("image:test")


if __name__ == "__main__":
    unittest.main()
