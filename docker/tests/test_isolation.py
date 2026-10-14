"""Contract checks: test tooling must not use developer data or credentials."""
import json
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
ALLOWED_BACKEND_ENVIRONMENT_KEYS = {
    "YII_ENV",
    "DB_HOST", "DB_NAME", "DB_USER", "DB_PASS",
    "JWT_SECRET_KEY", "JWT_REFRESH_SECRET_KEY", "COOKIE_VALIDATION_KEY",
}


class IsolationTest(unittest.TestCase):
    def test_compose_is_private_and_uses_only_test_credentials(self):
        compose = ROOT / "docker-compose.test.yml"
        self.assertTrue(compose.exists(), "A reproducible test Compose file is required")
        result = subprocess.run(
            ["docker", "compose", "-f", str(compose), "config", "--format", "json"],
            cwd=ROOT, capture_output=True, text=True, check=True,
        )
        config = json.loads(result.stdout)
        source_result = subprocess.run(
            ["docker", "compose", "-f", str(compose), "config",
             "--no-env-resolution", "--format", "json"],
            cwd=ROOT, capture_output=True, text=True, check=True,
        )
        source_config = json.loads(source_result.stdout)
        self.assertTrue(all(n.get("internal") for n in config["networks"].values()))
        for service in config["services"].values():
            self.assertFalse(service.get("ports"), "Test services must not publish host ports")
            self.assertNotIn("container_name", service)
        backend = config["services"]["backend"]
        self.assertEqual(set(backend["environment"]), ALLOWED_BACKEND_ENVIRONMENT_KEYS,
                         "Do not inherit application or provider credentials into the test stack")
        self.assertEqual(backend["environment"]["YII_ENV"], "test")
        self.assertEqual(backend["environment"]["DB_NAME"], "reserves_test")
        self.assertEqual(backend["environment"]["DB_HOST"], "db")
        self.assertEqual(backend["environment"]["DB_PASS"], "test-only-password")
        self.assertTrue(backend["environment"]["JWT_SECRET_KEY"].startswith("isolated-test-"))
        self.assertTrue(backend["environment"]["COOKIE_VALIDATION_KEY"].startswith("isolated-test-"))
        mounts = {m["target"]: m for m in backend["volumes"]}
        self.assertTrue(mounts["/app"]["read_only"])
        self.assertEqual(Path(mounts["/app/.env"]["source"]), ROOT / "docker/test/app.env")
        self.assertEqual(Path(mounts["/app/config/db.php"]["source"]), ROOT / "docker/test/db.php")
        self.assertEqual(Path(mounts["/app/config/test_db.php"]["source"]), ROOT / "docker/test/db.php")
        db = config["services"]["db"]
        self.assertNotIn("env_file", source_config["services"]["db"])
        backend_env_files = source_config["services"]["backend"].get("env_file", [])
        self.assertEqual(len(backend_env_files), 1)
        self.assertEqual(Path(backend_env_files[0]["path"]), ROOT / "docker/test/app.env")
        self.assertEqual(db["environment"]["MYSQL_DATABASE"], "reserves_test")
        self.assertIn("--protocol=tcp", db["healthcheck"]["test"])
        db_mounts = {m["target"]: m for m in db["volumes"]}
        seed_mount = db_mounts["/docker-entrypoint-initdb.d/02-test-users.sql"]
        self.assertEqual(Path(seed_mount["source"]), ROOT / "docker/test/seed-test-users.sql")
        self.assertTrue(seed_mount["read_only"])
        for volume in config.get("volumes", {}).values():
            self.assertFalse(volume.get("external"), "No developer volumes may be reused")

    def test_app_env_contains_only_synthetic_values(self):
        entries = {}
        for line in (ROOT / "docker/test/app.env").read_text().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            key, separator, value = stripped.partition("=")
            self.assertTrue(separator, "Every app.env entry must be KEY=value")
            key = key.strip()
            value = value.strip()
            self.assertIn(key, ALLOWED_BACKEND_ENVIRONMENT_KEYS)
            entries[key] = value
            if key.endswith("KEY") or "SECRET" in key:
                self.assertTrue(value.startswith("isolated-test-"), key)
        self.assertEqual(entries.get("DB_PASS"), "test-only-password")

    def test_database_configuration_refuses_non_test_targets(self):
        path = ROOT / "docker/test/db.php"
        self.assertTrue(path.exists(), "Test DB guard is required before running migrations")
        for host, name in [("db", "reserves"), ("production.example", "reserves_test"), ("", "")]:
            env = dict(os.environ, DB_HOST=host, DB_NAME=name)
            result = subprocess.run(["php", str(path)], env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0, "Unsafe DB target must fail closed")
        env = dict(os.environ, DB_HOST="db", DB_NAME="reserves_test",
                   DB_USER="reserves_test", DB_PASS="test-only-password")
        result = subprocess.run(["php", str(path)], env=env, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode())


if __name__ == "__main__":
    unittest.main()
