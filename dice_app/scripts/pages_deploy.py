#!/usr/bin/env python3

from __future__ import annotations

import os

from pages_common import APP_DIR, git_value, require_env, run_wrangler_pages


def main() -> None:
    project_name = require_env("CF_PAGES_PROJECT_NAME")
    require_env("CLOUDFLARE_ACCOUNT_ID")
    require_env("CLOUDFLARE_API_TOKEN")

    deploy_branch = os.environ.get(
        "CF_PAGES_DEPLOY_BRANCH",
        os.environ.get("CF_PAGES_PRODUCTION_BRANCH", "main"),
    )
    commit_hash = os.environ.get("CF_PAGES_COMMIT_HASH") or git_value("rev-parse", "HEAD")
    commit_message = os.environ.get("CF_PAGES_COMMIT_MESSAGE") or git_value(
        "log", "-1", "--pretty=%s"
    )

    args = [
        "deploy",
        str(APP_DIR),
        "--project-name",
        project_name,
        "--branch",
        deploy_branch,
    ]

    if commit_hash:
        args.extend(["--commit-hash", commit_hash])

    if commit_message:
        args.extend(["--commit-message", commit_message])

    run_wrangler_pages(*args)


if __name__ == "__main__":
    main()
