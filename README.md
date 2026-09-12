# Life Planning

A private workspace for goals, tasks, daily plans, habits, learning, career plans, projects, finances, notes, important dates, journals, and insights.

Built with Next.js 16, React 19, TypeScript, Node.js 22, Prisma 7, and PostgreSQL. The interface starts empty: all progress comes from records you create. Asia/Dhaka and BDT are the defaults.

## Start locally

Requirements: Node.js 22.12+ (22 LTS recommended), npm, and PostgreSQL 17+. Python 3.11+ and Terraform are used for operations.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and fill in your own secrets.
3. Run `npm run db:generate` and review the SQL under `prisma/migrations`.
4. Run `npm run db:migrate`.
5. Set `OWNER_EMAIL`, `OWNER_NAME`, and a long random `OWNER_PASSWORD`; run `npm run db:bootstrap` once. Existing accounts are preserved.
6. Run `npm run dev`; open [localhost:3017](http://127.0.0.1:3017).
7. Sign in and change the initial password. Remove bootstrap credentials from runtime configuration.

`APP_URL` must match the exact browser origin, including the port. Public environments require HTTPS. Secrets belong in ignored environment files or Jenkins Credentials, never in Git.

## Daily use

- Create a goal, then add milestones or tasks linked to it. Set priorities, dates, planning periods, and progress.
- Complete recurring tasks to create one next occurrence. Subtasks and linked projects stay connected.
- Use Daily planner for priorities, a schedule, notes, and reflections; save before navigating away.
- Record habit counts for a day; weekly habits aggregate the Monday–Sunday period.
- Store learning resources and study sessions. Use career activity stages for applications, interviews, certifications, and skill gaps.
- Record income, expenses, monthly category budgets, and savings balances. Currencies are summarized separately; no exchange-rate conversion is implied.
- Pin/search/archive notes; record dates and daily, weekly, or monthly journal reflections.
- Insights reflect saved records. Important dates are an in-app planning view; outbound reminder delivery is not configured.
- Settings supports profile preferences, password changes, and a JSON export of your own workspace.

## Verify

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run build
python -m unittest discover -s scripts -p 'test_*.py'
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
```

For database integration tests, explicitly set `RUN_DB_TESTS=true` with a migrated test database. For browser tests, start the app, install Chromium (`npx playwright install chromium`), then set `RUN_E2E_TESTS=true` and run `npm run test:e2e`. Tests create and remove only their own generated fixture identities. See [testing](docs/testing.md).

## Deployment

Production uses an isolated Docker container on the existing VPS, Neon PostgreSQL, and a dedicated Nginx HTTPS virtual host. Terraform manages only this application's Docker network/container. Jenkins runs locally on Windows to preserve VPS memory, with remote Docker builds capped separately. Kubernetes manifests are provided for a future suitable cluster; Kubernetes is not installed on the shared VPS.

- [Architecture](docs/architecture.md)
- [Deployment and Jenkins](docs/deployment.md)
- [Security](docs/security.md)
- [Backup and recovery](docs/backup-recovery.md)
- [Operations](docs/operations.md)
- [Observability](docs/observability.md)
- [Verification results](docs/testing.md)

Live address: [myplan.oxytumzone.com](https://myplan.oxytumzone.com). Deployment verification status is recorded in the documentation after each release.
