#!/usr/bin/env python3

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPT_DIR.parent
REPO_DIR = APP_DIR.parent


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        raise SystemExit(1)
    return value


def git_value(*args: str) -> str:
    try:
        inside_worktree = subprocess.run(
            ["git", "-C", str(REPO_DIR), "rev-parse", "--is-inside-work-tree"],
            check=True,
            capture_output=True,
            text=True,
        )
        if inside_worktree.stdout.strip() != "true":
            return ""
    except subprocess.CalledProcessError:
        return ""

    try:
        result = subprocess.run(
            ["git", "-C", str(REPO_DIR), *args],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def run_wrangler_pages(*args: str) -> None:
    subprocess.run(
        ["npx", "--yes", "wrangler@latest", "pages", *args],
        check=True,
        cwd=APP_DIR,
    )
