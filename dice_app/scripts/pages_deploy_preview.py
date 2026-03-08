#!/usr/bin/env python3

from __future__ import annotations

import os

from pages_deploy import main as deploy_main


def main() -> None:
    os.environ.setdefault("CF_PAGES_DEPLOY_BRANCH", "preview")
    deploy_main()


if __name__ == "__main__":
    main()
