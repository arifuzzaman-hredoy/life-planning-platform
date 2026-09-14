# Kubernetes deployment contract

The base resources in this directory define the long-running Life Planning
application. Database migrations are intentionally separated from the
application Deployment.

## Immutable images

Application releases use:

`ghcr.io/arifuzzaman-hredoy/life-planning-platform:sha-<40-character-git-sha>`

The Kubernetes migration contract uses:

`ghcr.io/arifuzzaman-hredoy/life-planning-platform-migrator:sha-<40-character-git-sha>`

The application and migrator must be built from the same Git revision.

## Secret contract

A Secret named `life-planning-secrets` must already exist in the
`life-planning` namespace.

It must contain the key:

`app.env`

The file is mounted read-only at:

`/run/secrets/app.env`

Secret values are never committed to this repository.

## Migration ordering

The migration Job is deliberately kept in `infra/kubernetes/migration` and is
not part of the long-running application `kustomization.yaml`.

Release orchestration must:

1. Verify the exact immutable application and migrator images.
2. Replace `replace-with-immutable-sha` with the same 40-character Git SHA.
3. Run the migration Job.
4. Wait for the Job to complete successfully.
5. Only then roll out the application Deployment.

A failed migration blocks application rollout.

The migrator uses the same hardened migration command as the existing
production release path:

`node --env-file=/run/secrets/app.env node_modules/prisma/build/index.js migrate deploy`

## Important

The migrator GHCR image must be published, scanned, signed and attested before
this migration manifest is used against a real Kubernetes cluster.
## Immutable release image contract

Kubernetes and Helm releases must use the immutable Git SHA image tags produced by the signed release workflow.

- Application: `ghcr.io/arifuzzaman-hredoy/life-planning-platform:sha-<SHA>`
- Migrator: `ghcr.io/arifuzzaman-hredoy/life-planning-platform-migrator:sha-<SHA>`

Run the migration job with the matching migrator SHA before rolling out the application image for that release.
