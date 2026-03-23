# Contributing

## Getting started

Follow [README.md](README.md) for Node version, `npm ci`, `.env` from `.env.example`, and how to run the app and tests.

## Branches and pull requests

- Use short-lived branches off `main`.
- Open a PR with a clear description of user-visible or data-layer impact.
- Link related issues when applicable.

## Commits

Prefer [Conventional Commits](https://www.conventionalcommits.org/) style prefixes, for example:

- `feat:` new behaviour
- `fix:` bug fix
- `docs:` documentation only
- `chore:` tooling, config, or maintenance
- `test:` tests only

Write imperative, specific subject lines (avoid vague messages like “fix” or “update” with no scope).

## Before you push

```bash
npm run lint
npm run test:ingest
```

For Playwright smoke tests (`npm run test:e2e`), set `PLAYWRIGHT_SMOKE_EMAIL` and `PLAYWRIGHT_SMOKE_PASSWORD` in `.env` using a disposable test account.

## Secrets

Never commit `.env`, API keys, or the Supabase service role key. Only `.env.example` belongs in Git.

## Database changes

Ship SQL as ordered files under `supabase/migrations/` and document anything that must be run manually in the PR description.
