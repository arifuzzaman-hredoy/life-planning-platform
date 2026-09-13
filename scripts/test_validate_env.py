from pathlib import Path
import tempfile
import unittest

from validate_env import parse_env, validate


class EnvironmentValidationTests(unittest.TestCase):
    def make(self, body: str) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / "app.env"
        path.write_text(body, encoding="utf-8")
        path.chmod(0o600)
        return path

    def test_rejects_duplicate_keys(self):
        path = self.make("APP_URL=x\nAPP_URL=y\n")
        with self.assertRaises(ValueError):
            parse_env(path)

    def test_production_requires_proxy_and_long_secrets(self):
        path = self.make(
            "DATABASE_URL=postgresql://user:pass@example.invalid/db\n"
            "APP_URL=https://example.invalid\n"
            "SESSION_SECRET=short\n"
            "METRICS_TOKEN=short\n"
        )
        errors = validate(path, production=True)
        self.assertTrue(any("TRUST_PROXY" in item for item in errors))
        self.assertTrue(any("SESSION_SECRET" in item for item in errors))

    def test_valid_production_shape(self):
        path = self.make(
            "DATABASE_URL=postgresql://user:opaque@db.internal/db?sslmode=require\n"
            "APP_URL=https://plan.internal\n"
            "SESSION_SECRET=" + "a" * 48 + "\n"
            "METRICS_TOKEN=" + "b" * 48 + "\n"
            "TRUST_PROXY=true\n"
        )
        self.assertEqual(validate(path, production=True), [])


if __name__ == "__main__":
    unittest.main()
