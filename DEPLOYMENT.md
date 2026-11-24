# Deploy MuviLite on one server

[فارسی](DEPLOYMENT_FA.md)

Docker Compose runs the public site, admin panel, API, MongoDB, and Caddy on one Linux server. Caddy serves the two sites over HTTPS on separate hostnames. Each site reaches the API and media through its own `/api/` and `/uploads/` paths. MongoDB and the API have no published ports. MongoDB and media use persistent volumes. The three app images come from [backend](backend/Dockerfile), [frontend](frontend/Dockerfile), and [admin](admin/Dockerfile).

## 1. Prepare the server

- Use a 64-bit Linux server, such as Ubuntu 24.04 LTS. On x86-64, make sure the CPU or VM exposes AVX for MongoDB. For a small installation, start with 2 vCPUs and 4 GB RAM. Plan for 4 or more vCPUs and 8 GB RAM if you expect to transcode video regularly. Leave space for the media library, uploads in progress, and backups.
- Install Docker Engine 28 or newer and the Compose plugin. Check them with `sudo docker version` and `sudo docker compose version`. Install Git and OpenSSL as well. Run the commands below from Bash, with an account that can use Docker. Use [Docker's Ubuntu installation guide](https://docs.docker.com/engine/install/ubuntu/) if needed.
- For public access, point two DNS A records, such as `media.example.com` and `admin.example.com`, at the server's public IPv4 address. Allow inbound TCP 80 and 443 in your provider's firewall and forward them if the server is behind a router. UDP 443 is optional for HTTP/3. Only add AAAA records if you've also configured reachable IPv6 listeners.
- The build needs outbound access to Docker Hub, npm, and the Debian package repositories. Public HTTPS also needs outbound access to the certificate authority.
- Free ports 80 and 443 before starting Compose. If those ports are already in use, decide which service will own public HTTP and HTTPS before continuing.

```bash
git clone https://github.com/AvinanceCo/muvilite.git
cd muvilite
```

## 2. Configure and initialize

Create the root `.env` with restricted permissions. Generate three different secrets and paste one into each empty password or secret field. Keep the hex format for `MONGO_APP_PASSWORD` because Compose inserts it into the MongoDB URI.

```bash
umask 077
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
nano .env
```

| Setting | Purpose |
| --- | --- |
| `MONGO_ROOT_PASSWORD` | MongoDB maintenance account password. |
| `MONGO_APP_PASSWORD` | Password for the API's MongoDB user, scoped to the `muvilite` database. |
| `JWT_SECRET` | Signs admin sessions. Changing it signs users out. |
| `FRONTEND_SITE`, `ADMIN_SITE` | Exact browser origins, including scheme and without a trailing slash. Keep the example values for the first check. |
| `BIND_ADDRESS` | Keep `127.0.0.1` for the first check. |
| `ENABLE_CRON`, `WATCH_TREND_CRON` | Nightly watch-trend aggregation, scheduled in UTC. |

MongoDB creates its users the first time it initializes an empty data volume. On an existing installation, rotate passwords in MongoDB before updating `.env`.

Build the three images and start MongoDB. Initialize the application once using a new administrator mobile number and strong password. Enter both prompts before the seed command. The password prompt is hidden.

```bash
docker compose config --quiet
docker compose build --pull
docker compose up -d --wait mongo

read -rp 'Administrator mobile: ' SEED_ADMIN_MOBILE
read -rsp 'Administrator password: ' SEED_ADMIN_PASSWORD
printf '\n'
if [ -n "$SEED_ADMIN_MOBILE" ] && [ -n "$SEED_ADMIN_PASSWORD" ]; then
  export SEED_ADMIN_MOBILE SEED_ADMIN_PASSWORD
  docker compose run --rm -T -e SEED_ADMIN_MOBILE -e SEED_ADMIN_PASSWORD backend npm run seed
else
  printf 'Enter both values before seeding.\n' >&2
fi
unset SEED_ADMIN_MOBILE SEED_ADMIN_PASSWORD
```

Wait for `Seed complete`. Seeding also creates reference data, including sample poll questions and starter pages. An existing administrator's password is preserved.

## 3. Verify locally and publish

Start the stack and run these checks on the server. The sample addresses are for local HTTP verification. For this step use Docker Engine 28 or newer, which keeps loopback-published ports local to the host. [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/)

```bash
docker compose up -d --wait --wait-timeout 180
docker compose ps
curl -fsS -H 'Host: muvilite.localhost' http://127.0.0.1/api/health
curl -fsS -o /dev/null -H 'Host: admin.muvilite.localhost' http://127.0.0.1/
```

The first request should return JSON with `"status":"ok"`. Once DNS and the firewall are ready, change these three lines in `.env` to use your own domains. Caddy obtains and renews certificates automatically. [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)

```dotenv
FRONTEND_SITE=https://media.example.com
ADMIN_SITE=https://admin.example.com
BIND_ADDRESS=0.0.0.0
```

```bash
docker compose up -d --wait --wait-timeout 180
curl -fsS https://media.example.com/api/health
curl -fsS https://admin.example.com/api/health
```

Open the admin hostname and sign in with the seeded credentials. Upload a small test video and play it on the public site. The backend image includes ffmpeg and ffprobe. The admin panel lets you choose MP4 or HLS, and HLS uploads are processed in the background. The default video cap is 2 GiB and admin Nginx allows enough room for the multipart request. To change the cap, set `MAX_VIDEO_UPLOAD_SIZE_MB` in `.env`. Keep `client_max_body_size` in [admin/nginx.conf](admin/nginx.conf) above it to allow for multipart overhead. Rebuild and recreate the affected services.

## 4. Operate and update

```bash
docker compose ps
docker compose logs --tail=100 mongo backend frontend admin caddy
```

Before an update, take a backup. After pulling the desired release, rebuild and recreate the services. Run the HTTPS checks again. Keep the same Compose project name so the new containers use the existing volumes.

```bash
git pull --ff-only
docker compose pull mongo caddy
docker compose build --pull
docker compose up -d --wait --wait-timeout 180
```

Review MongoDB's upgrade procedure before changing its major image tag. A normal `docker compose down` keeps the data. Adding `-v` removes the volumes, including the database and uploads.

## 5. Back up and restore

Back up the database and uploads together. This pauses API writes and resumes the API when the shell exits. Run from the repository root. Store an encrypted copy of the archives and your `.env` off the server.

```bash
(
  set -e
  umask 077
  backup_dir="backups/$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$backup_dir"
  docker compose stop backend
  trap 'docker compose start backend' EXIT
  docker compose exec -T mongo sh -c \
    'exec mongodump -u muvilite_root -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db muvilite --archive --gzip' \
    > "$backup_dir/mongo.archive.gz"
  docker compose run --rm --no-deps -T backend tar -czf - -C /app/src/uploads . \
    > "$backup_dir/uploads.tar.gz"
  printf 'Backup saved to %s\n' "$backup_dir"
)
```

Restore into a fresh installation with empty volumes, a compatible app and MongoDB version, and a prepared `.env`. Skip the seed step. Use the archives from the same backup. These commands assume the restore host is dedicated to this installation.

```bash
backup_dir=/path/to/backup
docker compose build
docker compose up -d --wait mongo
docker compose exec -T mongo sh -c \
  'exec mongorestore -u muvilite_root -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --nsInclude="muvilite.*"' \
  < "$backup_dir/mongo.archive.gz"
docker compose run --rm --no-deps -T backend tar -xzf - -C /app/src/uploads \
  < "$backup_dir/uploads.tar.gz"
docker compose up -d --wait --wait-timeout 180
```

Confirm that an existing administrator can sign in and that restored media plays.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| MongoDB stays unhealthy | Inspect `docker compose logs mongo`. Check CPU support, disk space, and whether the password matches the existing volume. |
| A site returns 502 | Inspect `docker compose ps` and `docker compose logs --tail=100 backend caddy`. |
| HTTPS certificates fail | Check the public DNS records, inbound TCP 80/443, and `docker compose logs caddy`. |
| Login fails after seeding | Confirm the administrator mobile number and password. Seeding preserves the password for an existing account. |
| Upload returns 413 | Compare the file size with the application and Nginx limits. Check any proxy in front of Caddy too. |
| HLS processing stalls | Inspect the job in the admin panel and the backend logs. Check available disk space and CPU load. |

[Manual Ubuntu installation](DEPLOY-SERVER.md) is also available in English.
