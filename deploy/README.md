# Self-hosted deployment

Use a Linux host with Docker Engine and the Docker Compose plugin. Point your domain to the server and allow inbound TCP 80/443 before starting Caddy. Complete any hosting-provider prerequisites for serving your domain.

## Configure

From the repository root:

```sh
cp deploy/env.example deploy/.env
chmod 600 deploy/.env
```

Edit the copied file:

```dotenv
DOMAIN=your-domain.example
TLS_EMAIL=you@example.com
```

Use your own domain and email. Keep `deploy/.env` private; it is ignored by Git.

## Build and start

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail=100 app
```

Caddy requests HTTPS certificates when the domain resolves correctly and validation can reach the server. Application storage lives in the `app_data` volume; certificate state uses separate persistent Caddy volumes.

Check `https://YOUR_DOMAIN/api/health` and open the creation workspace. The app container exposes port 3000 internally, while Caddy publishes ports 80/443.

## Update

```sh
git pull --ff-only
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
```

Preserve the environment file and data volumes. Do not use `docker compose down -v` unless you intend to remove persistent data.

## Backups

The repository includes `deploy/backup.sh` and `deploy/restore-empty-volume.sh`. Read their usage and prerequisites before running them. Keep server backups outside the public repository. Browser-local editing drafts belong to each browser and are separate from server backups.

## Optional Ubuntu bootstrap

`deploy/bootstrap-ubuntu.sh` can prepare Docker and a fresh private environment file on a supported Ubuntu host. Read the script first: it performs system-level installation. It starts the application internally; run the complete Compose command above when you are ready to enable public HTTPS.
