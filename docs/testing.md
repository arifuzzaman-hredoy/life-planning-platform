# Verification

Checks are recorded from actual command execution. Release verification is still in progress until the final production result is added here.

| Check                           | Latest observed result                              |
| ------------------------------- | --------------------------------------------------- |
| Backend unit tests              | 28 passed                                           |
| PostgreSQL integration tests    | 11 passed; generated fixtures removed               |
| Python operational safety tests | 7 passed                                            |
| Terraform validation            | Passed locally with Docker provider 4.6.0           |
| Production dependency audit     | 0 reported vulnerabilities                          |
| Full production build           | Passed; optimized build and TypeScript              |
| Browser E2E                     | 14 local; 14 live HTTPS tests passed in 7.7 minutes |
| Production smoke                | Health, database readiness, login: all HTTP 200     |
| Jenkins pipeline                | Final run pending after verified migration fix      |

Integration tests exercise login/origin checks, rate limits, expiry/revocation, first-password restrictions, data ownership, hierarchy cycles, concurrent recurring task completion, habit upserts, decimal precision, and PATCH field preservation. They create generated `qa-integration` identities and clean up only their own IDs/digests.

Browser tests require `RUN_E2E_TESTS=true`, the matching database, a running application, and `E2E_BASE_URL` (default `http://127.0.0.1:3017`). They use generated disposable accounts and never change the owner's password or records. `.e2e`, screenshots, and reports are ignored because they may contain test session information. Production verification uses the same suite against the real HTTPS address and removes its fixtures afterward.

No destructive database reset is used. A separate `life_planning_ci` database is available for Jenkins. Production application deployment is gated on successful build, migration, and readiness, with UI workflows checked on the live release afterward.

The initial live browser suite ran against release `83ebc8e56af80530a5ae5764b83f683d5eceef46` on 2026-09-08. All 14 navigation routes were checked at 1440×1000, 820×1180, and 390×844, with no horizontal overflow or recorded browser errors. Desktop dashboard, tablet insights, and mobile finance screenshots were visually reviewed. The review corrected the habit chart's denominator label to “Recent target completion” in the follow-up release.

CI exposed a pooled-connection migration advisory-lock timeout. Migration and backup clients now use Neon's direct connection, while application traffic stays pooled. Two consecutive migration checks passed afterward, with no remaining migration advisory lock. Unit tests cover provider-specific URL routing and TLS preservation. Only the previously identified idle migration connections in this project's databases were closed; no database reset or unrelated session termination was used.
