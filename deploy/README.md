# Deploying TreeVook AI to a single Ubuntu server

Everything runs from `deploy/docker-compose.yml` on one VPS:

| Service    | What it is                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| `caddy`    | Public entry point on ports 80/443, automatic HTTPS from Let's Encrypt     |
| `web`      | Next.js app (`web/Dockerfile`, standalone output) on `web:3000`            |
| `api`      | NestJS API (`backend/Dockerfile`, `node dist/main.js`) on `api:4000`       |
| `worker`   | BullMQ worker, same image as `api`, runs `node dist/worker.js`             |
| `postgres` | PostgreSQL 17, data in the `postgres` volume                               |
| `redis`    | Redis 7 with AOF persistence, data in the `redis` volume                   |

Caddy sends `/api/*`, `/mcp`, `/media/*`, `/.well-known/*`, `/oauth/token`, `/oauth/register` and `/oauth/revoke` straight to the API and everything else to the web app. The web app works out the product from the subdomain itself (`web/src/proxy.ts`, `web/src/lib/products.ts`).

Volumes: `postgres`, `redis`, `media` (uploaded creatives, the API's `MEDIA_DIR`), `caddy_data` (certificates) and `caddy_config`.

Recommended size: 2 vCPU, 4 GB RAM, 40 GB disk. Building the web image needs about 2 GB of free memory, so add swap on smaller machines.

## Backend only (Oracle Cloud), web app elsewhere

The current plan:
- **Server:** the API, worker, Postgres and Redis run on an Oracle Cloud Always Free ARM server in India West (Mumbai): `VM.Standard.A1.Flex`, 4 OCPU, 24 GB, Ubuntu 24.04.
- **Domain:** Caddy serves them on `api.treevook.com`.
- **Web app:** runs on Vercel with `BACKEND_URL=https://api.treevook.com`. Its rewrites forward `/api`, `/mcp`, `/media`, `/.well-known` and the OAuth paths, so browsers only ever talk to the web origin.

In `.env`:
- set `CADDYFILE=Caddyfile.api`;
- leave `COMPOSE_PROFILES` empty, so `docker compose up -d` starts only `postgres`, `redis`, `api`, `worker` and `caddy`.

DNS: one `A` record, `api` → the server's public IP, at GoDaddy.

On Oracle's Ubuntu images, ports 80 and 443 must be opened twice:
- in the subnet's security list;
- on the host itself:

```bash
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

To run everything on one server instead, set `CADDYFILE=Caddyfile` and `COMPOSE_PROFILES=web`.

## 1. DNS

Create these `A` records pointing at the server's public IPv4 address (add matching `AAAA` records if the server has IPv6):

| Host             | Type | Value     |
| ---------------- | ---- | --------- |
| `@`              | A    | server IP |
| `www`            | A    | server IP |
| `googlebusiness` | A    | server IP |
| `playreview`     | A    | server IP |
| `instagram`      | A    | server IP |
| `facebook`       | A    | server IP |
| `ads`            | A    | server IP |

Wait until `dig +short treevook.com` (and each subdomain) returns the server IP before the first start, otherwise Caddy cannot get certificates.

## 2. Prepare the server

```bash
sudo apt-get update && sudo apt-get -y upgrade
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker compose version

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

Optional swap for a 2 GB machine:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Get the code

```bash
sudo mkdir -p /opt/treevook && sudo chown "$USER" /opt/treevook
git clone <your-repo-url> /opt/treevook
cd /opt/treevook/deploy
```

## 4. Configure the environment

```bash
cp .env.production.example .env
chmod 600 .env
```

Generate the secrets and paste them into `.env`:

```bash
openssl rand -hex 24
openssl rand -base64 48
openssl rand -base64 32
```

| Variable               | Value                                                       |
| ---------------------- | ----------------------------------------------------------- |
| `POSTGRES_PASSWORD`    | output of `openssl rand -hex 24` (hex keeps the URL valid)  |
| `JWT_ACCESS_SECRET`    | output of `openssl rand -base64 48` (at least 32 chars)     |
| `TOKEN_ENCRYPTION_KEY` | output of `openssl rand -base64 32` (exactly 32 bytes)      |
| `ACME_EMAIL`           | your email for Let's Encrypt expiry notices                 |

`TOKEN_ENCRYPTION_KEY` encrypts stored Google, Play and Meta tokens. Back it up somewhere safe; if it is lost or changed every connected account has to be reconnected.

What each variable does:

| Variable                                   | Notes                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `DOMAIN`, `ACME_EMAIL`                     | Used by Caddy for hostnames and certificates                                                                              |
| `IMAGE_TAG`                                | Tag for the locally built images, used for rollback                                                                       |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database credentials                                                                                              |
| `DATABASE_URL`                             | Leave blank to use the bundled Postgres. Set it only for an external database                                            |
| `REDIS_URL`                                | `redis://redis:6379` for the bundled Redis                                                                                |
| `MEDIA_DIR`                                | Always `/app/storage/media` inside the container (the `media` volume)                                                     |
| `APP_URL`                                  | `https://treevook.com`. Public base URL for links, media URLs and OAuth redirects                                         |
| `ROOT_URL`                                 | `https://treevook.com`. Where product subdomains send paths of other products. Baked into the web image at build time   |
| `BACKEND_URL`                              | `http://api:4000`. Baked into the web image at build time for its `/api` rewrites                                        |
| `COOKIE_DOMAIN`                            | `.treevook.com` so one sign-in works on every subdomain                                                                   |
| `WEB_ORIGINS`                              | Comma separated list of every origin the browser uses: apex, www and each product subdomain                              |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client for sign-in and Google Business                                                                       |
| `ANTHROPIC_API_KEY`                        | Needed for AI drafts unless `AI_MOCK=true`                                                                                |
| `AI_DAILY_DRAFTS`                          | Per-day AI draft limit                                                                                                    |
| `META_GRAPH_VERSION`, `ADS_MAX_DAILY_BUDGET` | Meta Graph API version and the hard cap on daily ad budget                                                              |
| `OTP_TEST_NUMBERS`                         | Keep empty in production                                                                                                  |
| `AUTH_GOOGLE_MOCK_EMAIL`                   | Only used when `AUTH_GOOGLE_MOCK=true`                                                                                    |
| `SENTRY_DSN`, `LOG_LEVEL`                  | Error reporting and log verbosity                                                                                         |
| `*_MOCK`                                   | See the checklist below                                                                                                   |

If you use a different domain, change `DOMAIN`, `APP_URL`, `ROOT_URL`, `COOKIE_DOMAIN` and `WEB_ORIGINS` together.

## 5. Build, migrate, start

```bash
cd /opt/treevook/deploy
export IMAGE_TAG=$(git rev-parse --short HEAD)
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$IMAGE_TAG/" .env

docker compose build
docker compose up -d postgres redis
docker compose run --rm api node dist/shared/database/migrate.js
docker compose up -d
docker compose ps
```

The migration command uses only production dependencies and the SQL files in `backend/drizzle`, which are baked into the image.

Smoke test:

```bash
curl -fsS https://treevook.com/privacy -o /dev/null && echo web ok
curl -sS https://treevook.com/api/v1/me -o /dev/null -w '%{http_code}\n'
docker compose exec api node -e "fetch('http://127.0.0.1:4000/health').then(r=>r.text()).then(console.log)"
```

The second call should print `401`, which proves Caddy reaches the API.

## 6. Logs and status

```bash
docker compose ps
docker compose logs -f api worker
docker compose logs -f --tail=200 web
docker compose logs caddy
```

Logs are JSON (pino). `docker compose logs api | npx pino-pretty` makes them readable if Node is installed on the host.

## 7. Update and redeploy

```bash
cd /opt/treevook
git pull
cd deploy
export IMAGE_TAG=$(git rev-parse --short HEAD)
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$IMAGE_TAG/" .env
docker compose build
docker compose run --rm api node dist/shared/database/migrate.js
docker compose up -d
docker image prune -f
```

Take a backup (section 8) before any release that contains new migrations.

## 8. Backups

Database, nightly at 03:00, keeping 14 days:

```bash
mkdir -p /opt/treevook/backups
crontab -e
```

```cron
0 3 * * * cd /opt/treevook/deploy && docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > /opt/treevook/backups/db-$(date +\%F).dump && find /opt/treevook/backups -name 'db-*.dump' -mtime +14 -delete
30 3 * * * docker run --rm -v treevook_media:/media:ro -v /opt/treevook/backups:/backup alpine tar czf /backup/media-$(date +\%F).tgz -C /media . && find /opt/treevook/backups -name 'media-*.tgz' -mtime +14 -delete
```

Copy `/opt/treevook/backups` and `deploy/.env` off the server regularly (for example with `rclone` or `restic`).

Restore a database dump:

```bash
cd /opt/treevook/deploy
docker compose stop api worker web
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < /opt/treevook/backups/db-YYYY-MM-DD.dump
docker compose up -d
```

Restore media:

```bash
docker run --rm -v treevook_media:/media -v /opt/treevook/backups:/backup alpine sh -c 'rm -rf /media/* && tar xzf /backup/media-YYYY-MM-DD.tgz -C /media'
```

## 9. Rollback

Every build is tagged with the commit (`IMAGE_TAG`), and old images stay on the server until pruned.

```bash
cd /opt/treevook/deploy
docker image ls treevook-backend
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<previous-tag>/" .env
docker compose up -d --no-build api worker web
```

Migrations only move forward. If the release you are rolling back from changed the schema in a way the old code cannot read, restore the database backup taken before the release (section 8) as well. If the old image was pruned, `git checkout <previous-commit>` and rebuild.

## Google OAuth redirect URIs

In Google Cloud Console, open the OAuth client used for `GOOGLE_CLIENT_ID` and add these authorised redirect URIs:

```
https://treevook.com/api/v1/auth/google/callback
https://googlebusiness.treevook.com/api/v1/auth/google/callback
https://playreview.treevook.com/api/v1/auth/google/callback
https://instagram.treevook.com/api/v1/auth/google/callback
https://facebook.treevook.com/api/v1/auth/google/callback
https://ads.treevook.com/api/v1/auth/google/callback
https://treevook.com/api/v1/business/oauth/callback
https://googlebusiness.treevook.com/api/v1/business/oauth/callback
https://playreview.treevook.com/api/v1/business/oauth/callback
https://instagram.treevook.com/api/v1/business/oauth/callback
https://facebook.treevook.com/api/v1/business/oauth/callback
https://ads.treevook.com/api/v1/business/oauth/callback
```

Add each host as an authorised JavaScript origin too. The backend only uses an origin that appears in `APP_URL` or `WEB_ORIGINS`, so keep both lists in sync.

## Mock flags checklist

All mocks default to `false` in `.env.production.example`. Leave a flag `true` only while the matching credentials are missing.

- [ ] `AUTH_GOOGLE_MOCK=false` once `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set and the redirect URIs above are added. With it `true`, anyone can sign in as `AUTH_GOOGLE_MOCK_EMAIL`, so never leave it on in public.
- [ ] `GBP_MOCK=false` once the Google client has the Business Profile APIs enabled and approved.
- [ ] `PLAY_MOCK=false` once real Play Console access is configured.
- [ ] `META_MOCK=false` once the Meta app is approved.
- [ ] `AI_MOCK=false` once `ANTHROPIC_API_KEY` is set.
- [ ] `OTP_TEST_NUMBERS` is empty.

After changing `.env`, apply it with `docker compose up -d api worker`. Changes to `ROOT_URL` or `BACKEND_URL` need `docker compose build web && docker compose up -d web`.
