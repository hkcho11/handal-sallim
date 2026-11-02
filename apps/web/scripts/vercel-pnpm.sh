#!/bin/sh
set -eu

# Let pnpm manage the pinned runtime before npm inspects this app's devEngines.
project_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
bootstrap_dir="$(mktemp -d)"
trap 'rmdir "$bootstrap_dir" 2>/dev/null || true' EXIT
cd "$bootstrap_dir"
npx --yes pnpm@12.10.1 --dir "$project_dir" "$@"
