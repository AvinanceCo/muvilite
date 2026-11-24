# Deploying MuviLite on a normal server

A step-by-step guide for an ordinary internet-facing Linux server (a VPS or a
dedicated machine) with a real domain name and HTTPS.

This guide installs the services directly on Ubuntu. For the Docker Compose setup, see the
[single-server guide in English](DEPLOYMENT.md) or [راهنمای فارسی](DEPLOYMENT_FA.md).

```
                 ┌──────────── the server ─────────────────────────────────┐
 https://example.com        ─▶ nginx ─┬─ /            frontend/dist (static) │
 https://admin.example.com  ─▶ nginx ─┼─ /            admin/dist    (static) │
                                      ├─ /uploads/**  /var/lib/muvilite/uploads
                                      └─ /api/**  ─▶ Node API :4000 ─▶ MongoDB :27017
                 └─────────────────────────────────────────────────────────┘
```

Both sites are **same-origin**: each nginx site serves its own static files,
serves `/uploads` straight off the disk, and proxies `/api` to the Node process.
This means the browser never makes a cross-origin call, nothing has to be baked
into the JavaScript bundles, and the API and database are never exposed to the
internet. Only nginx is.

Throughout this guide, replace:

| Placeholder | Meaning |
| --- | --- |
| `example.com` | the main site's domain |
| `admin.example.com` | the admin panel's domain |
| `<repo-url>` | `https://github.com/AvinanceCo/muvilite.git` (or your GitLab mirror) |

---

## 1. What you need

- **Ubuntu 22.04 or 24.04**, 64-bit, with root or sudo access.
- At least **2 GB RAM** and **2 CPU cores**. Disk space is mostly for uploaded
  media: films can be up to 2 GB each, so size the disk for your library.
- A CPU with **AVX** support, which MongoDB 5+ requires. Almost every VPS has it.
  Check with `grep -c avx /proc/cpuinfo`: anything above `0` is fine.
- **Two DNS records**, both pointing at the server's public IP:

  ```
  example.com         A   <server-ip>
  admin.example.com   A   <server-ip>
  ```

  Create them first. Step 10 (HTTPS) fails until they resolve.

---

## 2. Prepare the server

Log in as a sudo user and update the system:

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install git nginx curl rsync ufw
```

Open only SSH and web traffic:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'      # 80 and 443
sudo ufw enable
```

The API's port (4000) and MongoDB's port (27017) stay closed: only nginx talks
to them, over `127.0.0.1`.

Create a dedicated, unprivileged user that will own the code and run the API:

```bash
sudo adduser --system --group --home /opt/muvilite --shell /bin/bash muvilite
sudo mkdir -p /opt/muvilite
sudo chown muvilite:muvilite /opt/muvilite
sudo chmod 755 /opt/muvilite     # Ubuntu creates homes as 750; you need to cd in
```

The code itself holds no secrets. The only secret, `backend/.env`, is made
readable by its owner alone in step 6.

Create the directories for uploaded media and for the published static sites:

```bash
sudo mkdir -p /var/lib/muvilite/uploads /var/www/muvilite/frontend /var/www/muvilite/admin
sudo chown -R muvilite:muvilite /var/lib/muvilite /var/www/muvilite
```

Uploads live **outside** the code tree on purpose, so a redeploy can never
delete them.

---

## 3. Get the code

```bash
sudo -u muvilite -H git clone <repo-url> /opt/muvilite/app
cd /opt/muvilite/app
```

If the repository is private, use a read-only deploy key or an access token.
Never use your personal password on the server.

---

## 4. Install Node.js and MongoDB

Install Node.js 22 or newer system-wide, `build-essential`, `python3`, and
MongoDB Community 7.0. Configure MongoDB to listen on `127.0.0.1:27017`.
Install ffmpeg if you want HLS transcoding.

Check your installation:

```bash
node -v                     # v22 or newer
systemctl is-active mongod  # active
ffmpeg -version | head -1   # if installed for HLS
```

> **Do not use nvm.** It installs Node under a home directory, which neither
> `sudo` nor the hardened systemd unit in step 7 can see.

---

## 5. Secure MongoDB

By default MongoDB has no password and listens only on `127.0.0.1`. That is
safe as long as the firewall is up, but on an internet-facing server you should
turn on authentication anyway.

Create an application user. Pick a long random password and keep it, because
you will need it in step 6:

```bash
openssl rand -hex 24          # use the output as <db-password>

mongosh --quiet <<'EOF'
use admin
db.createUser({
  user: "muvilite",
  pwd:  "<db-password>",
  roles: [ { role: "readWrite", db: "muvilite" } ]
})
EOF
```

