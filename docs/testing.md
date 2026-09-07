# Verification

Checks are recorded from actual command execution. Release verification is still in progress until the final production result is added here.

| Check                           | Latest observed result                             |
| ------------------------------- | -------------------------------------------------- |
| Backend unit tests              | 26 passed                                          |
| PostgreSQL integration tests    | 11 passed; generated fixtures removed              |
| Python operational safety tests | 6 passed                                           |
| Terraform validation            | Passed locally with Docker provider 4.6.0          |
| Production dependency audit     | 0 reported vulnerabilities                         |
| Full production build           | Passed; optimized build and TypeScript             |
| Browser E2E                     | 14 passed in 2.4 minutes on local production build |
| Production smoke                | Pending deployment                                 |
| Jenkins pipeline                | Configured locally; execution pending              |

Integration tests exercise login/origin checks, rate limits, expiry/revocation, first-password restrictions, data ownership, hierarchy cycles, concurrent recurring task completion, habit upserts, decimal precision, and PATCH field preservation. They create generated `qa-integration` identities and clean up only their own IDs/digests.

Browser tests require `RUN_E2E_TESTS=true`, the matching database, a running application, and `E2E_BASE_URL` (default `http://127.0.0.1:3017`). They use generated disposable accounts and never change the owner's password or records. `.e2e`, screenshots, and reports are ignored because they may contain test session information. Production verification uses the same suite against the real HTTPS address and removes its fixtures afterward.

No destructive database reset is used. A separate `life_planning_ci` database is available for Jenkins. Production application deployment is gated on successful build, migration, and readiness, with UI workflows checked on the live release afterward.
