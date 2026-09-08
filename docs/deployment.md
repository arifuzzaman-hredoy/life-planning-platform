# Deployment

## Current design

The dedicated release root is `/opt/life-planning`. The application listens on `127.0.0.1:3217`; only Nginx exposes HTTPS. The runtime container uses a 640 MiB memory limit and one CPU. The remote build uses its own BuildKit builder with 2304 MiB memory and 1.5 CPU limits, then stops that builder. It never changes the default Docker builder or prunes images/volumes.

`shared/app.env` contains only runtime secrets and configuration, owned by root:1001 with mode0640. The containing directory is root-only. Terraform receives this file's path, never its contents. State is private under `terraform/`; source-controlled provider checksums cover Linux and Windows.

Runtime queries use Neon's pooled hostname. Prisma CLI operations use the direct hostname so migration advisory locks remain attached to one session; `prisma.config.ts` derives this from Neon URLs or accepts `DIRECT_DATABASE_URL`. Backup/restore clients likewise use the direct Neon host. This follows the [Prisma connection guidance](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections). Do not disable migration locking to work around pooler timeouts.

1. Review/test and commit a clean revision; scan for secrets before pushing.
2. Back up the application's database and deployment state.
3. Build `runner` and `migrator` images, tagged with the full commit SHA.
4. Run `scripts/deploy.py` on the VPS with the release directory and immutable image. It checks that the Terraform plan changes only `docker_network.app` and `docker_container.app`.
5. Apply additive migrations using the dedicated migrator image.
6. Apply the Terraform plan; require application and database readiness. Failed updates attempt rollback to the previous image.
7. Install only `infra/nginx/myplan.oxytumzone.com.conf`, after backing up the previous project vhost. Run `nginx -t` before a graceful reload.
8. Run `python3 scripts/operations.py smoke --url https://myplan.oxytumzone.com` and the live browser suite.

Remote release entry point (run on the trusted operator/CI machine):

```sh
python scripts/remote_release.py --credentials-file /private/ssh.json --known-hosts /private/known_hosts --source . --release FULL_COMMIT_SHA
```

The credential JSON contains `host`, `username`, and `password`; it is never committed. `--deploy` also migrates/applies/checks the release after image creation. First deployment configures the HTTPS proxy only once the local container is ready.

For a new host, start with a dedicated HTTP vhost for this domain: serve `/.well-known/acme-challenge/` from `/var/www/certbot`, and return 503 for all other locations. Check DNS, back up shared Nginx configuration, and validate the new vhost before reloading. Issue the certificate with `certbot certonly --webroot -w /var/www/certbot -d myplan.oxytumzone.com` using the owner's contact email. Once the container passes readiness, replace only this project vhost with the committed HTTPS configuration, test, and gracefully reload. Install `infra/nginx/renew-life-planning.sh` as the project-specific Certbot deploy hook.

## Jenkins

The controller is local to the Windows development machine at `http://127.0.0.1:8089`, with Java21, Jenkins2.568.3, authentication, no anonymous access, and one trusted executor. It runs only when that machine and the Jenkins process are available. It is deliberately not exposed through the VPS.

The `life-planning` job uses the committed Jenkinsfile and a separate checkout under `G:\Current Project\Development\Life Planning CI\workspace`. Temporary build files also use that restricted directory's drive, preserving system-drive space. It reads the local repository's committed main branch; uncommitted edits are never released. The job runs installation, formatting, lint, types, unit tests, Python safety tests, Terraform validation, dependency audit, isolated database integration, production build, and browser workflows. `BUILD_REMOTE=true` adds bounded remote image builds. `DEPLOY=true` additionally deploys that verified revision.

Jenkins Credentials holds `life-planning-ci-env` (separate CI database environment) and `life-planning-ssh` (SSH credential file). Host keys are pinned through `LIFE_PLANNING_KNOWN_HOSTS`. Administrator credentials and launch scripts are saved in the private local operational directory, outside this repository.

GitHub Actions provides a secondary independent Linux check pipeline. It uses an ephemeral PostgreSQL service, not production secrets. Neither CI system has an automatic public webhook installed by this project; Jenkins builds are started explicitly.

## Kubernetes

`infra/kubernetes` contains a namespace, configuration, non-root deployment, service, ingress and network policy. Do not apply them to this shared Docker VPS. On a suitable future cluster, provide the immutable image, an actual ingress class, and a Secret named `life-planning-secrets` with an `app.env` key. Review the policy for the cluster's ingress controller and DNS before applying. No Kubernetes cluster is currently running this application.