Then enable authorization. Edit `/etc/mongod.conf` and make sure it contains:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1

security:
  authorization: enabled
```

Restart and check that the login works:

```bash
sudo systemctl restart mongod
mongosh "mongodb://muvilite:<db-password>@127.0.0.1:27017/muvilite?authSource=admin" \
  --quiet --eval 'db.runCommand({ ping: 1 })'
# { ok: 1 }
```

---

## 6. Configure and seed the backend

Install the production dependencies:

```bash
cd /opt/muvilite/app/backend
sudo -u muvilite -H npm ci --omit=dev
```

Create `.env` from the template:

```bash
sudo -u muvilite cp .env.example .env
sudo chmod 600 .env
sudo -u muvilite nano .env
```

Set these values. Leave every other key at its default:

```dotenv
PORT=4000
NODE_ENV=production

MONGODB_URI=mongodb://muvilite:<db-password>@127.0.0.1:27017/muvilite?authSource=admin

# openssl rand -hex 32. Changing it later signs every admin out.
JWT_SECRET=<long-random-string>
JWT_EXPIRES=12h

# Absolute path, outside the code tree (created in step 2).
UPLOAD_PATH=/var/lib/muvilite/uploads

# Must match the real origins exactly: scheme, host, no trailing slash.
FRONTEND_URL=https://example.com
ADMIN_URL=https://admin.example.com

# Enable the nightly watch-trend aggregation.
ENABLE_CRON=true

# The first administrator, created by the seed. Change the password from
# inside the panel after the first sign-in.
SEED_ADMIN_MOBILE=09120000000
SEED_ADMIN_PASSWORD=<initial-admin-password>
```

> `.env` holds secrets. It is listed in `.gitignore` and must never be
> committed. Back it up somewhere safe: the JWT secret and database password
> cannot be recovered.

Seed the database. This writes the genres, age ranges, countries, permission
groups, poll questions, static pages and the first administrator. Every write
is an upsert, so running it again later is harmless:

```bash
sudo -u muvilite -H npm run seed
```

Do a quick test run, then stop it with `Ctrl+C`:

```bash
sudo -u muvilite -H npm start
# … Server listening on port 4000 (production)
```

---

## 7. Run the API as a service

Create `/etc/systemd/system/muvilite-api.service`:

```ini
[Unit]
Description=MuviLite API
After=network.target mongod.service
Wants=mongod.service
# Keep retrying forever. A fast failure at boot (mongod not ready yet) would
# otherwise use up systemd's restart budget and leave the API dead.
StartLimitIntervalSec=0

[Service]
Type=simple
User=muvilite
Group=muvilite
WorkingDirectory=/opt/muvilite/app/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=3

# Hardening. The API may write only to the upload directory.
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/muvilite/uploads

[Install]
WantedBy=multi-user.target
```

There is deliberately no `EnvironmentFile=`: the app's `dotenv` reads `.env`
from the working directory. systemd would also misread
`WATCH_TREND_CRON=0 2 * * *` because of its spaces.

`which node` must print `/usr/bin/node`. If it prints something else, use that
path in `ExecStart`.

Start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now muvilite-api
curl -s http://127.0.0.1:4000/api/health
# {"success":true,"message":"Healthy",...}
```

---

## 8. Build and publish the two web apps

Both bundles call the relative `/api` and `/uploads` by default, which is
exactly what this setup needs, so **no build variables are required**.

```bash
cd /opt/muvilite/app

sudo -u muvilite -H sh -c 'cd frontend && npm ci && npm run build'
sudo -u muvilite -H sh -c 'cd admin    && npm ci && npm run build'

sudo -u muvilite rsync -a --delete frontend/dist/ /var/www/muvilite/frontend/
sudo -u muvilite rsync -a --delete admin/dist/    /var/www/muvilite/admin/
```

The build runs in `dist/` and only then is copied into `/var/www`, so the live
site is never half-built while `npm run build` is running.

---

## 9. Configure nginx

Create `/etc/nginx/sites-available/muvilite`:

