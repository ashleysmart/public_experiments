#!/usr/bin/env python3

from __future__ import annotations

import os

from pages_common import require_env, run_wrangler_pages


def main() -> None:
    project_name = require_env("CF_PAGES_PROJECT_NAME")
    production_branch = os.environ.get("CF_PAGES_PRODUCTION_BRANCH", "main")

    run_wrangler_pages(
        "project",
        "create",
        project_name,
        "--production-branch",
        production_branch,
    )


if __name__ == "__main__":
    main()
