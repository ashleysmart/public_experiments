# Cloudflare Pages Direct Upload Scripts

These scripts deploy the `dice_app` folder directly to Cloudflare Pages using Wrangler.

## Required Environment Variables

- `CF_PAGES_PROJECT_NAME`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Optional Environment Variables

- `CF_PAGES_PRODUCTION_BRANCH`
  - defaults to `main`
- `CF_PAGES_DEPLOY_BRANCH`
  - defaults to `CF_PAGES_PRODUCTION_BRANCH` for `pages-deploy.sh`
  - defaults to `preview` for `pages-deploy-preview.sh`
- `CF_PAGES_COMMIT_HASH`
- `CF_PAGES_COMMIT_MESSAGE`

## Create the Pages Project

```bash
export CF_PAGES_PROJECT_NAME=dice-forge
export CF_PAGES_PRODUCTION_BRANCH=main

python3 ./scripts/pages_create.py
```

## Deploy Production

```bash
export CF_PAGES_PROJECT_NAME=dice-forge
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export CLOUDFLARE_API_TOKEN=your-pages-api-token
export CF_PAGES_DEPLOY_BRANCH=main

python3 ./scripts/pages_deploy.py
```

## Deploy Preview

```bash
export CF_PAGES_PROJECT_NAME=dice-forge
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export CLOUDFLARE_API_TOKEN=your-pages-api-token

python3 ./scripts/pages_deploy_preview.py
```