```nginx
# Shared upstream for both sites.
upstream muvilite_api {
    server 127.0.0.1:4000;
    keepalive 16;
}

# ── Main site ──────────────────────────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name example.com;

    root  /var/www/muvilite/frontend;
    index index.html;
    charset utf-8;

    server_tokens off;
    client_max_body_size 2m;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy        strict-origin-when-cross-origin always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/javascript application/json
               image/svg+xml font/woff font/woff2;

    location /api/ {
        proxy_pass http://muvilite_api;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";
        proxy_read_timeout 120s;
    }

    # Media straight off the disk. nginx handles Range requests, so video seeks.
    # Games are served here WITHOUT a sandbox on purpose: they keep their
    # progress in localStorage on this origin.
    # HLS playlists: revalidated on every load, since they can be rewritten in
    # place (npm run hls:frame-rate). Segments keep the long cache below.
    location ~ ^/uploads/movies/(.+\.m3u8)$ {
        alias /var/lib/muvilite/uploads/movies/$1;
        access_log off;
        expires epoch;
    }

    location /uploads/ {
        alias /var/lib/muvilite/uploads/;
        access_log off;
        expires 7d;
        try_files $uri =404;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # SPA fallback: React Router owns every other path.
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# ── Admin panel ─────────────────────────────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name admin.example.com;

    root  /var/www/muvilite/admin;
    index index.html;
    charset utf-8;

    server_tokens off;

    # Films are uploaded here. Must stay at or above MAX_VIDEO_UPLOAD_SIZE_MB
    # (2048 by default) plus room for the multipart envelope, or nginx answers
    # 413 before the API ever sees the file.
    client_max_body_size 2100m;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options        SAMEORIGIN always;
    add_header Referrer-Policy        strict-origin-when-cross-origin always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/javascript application/json
               image/svg+xml font/woff font/woff2;

    location /api/ {
        proxy_pass http://muvilite_api;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";

        # Stream big uploads through to the API instead of buffering them on
        # nginx's disk first.
        proxy_request_buffering off;
        proxy_connect_timeout 10s;
        client_body_timeout   300s;
        proxy_send_timeout    300s;
        proxy_read_timeout    300s;
    }

    # An HTML5 game is third-party JavaScript. On THIS origin, which holds the
    # administrator's token, it gets an opaque origin via the CSP sandbox, so
    # it can run but cannot read the panel's storage or call the API as the
    # admin. The add_header lines are repeated because nginx drops inherited
    # headers once a location declares its own.
    location /uploads/games/ {
        alias /var/lib/muvilite/uploads/games/;
        access_log off;
        expires 7d;
        add_header X-Content-Type-Options  nosniff always;
        add_header X-Frame-Options         SAMEORIGIN always;
        add_header Referrer-Policy         strict-origin-when-cross-origin always;
        add_header Content-Security-Policy "sandbox allow-scripts allow-pointer-lock" always;
        try_files $uri =404;
    }

    # HLS playlists: revalidated on every load, since they can be rewritten in
    # place (npm run hls:frame-rate). Segments keep the long cache below.
    location ~ ^/uploads/movies/(.+\.m3u8)$ {
        alias /var/lib/muvilite/uploads/movies/$1;
        access_log off;
        expires epoch;
    }

    location /uploads/ {
        alias /var/lib/muvilite/uploads/;
        access_log off;
        expires 7d;
        try_files $uri =404;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable it and remove the default site:

```bash
sudo ln -s /etc/nginx/sites-available/muvilite /etc/nginx/sites-enabled/muvilite
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

nginx runs as `www-data` and must be able to read the uploads. The directories
are world-readable by default (`755`). If you tightened them, grant read access:

```bash
sudo chmod 755 /var/lib/muvilite /var/lib/muvilite/uploads
```

---

## 10. Turn on HTTPS

Use Let's Encrypt. Certbot edits the nginx file for you, adding the `443`
blocks and an HTTP→HTTPS redirect:

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d admin.example.com \
  --redirect --agree-tos -m you@example.com
```

Renewal is automatic (a systemd timer). Test it once:

```bash
sudo certbot renew --dry-run
```

---

## 11. Check that it works

```bash
curl -s https://example.com/api/health              # {"success":true,...}
curl -sI https://example.com/ | head -1             # HTTP/2 200
curl -sI https://admin.example.com/login | head -1  # HTTP/2 200 (SPA fallback)
```

Then in a browser:

1. Open `https://admin.example.com/`, sign in with `SEED_ADMIN_MOBILE` and
   `SEED_ADMIN_PASSWORD`, and **change the password** from your profile.
2. Upload a poster or a short film, then open `https://example.com/` and check
   that it appears and plays, and that seeking works.
3. If you use games, upload one in the admin panel and play it on the
   main site.

---

## 12. Deploying an update

Every time new code is pushed, run this on the server:

```bash
cd /opt/muvilite/app
sudo -u muvilite -H git pull

# Backend
sudo -u muvilite -H sh -c 'cd backend && npm ci --omit=dev'
sudo -u muvilite -H sh -c 'cd backend && npm run seed'   # only if the release notes say so
sudo systemctl restart muvilite-api

# Web apps
sudo -u muvilite -H sh -c 'cd frontend && npm ci && npm run build'
sudo -u muvilite -H sh -c 'cd admin    && npm ci && npm run build'
sudo -u muvilite rsync -a --delete frontend/dist/ /var/www/muvilite/frontend/
sudo -u muvilite rsync -a --delete admin/dist/    /var/www/muvilite/admin/
```

