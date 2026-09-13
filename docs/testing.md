# Verification

Production release `7af3dfc63a89deea60372e4a380067c055ca6028` is deployed and verified at https://myplan.oxytumzone.com as of 2026-09-08. Later source commits record CI configuration and this handover; the deployed image remains tagged with the tested application revision.

| Check                           | Latest observed result                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| Backend unit tests              | 28 passed                                                            |
| PostgreSQL integration tests    | 11 passed; generated fixtures removed                                |
| Python operational safety tests | 7 passed                                                             |
| Terraform validation            | Passed locally with Docker provider 4.6.0                            |
| Production dependency audit     | 0 reported vulnerabilities                                           |
| Full production build           | Passed; optimized build and TypeScript                               |
| Browser E2E                     | 14 local; 14 live HTTPS tests passed in 7.7 minutes                  |
| Production smoke                | Health, database readiness, login: all HTTP 200                      |
| Jenkins pipeline                | Build #5 succeeded, resuming deployment after #4's successful checks |

Integration tests exercise login/origin checks, rate limits, expiry/revocation, first-password restrictions, data ownership, hierarchy cycles, concurrent recurring task completion, habit upserts, decimal precision, and PATCH field preservation. They create generated `qa-integration` identities and clean up only their own IDs/digests.

Browser tests require `RUN_E2E_TESTS=true`, the matching database, a running application, and `E2E_BASE_URL` (default `http://127.0.0.1:3017`). They use generated disposable accounts and never change the owner's password or records. `.e2e`, screenshots, and reports are ignored because they may contain test session information. Production verification uses the same suite against the real HTTPS address and removes its fixtures afterward.

No destructive database reset is used. A separate `life_planning_ci` database is available for Jenkins. Production application deployment is gated on successful build, migration, and readiness, with UI workflows checked on the live release afterward.

The initial live browser suite ran against release `83ebc8e56af80530a5ae5764b83f683d5eceef46` on 2026-09-08. All 14 navigation routes were checked at 1440×1000, 820×1180, and 390×844, with no horizontal overflow or recorded browser errors. Desktop dashboard, tablet insights, and mobile finance screenshots were visually reviewed. The review corrected the habit chart's denominator label to “Recent target completion” in the follow-up release.

CI exposed a pooled-connection migration advisory-lock timeout. Migration and backup clients now use Neon's direct connection, while application traffic stays pooled. Two consecutive migration checks passed afterward, with no remaining migration advisory lock. Unit tests cover provider-specific URL routing and TLS preservation. Only the previously identified idle migration connections in this project's databases were closed; no database reset or unrelated session termination was used.

Jenkins build #4 passed formatting, lint, TypeScript, 28 unit tests, 11 database tests, 7 Python tests, Terraform validation, dependency audit, the production build, and 14 browser tests in 2.6 minutes. Its remote build stopped because Windows could not encode Unicode console output. UTF-8 output was configured and committed. Build #5 resumed only the remote release stage for the same verified SHA and finished successfully: both images built, migrations had no pending changes, Terraform replaced only this project's app container, and all three production smoke endpoints returned 200. GitHub Actions independently passed for the application and subsequent CI correction.

The responsive navigation test also passed against the final deployed image: 1 passed in 34.4 seconds, checking all 14 routes at all three viewport sizes. A transient connection timeout during its first fixture setup was resolved by rerunning with the production verification environment; the completed Playwright report contains no failed, flaky, or skipped tests. The owner's updated login was verified with Secure, HttpOnly, SameSite=Lax session cookies, then that verification session was logged out. The owner has already completed the initial password change. All disposable test accounts were removed.

Final server checks found the app healthy with zero restarts and no application error entries in its logs. All 20 pre-existing containers retained their original IDs and remained running; all configured health checks were healthy. Nginx, Docker, PostgreSQL, and MariaDB remained active. The project cron jobs and certificate renewal hook are installed, and backup/restore evidence is recorded in `backup-recovery.md`.

See `docs/DEVSECOPS_SRE_ROADMAP.md` for the staged DevSecOps/SRE/Kubernetes maturity plan and activation boundaries.
