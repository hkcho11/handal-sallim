import hashlib
import json
import io
import os
from contextlib import contextmanager, ExitStack
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, Mock
import zipfile
import nightly_api as deploy
import package_candidate


class DeploymentTest(unittest.TestCase):
    @contextmanager
    def candidate(self, migration=False, bad_checksum=False, readiness=(True,)):
        with tempfile.TemporaryDirectory() as folder, ExitStack() as stack:
            root = Path(folder)
            (root / "releases").mkdir()
            old = root / "releases" / "old.jar"
            with zipfile.ZipFile(old, "w") as archive:
                archive.writestr("BOOT-INF/classes/db/migration/V1.sql", b"CREATE TABLE a(id int);")
            (root / "current.jar").symlink_to(old)
            new = root / "candidate.jar"
            with zipfile.ZipFile(new, "w") as archive:
                archive.writestr("BOOT-INF/classes/db/migration/V1.sql", b"CREATE TABLE a(id int);")
                if migration:
                    archive.writestr("BOOT-INF/classes/db/migration/V2.sql", b"ALTER TABLE a ADD COLUMN name text;")
            state = root / "state"
            state.write_text("a" * 40)
            data = new.read_bytes()
            candidate = {"source_sha": "b" * 40, "backend_tree": "c" * 40,
                         "jar_sha256": "0" * 64 if bad_checksum else hashlib.sha256(data).hexdigest(),
                         "migrations": package_candidate.migrations(new)}
            runs = {"workflow_runs": [{"head_sha": "b" * 40, "head_branch": "main", "path": ".github/workflows/ci.yml", "conclusion": "success"}]}
            for name, value in (("ROOT", root), ("STATE", state)):
                stack.enter_context(patch.object(deploy, name, value))
            stack.enter_context(patch.object(deploy, "in_window", return_value=True))
            stack.enter_context(patch.object(deploy, "read_json", side_effect=[candidate, runs]))
            stack.enter_context(patch.object(deploy, "urlopen", return_value=io.BytesIO(data)))
            stack.enter_context(patch.object(deploy, "healthy", return_value=True))
            stack.enter_context(patch.object(deploy, "wait_healthy", side_effect=readiness))
            backup = stack.enter_context(patch.object(deploy, "backup"))
            command = stack.enter_context(patch.object(deploy, "run"))
            yield root, old, state, backup, command

    @unittest.skipIf(os.name == "nt", "POSIX release paths verified on Ubuntu CI/server")
    def test_checksum_mismatch_never_backs_up_or_restarts(self):
        with self.candidate(bad_checksum=True) as (root, old, state, backup, command):
            with self.assertRaisesRegex(RuntimeError, "checksum mismatch"):
                deploy.deploy()
            backup.assert_not_called()
            command.assert_not_called()
            self.assertEqual((root / "current.jar").resolve(), old)

    @unittest.skipIf(os.name == "nt", "POSIX release paths verified on Ubuntu CI/server")
    def test_code_only_failure_restores_previous_jar(self):
        with self.candidate(readiness=(False, True)) as (root, old, state, backup, command):
            with self.assertRaisesRegex(RuntimeError, "Previous API restored"):
                deploy.deploy()
            self.assertEqual((root / "current.jar").resolve(), old)
            self.assertEqual(state.read_text(), "a" * 40)
            self.assertEqual(command.call_count, 2)

    @unittest.skipIf(os.name == "nt", "POSIX release paths verified on Ubuntu CI/server")
    def test_migration_failure_does_not_blindly_undo_database_or_api(self):
        with self.candidate(migration=True, readiness=(False,)) as (root, old, state, backup, command):
            with self.assertRaisesRegex(RuntimeError, "manual recovery"):
                deploy.deploy()
            self.assertNotEqual((root / "current.jar").resolve(), old)
            self.assertEqual(command.call_args.args[0], ["systemctl", "stop", "handalsallim-api"])
            self.assertEqual(state.read_text(), "a" * 40)

    @unittest.skipIf(os.name == "nt", "POSIX release paths verified on Ubuntu CI/server")
    def test_healthy_deployment_records_new_tree(self):
        with self.candidate() as (root, old, state, backup, command):
            deploy.deploy()
            self.assertEqual(state.read_text().strip(), "c" * 40)
            self.assertNotEqual((root / "current.jar").resolve(), old)
            backup.assert_called_once()

    def test_existing_migrations_must_not_change_or_disappear(self):
        with self.assertRaises(RuntimeError):
            deploy.validate_migrations({"V1.sql": b"CREATE TABLE a();"}, {})
        with self.assertRaises(RuntimeError):
            deploy.validate_migrations({"V1.sql": b"a"}, {"V1.sql": b"b"})

    def test_additive_migration_and_destructive_gate(self):
        original = {"V1.sql": b"CREATE TABLE a (id int);"}
        self.assertFalse(deploy.validate_migrations(original, original))
        self.assertTrue(deploy.validate_migrations(original, {**original, "V2.sql": b"ALTER TABLE a ADD COLUMN name text;"}))
        for sql in (b"DROP TABLE a", b"DELETE FROM a", b"UPDATE a SET id=2", b"ALTER TABLE a RENAME TO b", b"DO $$ BEGIN END $$"):
            with self.assertRaises(RuntimeError):
                deploy.validate_migrations(original, {**original, "V2.sql": sql})

    def test_windows_and_linux_migration_line_endings_match(self):
        with tempfile.TemporaryDirectory() as folder:
            jar = Path(folder) / "api.jar"
            with zipfile.ZipFile(jar, "w") as archive:
                archive.writestr("BOOT-INF/classes/db/migration/V1.sql", b"SELECT 1;\r\n")
            self.assertEqual(deploy.migration_files(jar)["V1.sql"], b"SELECT 1;\n")
            self.assertEqual(package_candidate.migrations(jar)["V1.sql"], hashlib.sha256(b"SELECT 1;\n").hexdigest())

    def test_failed_command_does_not_print_secret_output(self):
        with patch.object(deploy.subprocess, "run", return_value=Mock(returncode=1, stderr=b"private transaction")):
            with self.assertRaisesRegex(RuntimeError, "output withheld") as error:
                deploy.run(["pg_dump"])
            self.assertNotIn("private transaction", str(error.exception))

    @unittest.skipIf(os.name == "nt", "POSIX symlinks verified on Ubuntu CI/server")
    def test_switch_is_a_symlink_to_preserved_release(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(deploy, "ROOT", Path(folder)):
            old = Path(folder) / "old.jar"
            new = Path(folder) / "new.jar"
            old.write_bytes(b"old")
            new.write_bytes(b"new")
            (Path(folder) / "current.jar").symlink_to(old)
            deploy.switch_to(new)
            self.assertEqual((Path(folder) / "current.jar").resolve(), new)
            self.assertEqual(old.read_bytes(), b"old")

    def test_same_tree_performs_no_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder) / "state"
            state.write_text("a" * 40)
            with patch.object(deploy, "in_window", return_value=True), patch.object(deploy, "STATE", state), patch.object(deploy, "read_json", return_value={"source_sha": "b" * 40, "backend_tree": "a" * 40}), patch.object(deploy, "run") as command:
                deploy.deploy()
                command.assert_not_called()

    def test_daytime_run_cannot_even_fetch_candidate(self):
        with patch.object(deploy, "in_window", return_value=False), patch.object(deploy, "read_json") as network:
            with self.assertRaisesRegex(RuntimeError, "04:00"):
                deploy.deploy()
            network.assert_not_called()

    @unittest.skipIf(os.name == "nt", "POSIX release paths verified on Ubuntu CI/server")
    def test_backup_failure_leaves_existing_api_untouched(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "releases").mkdir()
            current = root / "releases" / "old.jar"
            with zipfile.ZipFile(current, "w") as archive:
                archive.writestr("BOOT-INF/classes/db/migration/V1.sql", b"CREATE TABLE a(id int);")
            (root / "current.jar").symlink_to(current)
            state = root / "state"
            state.write_text("a" * 40)
            data = current.read_bytes()
            candidate = {"source_sha": "b" * 40, "backend_tree": "c" * 40,
                         "jar_sha256": hashlib.sha256(data).hexdigest(),
                         "migrations": package_candidate.migrations(current)}
            run = {"workflow_runs": [{"head_sha": "b" * 40, "head_branch": "main",
                                     "path": ".github/workflows/ci.yml", "conclusion": "success"}]}
            with patch.object(deploy, "ROOT", root), patch.object(deploy, "STATE", state), \
                 patch.object(deploy, "in_window", return_value=True), \
                 patch.object(deploy, "read_json", side_effect=[candidate, run]), \
                 patch.object(deploy, "urlopen", return_value=io.BytesIO(data)), \
                 patch.object(deploy, "healthy", return_value=True), \
                 patch.object(deploy, "backup", side_effect=RuntimeError("backup unavailable")), \
                 patch.object(deploy, "run") as command:
                with self.assertRaisesRegex(RuntimeError, "backup unavailable"):
                    deploy.deploy()
                command.assert_not_called()
                self.assertEqual((root / "current.jar").resolve(), current)
                self.assertEqual(state.read_text(), "a" * 40)


if __name__ == "__main__":
    unittest.main()