Re-running the seed is always safe because it only upserts. A release that
adds new reference data needs it: for example, the games feature needs it for
its genres and permissions.

`.env`, the database and `/var/lib/muvilite/uploads` are never touched by an
update.

**Upgrading a server installed before the HLS transcoder:** install ffmpeg once
(`sudo apt install -y ffmpeg`), deploy as above, then optionally convert the
films uploaded before it (they keep playing as MP4 otherwise):

```bash
sudo -u muvilite -H sh -c 'cd backend && npm run transcode:backfill'
sudo systemctl restart muvilite-api    # the worker picks them up on start
```

**Upgrading a server whose films were transcoded before 2026-11-15:** their
player quality menu offers only «خودکار». Repair them once (files only, no
restart needed, harmless to repeat):

```bash
sudo -u muvilite -H sh -c 'cd backend && npm run hls:frame-rate'
```

Transcoding uses every CPU core while it runs, one film at a time
(`TRANSCODE_CONCURRENCY`). Plan about 4.5 GB of disk per hour of 1080p film.

---

## 13. Backups

Back up three things: the database, the uploaded media, and `backend/.env`.

```bash
sudo mkdir -p /var/backups/muvilite

# Database
mongodump --uri "mongodb://muvilite:<db-password>@127.0.0.1:27017/muvilite?authSource=admin" \
  --archive=/var/backups/muvilite/db-$(date +%F).archive --gzip

# Media
sudo tar czf /var/backups/muvilite/uploads-$(date +%F).tar.gz -C /var/lib/muvilite uploads
```

Restore:

```bash
mongorestore --uri "mongodb://muvilite:<db-password>@127.0.0.1:27017/muvilite?authSource=admin" \
  --archive=/var/backups/muvilite/db-2026-11-10.archive --gzip --drop

sudo tar xzf /var/backups/muvilite/uploads-2026-11-10.tar.gz -C /var/lib/muvilite
sudo chown -R muvilite:muvilite /var/lib/muvilite/uploads
```

Copy the backups **off the server** (another machine, or object storage). A
backup on the same disk is lost along with it.

---

## 14. Troubleshooting

| Symptom | Where to look / what to do |
| --- | --- |
| Any page shows **502 Bad Gateway** on `/api` | The API is down. `sudo systemctl status muvilite-api` and `journalctl -u muvilite-api -n 100`. |
| API exits with `Missing required environment variables` | `MONGODB_URI` or `JWT_SECRET` is missing in `backend/.env`. |
| API exits with `Authentication failed` | The password in `MONGODB_URI` doesn't match the MongoDB user from step 5. |
| Upload fails with **413** | nginx rejected the body. Raise `client_max_body_size` in the admin site, and raise `MAX_VIDEO_UPLOAD_SIZE_MB` in `.env` with it. |
| Film upload fails with **503** "ffprobe is not installed" | `sudo apt install -y ffmpeg`, then `sudo systemctl restart muvilite-api`. |
| A film stays «در حال تبدیل» / shows «ناموفق» | `journalctl -u muvilite-api` shows the ffmpeg error; the admin panel shows its last lines and a retry button. |
| Upload fails with **EACCES** in the API log | `/var/lib/muvilite/uploads` isn't owned by `muvilite`, or it isn't in `ReadWritePaths`. |
| Images/videos **404** but uploads succeeded | `UPLOAD_PATH` in `.env` and the `alias` in nginx point to different directories. |
| Video won't start until fully downloaded | The MP4 has its index at the end. Remux: `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`. |
| Refreshing a page like `/movies/12` gives **404** | The `location / { try_files … /index.html; }` fallback is missing. |
| **CORS** errors in the browser | Something calls the API cross-origin. The bundles must be built **without** `VITE_API_URL` (relative `/api`). If you deliberately use absolute URLs, `FRONTEND_URL`/`ADMIN_URL` must match the origins exactly. |
| `mongod` fails to start on a new kernel | MongoDB 8.0 on kernel ≥ 6.19. Install MongoDB 7.0. |
| `apt` gets **403** from `repo.mongodb.org` | The MongoDB repo blocks some networks for apt. Download the `.deb` packages with `curl` and install them with `apt install ./*.deb`. |

Useful commands:

```bash
journalctl -u muvilite-api -f           # live API log
sudo tail -f /var/log/nginx/error.log    # nginx errors
sudo systemctl restart muvilite-api
sudo nginx -t && sudo systemctl reload nginx
```
