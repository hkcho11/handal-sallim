#!/usr/bin/env python3
"""Root-owned OCI pull deployment. No inbound CI SSH or GitHub token required."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import zipfile
from zoneinfo import ZoneInfo

REPO = "hkcho11/handal-sallim"
API = f"https://api.github.com/repos/{REPO}"
DOWNLOAD = f"https://github.com/{REPO}/releases/download/backend-nightly/"
ROOT = Path("/opt/handalsallim")
STATE = Path("/etc/handalsallim/deployed-tree")
BACKUPS = Path("/var/backups/handalsallim")
PG = Path("/usr/lib/postgresql/18/bin")


def read_json(url, timeout=30):
    with urlopen(Request(url, headers={"User-Agent": "handalsallim-nightly", "Cache-Control": "no-cache"}), timeout=timeout) as response:
        return json.load(response)


def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, **kwargs)
    if result.returncode:
        # Do not print process output: database errors may contain user records.
        raise RuntimeError(f"{Path(args[0]).name} failed; sensitive output withheld")
    return result


def migration_files(jar):
    with zipfile.ZipFile(jar) as archive:
        return {n.rsplit("/", 1)[-1]: archive.read(n).replace(b"\r\n", b"\n").replace(b"\r", b"\n") for n in archive.namelist()
                if n.startswith("BOOT-INF/classes/db/migration/") and n.endswith(".sql")}


def validate_migrations(current, candidate):
    if any(name not in candidate or candidate[name] != sql for name, sql in current.items()):
        raise RuntimeError("Previously deployed migration changed or disappeared")
    added = {name: sql for name, sql in candidate.items() if name not in current}
    # Conservative gate. Destructive/data-rewriting migrations require a manual release.
    for sql in added.values():
        plain = re.sub(r"/\*.*?\*/|--[^\n]*", "", sql.decode("utf-8"), flags=re.S)
        if re.search(r"\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME|EXECUTE|CALL|DO)\b", plain, re.I):
            raise RuntimeError("Migration requires a reviewed manual data-change release")
    return bool(added)


def backup():
    BACKUPS.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(BACKUPS, 0o700)
    if shutil.disk_usage(BACKUPS).free < 1024 ** 3:
        raise RuntimeError("Less than 1 GiB free; deployment stopped before database backup")
    values = {key: json.loads(value) for key, value in
              (line.split("=", 1) for line in Path("/etc/handalsallim/api.env").read_text().splitlines() if "=" in line)}
    url = urlsplit(values["DB_URL"].removeprefix("jdbc:"))
    env = os.environ.copy()
    env.update(PGHOST=url.hostname, PGPORT=str(url.port or 5432), PGDATABASE=url.path.lstrip("/"),
               PGUSER=values["DB_USER"], PGPASSWORD=values["DB_PASSWORD"], PGSSLMODE="verify-full",
               PGSSLROOTCERT="/etc/ssl/certs/ca-certificates.crt", PGCHANNELBINDING="require")
    path = BACKUPS / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".dump")
    run([str(PG / "pg_dump"), "--no-password", "--format=custom", "--file", str(path)], env=env, timeout=300)
    os.chmod(path, 0o600)
    run([str(PG / "pg_restore"), "--list", str(path)], timeout=60)
    return path


def healthy():
    try:
        return read_json("http://127.0.0.1:8081/api/auth/health", timeout=2).get("status") == "UP"
    except Exception:
        return False


def wait_healthy():
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        if healthy():
            return True
        time.sleep(3)
    return False


def switch_to(target):
    temporary = ROOT / "next.jar"
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    temporary.replace(ROOT / "current.jar")


def in_window():
    return datetime.now(ZoneInfo("Asia/Seoul")).hour == 4


def deploy(dry_run=False):
    if not dry_run and not in_window():
        raise RuntimeError("Deployment only runs during the 04:00 KST maintenance hour")
    candidate = read_json(DOWNLOAD + "candidate.json")
    for key in ("source_sha", "backend_tree"):
        if not re.fullmatch(r"[0-9a-f]{40}", candidate[key]):
            raise RuntimeError("Invalid candidate identity")
    if STATE.read_text().strip() == candidate["backend_tree"] and not dry_run:
        print("No backend changes; no restart.")
        return
    runs = read_json(API + "/actions/runs?event=push&status=success&head_sha=" + candidate["source_sha"])
    if not any(r["head_sha"] == candidate["source_sha"] and r["head_branch"] == "main"
               and r["path"] == ".github/workflows/ci.yml" and r["conclusion"] == "success"
               for r in runs.get("workflow_runs", [])):
        raise RuntimeError("Candidate has no successful main CI run")
    previous = (ROOT / "current.jar").resolve(strict=True)
    with tempfile.TemporaryDirectory(dir=ROOT / "releases") as folder:
        jar = Path(folder) / "api.jar"
        with urlopen(DOWNLOAD + "api.jar", timeout=120) as source, jar.open("wb") as output:
            shutil.copyfileobj(source, output)
        if hashlib.sha256(jar.read_bytes()).hexdigest() != candidate["jar_sha256"]:
            raise RuntimeError("Candidate checksum mismatch; nothing restarted")
        files = migration_files(jar)
        if {n: hashlib.sha256(sql).hexdigest() for n, sql in files.items()} != candidate["migrations"]:
            raise RuntimeError("Candidate migration manifest mismatch")
        changed = validate_migrations(migration_files(previous), files)
        if dry_run:
            print("Candidate verified; dry run performed no backup, switch or restart.")
            return
        if not healthy():
            raise RuntimeError("Existing API unhealthy; deployment stopped")
        backup()
        target = ROOT / "releases" / (candidate["source_sha"] + ".jar")
        shutil.copyfile(jar, target)
        os.chmod(target, 0o644)
        switch_to(target)
        try:
            run(["systemctl", "restart", "handalsallim-api"], timeout=60)
            if not wait_healthy():
                raise RuntimeError("New API failed readiness check")
        except Exception:
            if changed:
                run(["systemctl", "stop", "handalsallim-api"], timeout=60)
                raise RuntimeError("Migration may have applied; stopped API for manual recovery, no automatic database undo")
            switch_to(previous)
            run(["systemctl", "restart", "handalsallim-api"], timeout=60)
            if not wait_healthy():
                raise RuntimeError("Previous API also failed readiness; manual recovery required")
            raise RuntimeError("Previous API restored after failed deployment")
        temporary = STATE.with_suffix(".tmp")
        temporary.write_text(candidate["backend_tree"] + "\n")
        os.chmod(temporary, 0o600)
        temporary.replace(STATE)
        print("Deployment healthy; backend version recorded.")


if __name__ == "__main__":
    import fcntl
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--backup-only", action="store_true")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit("Run as root on the deployment server")
    os.umask(0o077)
    try:
        with open("/run/handalsallim-deploy.lock", "w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if args.backup_only:
                backup()
                print("Root-only database archive created and archive index verified.")
            else:
                deploy(args.dry_run)
    except Exception as error:
        # Only controlled messages above are safe; suppress external exception details.
        print(str(error) if isinstance(error, RuntimeError) else "Deployment check failed; inspect configuration without printing secrets.", file=sys.stderr)
        raise SystemExit(1)
