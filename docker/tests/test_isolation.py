"""Contract checks: test tooling must not use developer data or credentials."""
import json
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]


class IsolationTest(unittest.TestCase):
    def test_compose_is_private_and_uses_only_test_credentials(self):
        compose = ROOT / "docker-compose.test.yml"
        self.assertTrue(compose.exists(), "A reproducible test Compose file is required")
        result = subprocess.run(
            ["docker", "compose", "-f", str(compose), "config", "--format", "json"],
            cwd=ROOT, capture_output=True, text=True, check=True,
        )
        config = json.loads(result.stdout)
        self.assertTrue(all(n.get("internal") for n in config["networks"].values()))
        for service in config["services"].values():
            self.assertFalse(service.get("ports"), "Test services must not publish host ports")
            self.assertNotIn("container_name", service)
            self.assertNotIn("env_file", service)
        backend = config["services"]["backend"]
        self.assertEqual(set(backend["environment"]), {
            "DB_HOST", "DB_NAME", "DB_USER", "DB_PASS",
            "JWT_SECRET_KEY", "JWT_REFRESH_SECRET_KEY",
        }, "Do not inherit application or provider credentials into the test stack")
        self.assertEqual(backend["environment"]["DB_NAME"], "reserves_test")
        self.assertEqual(backend["environment"]["DB_HOST"], "db")
        self.assertEqual(backend["environment"]["DB_PASS"], "test-only-password")
        self.assertTrue(backend["environment"]["JWT_SECRET_KEY"].startswith("isolated-test-"))
        mounts = {m["target"]: m for m in backend["volumes"]}
        self.assertTrue(mounts["/app"]["read_only"])
        self.assertEqual(Path(mounts["/app/.env"]["source"]), ROOT / "docker/test/app.env")
        self.assertEqual(Path(mounts["/app/config/db.php"]["source"]), ROOT / "docker/test/db.php")
        self.assertEqual(Path(mounts["/app/config/test_db.php"]["source"]), ROOT / "docker/test/db.php")
        db = config["services"]["db"]
        self.assertEqual(db["environment"]["MYSQL_DATABASE"], "reserves_test")
        for volume in config.get("volumes", {}).values():
            self.assertFalse(volume.get("external"), "No developer volumes may be reused")

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
