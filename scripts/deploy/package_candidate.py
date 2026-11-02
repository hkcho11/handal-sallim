"""Package public, secret-free CI build metadata for the OCI pull deployment."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile


def migrations(jar):
    with zipfile.ZipFile(jar) as archive:
        return {
            name.rsplit("/", 1)[-1]: hashlib.sha256(archive.read(name).replace(b"\r\n", b"\n").replace(b"\r", b"\n")).hexdigest()
            for name in archive.namelist()
            if name.startswith("BOOT-INF/classes/db/migration/") and name.endswith(".sql")
        }


if __name__ == "__main__":
    jar, sha, output = sys.argv[1:]
    tree = subprocess.check_output(["git", "rev-parse", f"{sha}:apps/api"], text=True).strip()
    Path(output).write_text(json.dumps({
        "source_sha": sha,
        "backend_tree": tree,
        "jar_sha256": hashlib.sha256(Path(jar).read_bytes()).hexdigest(),
        "migrations": migrations(jar),
    }, indent=2) + "\n", encoding="utf-8")
