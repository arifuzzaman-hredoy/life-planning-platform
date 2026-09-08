# Security

- Passwords use Node.js scrypt with independent random salts and constant-time verification.
- Seven-day sessions use random opaque tokens, HMAC digests, database expiry, and revocation. Production cookies are Secure, HttpOnly, SameSite=Lax, and path-scoped.
- Mutation routes enforce the exact `APP_URL` origin and JSON content type. Body size is bounded even for streamed requests.
- Login failures are persisted with keyed email/IP digests for throttling. The reverse proxy replaces forwarding headers with the actual client address.
- Every data access is owner-scoped. Relationships are checked for kind, ownership, and cycles; concurrent changes are tested. Prisma parameterizes database queries.
- React escapes text. User links accept HTTP/HTTPS only. The application does not fetch user-provided URLs, execute commands from user fields, or accept uploaded files.
- Production responses include CSP, frame denial, MIME sniffing protection, referrer policy, and permissions policy. Inline scripts/styles remain allowed for Next hydration and dynamic progress styling; arbitrary eval is enabled only during development.
- PostgreSQL connections verify TLS certificates and hostnames. Production URLs/secrets are held in a restricted bind-mounted file, excluded from image layers, source, and Terraform state. Bootstrap credentials are not deployed in the runtime environment.
- Runtime containers use UID/GID1001, a read-only root, bounded writable temporary paths, dropped capabilities, no-new-privileges, memory/CPU limits, and bounded JSON logs.
- Error logs contain sanitized event/type information, not SQL values, request bodies, passwords, or stack traces sent to clients.

## Maintenance

Keep the account private. Use a unique password and store it in a password manager. Review dependency advisories regularly and rebuild immutable images after updates. Keep SSH host keys pinned. Jenkins is loopback-only with authentication; protect its home directory because it contains encrypted credentials and their decryption material.

Password recovery is an operator procedure; no unauthenticated reset endpoint exists. Before changing an account credential, verify the requester, write a fresh hash using the same password helper, revoke that user's sessions, and require a password change. Never edit another user's data to recover access.

This repository does not claim a third-party penetration test or formal compliance certification. The automated checks and observed release results are documented in testing.md.
