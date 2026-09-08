"""Safety boundary tests for deployment plans, URL handling, and backup isolation."""
import tempfile
from pathlib import Path
import unittest

from deploy import verify_plan
from operations import env_file, postgres_environment


class OperationsSafetyTests(unittest.TestCase):
    def test_secret_environment_preserves_encoded_password_and_enforces_tls(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "app.env"
            path.write_text('DATABASE_URL="postgresql://owner:p%40ss%3Aword@db.example.com/db?sslmode=disable&channel_binding=require"\n')
            result = postgres_environment(path, False)
            self.assertEqual(result["PGPASSWORD"], "p@ss:word")
            self.assertEqual(result["PGSSLMODE"], "verify-full")
            self.assertEqual(result["PGSSLROOTCERT"], "system")
            self.assertEqual(result["PGCHANNELBINDING"], "require")

    def test_local_tls_exception_is_explicit_and_does_not_apply_to_remote(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "app.env"
            path.write_text("DATABASE_URL=postgresql://owner:pass@localhost/db\n")
            self.assertEqual(postgres_environment(path, False)["PGSSLMODE"], "verify-full")
            self.assertEqual(postgres_environment(path, True)["PGSSLMODE"], "disable")

    def test_environment_is_not_a_shell_script(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "app.env"
            path.write_text("SESSION_SECRET=$(whoami)\n")
            self.assertEqual(env_file(path)["SESSION_SECRET"], "$(whoami)")

    def test_neon_backup_connections_bypass_transaction_pooling(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "app.env"
            path.write_text("DATABASE_URL=postgresql://owner:pass@ep-example-pooler.aws.neon.tech/app\n")
            self.assertEqual(postgres_environment(path, False)["PGHOST"], "ep-example.aws.neon.tech")
            path.write_text("DATABASE_URL=postgresql://owner:pass@ep-example-pooler.neon.tech.example.com/app\n")
            self.assertEqual(postgres_environment(path, False)["PGHOST"], "ep-example-pooler.neon.tech.example.com")

    def test_project_container_replacement_is_permitted(self):
        verify_plan({"resource_changes": [{"address": "docker_container.app", "change": {"actions": ["delete", "create"]}}]})

    def test_other_workload_mutation_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_plan({"resource_changes": [{"address": "docker_container.other", "change": {"actions": ["update"]}}]})

    def test_project_network_deletion_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_plan({"resource_changes": [{"address": "docker_network.app", "change": {"actions": ["delete", "create"]}}]})


if __name__ == "__main__":
    unittest.main()
