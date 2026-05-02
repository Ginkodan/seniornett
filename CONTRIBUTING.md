# Contributing to SeniorNett

Thanks for helping improve SeniorNett. This project is a Next.js app focused on calm, high-contrast interfaces for senior users, so contributions should keep accessibility, readability, and reliability front and center.

## Before You Start

- Read [README.md](README.md) for the current local setup and service overview.
- Check for existing issues, TODOs, or active work before starting a larger change.
- Keep changes focused. Small, reviewable pull requests are much easier to merge safely.

## Local Setup

### Full stack with Docker

```bash
docker compose up
```

This starts the app, Postgres, identity API, nginx device proxy, and Garage object storage.

### App only

```bash
npm install
npm run dev
```

The local app runs on `http://localhost:5176`.

## Development Guidelines

- Prioritize accessibility. Favor strong contrast, clear hierarchy, keyboard support, and large touch targets.
- Preserve the existing visual language unless the change intentionally updates the design.
- Keep components and helpers narrowly scoped. If a file starts doing multiple jobs, split it.
- Avoid unrelated refactors in the same pull request.
- Update docs when behavior, setup, or contributor workflow changes.

## Checks

Run the relevant checks before opening a pull request:

```bash
npm run lint
npm run build
```

For UI-heavy changes, run the visual audit too:

```bash
npm run visual:install
npm run visual:audit
npm run visual:report
```

## Pull Requests

- Describe what changed, why it changed, and any tradeoffs or follow-up work.
- Include screenshots or visual audit output for UI changes when helpful.
- Note any changes to seeded data, Docker services, ports, or local setup steps.
- Mention testing performed and anything you were not able to verify locally.

## Commit Style

- Use clear, descriptive commit messages.
- Keep commits scoped to a single concern when practical.

## Reporting Bugs

When filing a bug, include:

- what you expected to happen
- what actually happened
- steps to reproduce
- screenshots or recordings if the issue is visual
- local environment details if the issue depends on Docker, ports, or browser behavior

## Questions

If a change has unclear product or design implications, raise that early in the pull request so we can align before the implementation gets too large.
