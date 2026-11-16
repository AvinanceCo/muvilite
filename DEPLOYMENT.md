# MuviLite — Deployment Guide · راهنمای استقرار

**[English](#english)** · **[فارسی](#فارسی)**

---

<a id="english"></a>

## English

This guide covers deploying the three parts of MuviLite — the **backend** (API),
the **frontend** (main site) and the **admin** panel — and choosing a server
with or without the **video transcoder**.

The detailed, step-by-step guides it builds on:

| Situation | Guide |
| --- | --- |
| Internet server with a domain and HTTPS | [DEPLOY-SERVER.md](DEPLOY-SERVER.md) |
| Containers | [DOCKER.md](DOCKER.md) |
| Liara (PaaS) | [DEPLOY-LIARA.md](DEPLOY-LIARA.md) |

### 1. What gets deployed

```
 visitor browser   ─▶ nginx ─┬─ /            frontend  (static files, built once)
 admin browser     ─▶ nginx ─┼─ /            admin     (static files, built once)
                             ├─ /uploads/**  media on disk
                             └─ /api/**  ─▶  backend (Node.js :4000) ─▶ MongoDB 7
                                                 └─ ffmpeg (only with the transcoder)
```

- **Backend** — Node.js 20+ and MongoDB 7. The only part that runs code on the
  server, and the only part the transcoder touches.
- **Frontend** and **Admin** — React apps built into static files and served
  by nginx. They need no Node.js at run time and almost no resources. Both call
  `/api` and `/uploads` on their **own** address; nginx forwards those to the
  backend, so no address is baked into the build.

### 2. With or without the transcoder

Uploaded films and clips can be published in one of two ways. It is chosen in
the admin panel under **«تنظیمات ویدئو»** (Video settings) and can be changed at
any time; the choice affects the **next** upload only.

| | **MP4** — no transcoding | **HLS** — transcoding |
| --- | --- | --- |
| Files accepted | MP4, WebM | MP4, MKV, MOV, AVI, WebM, … |
| After upload | published immediately, as uploaded | queued, converted to 360p–1080p, then published |
| Viewer experience | one quality; may stall on a busy network | quality adapts to the network automatically |
| Server needs | nothing beyond the API | **ffmpeg**, and CPU while a video converts |
| Disk per hour of 1080p film | the uploaded file only | ≈ 4.5 GB (the original is deleted afterwards) |

- The **player** on the main site plays both formats; nothing else changes.
- A server **without ffmpeg** works out of the box in MP4 mode. HLS cannot be
  chosen there until ffmpeg is installed.
- A server **with ffmpeg** defaults to HLS until someone chooses otherwise.
- Switching never re-encodes existing videos. To convert videos uploaded as MP4
  later, see [§6](#6-turning-the-transcoder-on-later).

### 3. Minimum server requirements

All three parts on **one** server, which is the normal setup.

| | Without transcoder (MP4) | With transcoder (HLS) |
| --- | --- | --- |
| **CPU** | 2 cores | **4 cores minimum, 8 recommended** |
| **RAM** | 2 GB (4 GB recommended) | **4 GB minimum, 8 GB recommended** |
| **Disk (system + app)** | 20 GB SSD | 20 GB SSD |
| **Disk (media)** | the size of your library | ≈ 4.5 GB per hour of 1080p film, plus room for one original during conversion |
| **OS** | Ubuntu 22.04 / 24.04, 64-bit | same |
| **Software** | Node.js 20+, MongoDB 7, nginx | same **+ ffmpeg** |

Also required in both cases:

- **CPU with AVX** — MongoDB 5+ will not start without it (`grep -c avx /proc/cpuinfo` must print more than 0).
- **MongoDB 7.0, not 8.0**, on Linux kernels 6.19 and newer (8.0 refuses to start there).

Where the load comes from:

- The **frontend and admin** are static files: negligible CPU, a few MB of RAM in nginx.
- The **backend** idles at about 150 MB of RAM; MongoDB uses up to half the RAM as cache.
- **Streaming** is served by nginx straight from disk, so the limit is the disk
  and the network, not the CPU. Plan the network for the number of viewers ×
  the video bitrate (a 720p stream is about 3 Mb/s).
- **Transcoding** uses **every** CPU core while a video converts, one video at a
  time by default (`TRANSCODE_CONCURRENCY=1`). Playback keeps working during a
  conversion, but the server is busy.

**How long a conversion takes** (measured, then estimated):

| CPU | 5½ min of 720p (360/480/720p) | a 2-hour 1080p film (4 qualities) |
| --- | --- | --- |
| 4-core 2016 laptop CPU (AMD A12-9800B) — measured | ≈ 5 min | estimate: 4–5 hours |
| modern 8-core server — estimate | ≈ 1–2 min | estimate: 1–2 hours |

Real films take longer than the synthetic test clip. If conversions are too slow,
use a faster x264 preset (`TRANSCODE_PRESET=ultrafast`, larger files) or more cores.

### 4. Deploying the three parts (Ubuntu server)

Below is the short path for a normal Ubuntu server. Every step is explained in
[DEPLOY-SERVER.md](DEPLOY-SERVER.md).

#### 4.1 Get the code and system software

```bash
sudo apt update && sudo apt -y install git nginx curl rsync
git clone <repo-url> /opt/muvilite/app
cd /opt/muvilite/app/refactored

# WITH transcoder (HLS available):
sudo ./setup-ubuntu.sh
# WITHOUT transcoder (MP4 only, lighter server):
sudo ./setup-ubuntu.sh --no-ffmpeg
```

`setup-ubuntu.sh` installs Node.js, MongoDB (the right series for the kernel),
the build tools and — unless `--no-ffmpeg` — ffmpeg.

#### 4.2 Backend

```bash
cd backend
npm ci --omit=dev
cp .env.example .env        # then edit it
npm run seed                # reference data + the first administrator
```

The `.env` values that matter:

```dotenv
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb://<user>:<password>@127.0.0.1:27017/muvilite?authSource=admin
JWT_SECRET=<openssl rand -hex 32>
UPLOAD_PATH=/var/lib/muvilite/uploads
FRONTEND_URL=https://example.com
ADMIN_URL=https://admin.example.com
ENABLE_CRON=true
SEED_ADMIN_MOBILE=09120000000
SEED_ADMIN_PASSWORD=<initial password>

# Only with the transcoder:
TRANSCODE_CONCURRENCY=1        # videos converted at once
TRANSCODE_PRESET=veryfast      # ultrafast … medium
```

Run it as a systemd service (unit file in DEPLOY-SERVER.md §7), then check:

```bash
curl -s http://127.0.0.1:4000/api/health
```

The log line `ffmpeg/ffprobe not found` at start-up is expected on a server
without the transcoder.

#### 4.3 Frontend (main site)

```bash
cd ../frontend
npm ci && npm run build
sudo rsync -a --delete dist/ /var/www/muvilite/frontend/
```

The player is installed from `frontend/vendor/muvi/` (committed tarballs); no
extra step is needed.

#### 4.4 Admin panel

```bash
cd ../admin
npm ci && npm run build
sudo rsync -a --delete dist/ /var/www/muvilite/admin/
```

#### 4.5 nginx and HTTPS

One `server` block per site: each serves its static files, serves `/uploads/`
from `UPLOAD_PATH`, and proxies `/api/` to `127.0.0.1:4000`. The admin site needs
`client_max_body_size 2100m` for film uploads. The complete configuration and the
certbot step are in DEPLOY-SERVER.md §9–§10.

#### 4.6 Choose the video mode

Sign in to the admin panel → **«تنظیمات ویدئو»** → choose **MP4** or **HLS**.
If you skip this, the server uses HLS when ffmpeg is installed and MP4 when it
is not.

### 5. Updating an existing installation

```bash
cd /opt/muvilite/app/refactored && git pull
(cd backend  && npm ci --omit=dev && npm run seed) && sudo systemctl restart muvilite-api
(cd frontend && npm ci && npm run build) && sudo rsync -a --delete frontend/dist/ /var/www/muvilite/frontend/
(cd admin    && npm ci && npm run build) && sudo rsync -a --delete admin/dist/    /var/www/muvilite/admin/
```

`npm run seed` is required once after this release: it adds the **«تنظیمات»**
(settings) permission, without which nobody can open the video settings screen.
It only adds what is missing and is safe to run every time.

### 6. Turning the transcoder on later

```bash
sudo apt install -y ffmpeg
sudo systemctl restart muvilite-api
```

Then choose **HLS** in «تنظیمات ویدئو». Films uploaded earlier stay MP4; to
convert them too:

```bash
cd backend && npm run transcode:backfill    # add -- --dry-run to only list them
sudo systemctl restart muvilite-api         # the worker picks them up on start
```

Each film keeps playing as MP4 until its HLS version is ready.

Films transcoded to HLS before 2026-11-15 offer only «خودکار» in the player's
quality menu (the other qualities show «در دسترس نیست»). Repair them once —
files only, safe while the API runs, harmless to repeat:

```bash
cd backend && npm run hls:frame-rate        # add -- --dry-run to only list them
```

**Turning it off** needs nothing on the server: choose **MP4**. ffmpeg can stay
installed; it is only used when HLS is chosen.

### 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| «تنظیمات ویدئو» is missing from the menu | `npm run seed` was not run after updating, or your group lacks the «تنظیمات» permission. |
| HLS option is greyed out | ffmpeg is not installed, or the API was not restarted after installing it. |
| Upload refused: "Unsupported file type … Allowed: video/mp4, video/webm" | MP4 mode accepts only MP4/WebM. Convert the file, or choose HLS. |
| Upload refused with **503** "ffprobe is not installed" | HLS was chosen and ffmpeg was removed later. Install it, or choose MP4. |
| A film stays "converting" for a long time | Normal for long films on few cores (see §3). The admin panel shows the progress; `journalctl -u muvilite-api` shows errors. |
| Upload fails with **413** | nginx `client_max_body_size` on the admin site is too small. |

---

<a id="فارسی"></a>

<div dir="rtl">

## فارسی

این راهنما استقرار سه بخش MuviLite را توضیح می‌دهد — **بک‌اند** (API)، **فرانت‌اند**
(سایت اصلی) و **پنل مدیریت** — و این‌که سرور را **با** یا **بدون مبدل ویدئو**
(ترنسکدر) انتخاب کنید.

راهنماهای مفصل که این راهنما بر پایهٔ آن‌هاست:

| وضعیت | راهنما |
| --- | --- |
| سرور اینترنتی با دامنه و HTTPS | [DEPLOY-SERVER.md](DEPLOY-SERVER.md) |
| کانتینر (Docker) | [DOCKER.md](DOCKER.md) |
| لیارا | [DEPLOY-LIARA.md](DEPLOY-LIARA.md) |

### ۱. چه چیزی مستقر می‌شود

</div>

```
 visitor browser   ─▶ nginx ─┬─ /            frontend  (static files, built once)
 admin browser     ─▶ nginx ─┼─ /            admin     (static files, built once)
                             ├─ /uploads/**  media on disk
                             └─ /api/**  ─▶  backend (Node.js :4000) ─▶ MongoDB 7
                                                 └─ ffmpeg (only with the transcoder)
```

<div dir="rtl">

- **بک‌اند** — Node.js نسخهٔ ۲۰ به بالا و MongoDB 7. تنها بخشی که روی سرور کد اجرا
  می‌کند و تنها بخشی که مبدل ویدئو به آن مربوط است.
- **فرانت‌اند** و **پنل مدیریت** — برنامه‌های React که یک بار به فایل‌های ایستا
  ساخته می‌شوند و nginx آن‌ها را ارائه می‌کند. هنگام اجرا به Node.js نیازی ندارند و
  تقریباً هیچ منبعی مصرف نمی‌کنند. هر دو `/api` و `/uploads` را روی **نشانی خودشان**
  صدا می‌زنند و nginx آن‌ها را به بک‌اند می‌رساند؛ پس هیچ نشانی‌ای داخل بیلد ثابت نمی‌شود.

### ۲. با مبدل ویدئو یا بدون آن

ویدئوی فیلم‌ها و کلیپ‌های بارگذاری‌شده به یکی از دو شکل منتشر می‌شود. انتخاب آن در
پنل مدیریت، بخش **«تنظیمات ویدئو»** است و هر زمان قابل تغییر است؛ این انتخاب فقط روی
**بارگذاری‌های بعدی** اثر دارد.

| | **MP4** — بدون تبدیل | **HLS** — با تبدیل |
| --- | --- | --- |
| فایل‌های پذیرفته‌شده | MP4 و WebM | MP4، MKV، MOV، AVI، WebM و … |
| پس از بارگذاری | همان لحظه، همان‌طور که هست منتشر می‌شود | در صف قرار می‌گیرد، به ۳۶۰ تا ۱۰۸۰ تبدیل و سپس منتشر می‌شود |
| تجربهٔ بیننده | یک کیفیت؛ در شبکهٔ شلوغ ممکن است پخش مکث کند | کیفیت خودکار با سرعت شبکه تنظیم می‌شود |
| نیاز سرور | چیزی جز API لازم نیست | **ffmpeg** و پردازنده در زمان تبدیل |
| فضای دیسک برای هر ساعت فیلم ۱۰۸۰ | فقط خود فایل بارگذاری‌شده | حدود ۴٫۵ گیگابایت (فایل اصلی پس از تبدیل حذف می‌شود) |

- **پخش‌کنندهٔ** سایت اصلی هر دو قالب را پخش می‌کند؛ چیز دیگری تغییر نمی‌کند.
- سرور **بدون ffmpeg** از ابتدا در حالت MP4 کار می‌کند و تا نصب ffmpeg نمی‌توان HLS را انتخاب کرد.
- سرور **دارای ffmpeg** تا وقتی کسی گزینهٔ دیگری انتخاب نکند، HLS را به کار می‌برد.
- تغییر حالت هرگز ویدئوهای موجود را دوباره تبدیل نمی‌کند. برای تبدیل ویدئوهای MP4
  قبلی [بخش ۶](#۶-روشن-کردن-مبدل-در-آینده) را ببینید.

### ۳. حداقل مشخصات سرور

هر سه بخش روی **یک** سرور، که حالت معمول است.

| | بدون مبدل (MP4) | با مبدل (HLS) |
| --- | --- | --- |
| **پردازنده** | ۲ هسته | **حداقل ۴ هسته، پیشنهادی ۸ هسته** |
| **رم** | ۲ گیگابایت (پیشنهادی ۴) | **حداقل ۴ گیگابایت، پیشنهادی ۸** |
| **دیسک (سیستم و برنامه)** | ۲۰ گیگابایت SSD | ۲۰ گیگابایت SSD |
| **دیسک (رسانه)** | به اندازهٔ کتابخانهٔ ویدئو | حدود ۴٫۵ گیگابایت برای هر ساعت فیلم ۱۰۸۰، به‌علاوهٔ جای یک فایل اصلی در حین تبدیل |
| **سیستم‌عامل** | اوبونتو ۲۲٫۰۴ یا ۲۴٫۰۴، ۶۴ بیتی | همان |
| **نرم‌افزار** | Node.js 20+، MongoDB 7، nginx | همان **+ ffmpeg** |

در هر دو حالت لازم است:

- **پردازنده با پشتیبانی AVX** — MongoDB نسخهٔ ۵ به بعد بدون آن اجرا نمی‌شود
  (خروجی `grep -c avx /proc/cpuinfo` باید بیشتر از صفر باشد).
- روی کرنل لینوکس ۶٫۱۹ و جدیدتر، **MongoDB 7.0 و نه 8.0** (نسخهٔ 8.0 آن‌جا اجرا نمی‌شود).

بار سرور از کجا می‌آید:

- **فرانت‌اند و پنل مدیریت** فایل ایستا هستند: مصرف پردازنده ناچیز و چند مگابایت رم در nginx.
- **بک‌اند** در حالت بیکار حدود ۱۵۰ مگابایت رم مصرف می‌کند؛ MongoDB تا نیمی از رم را برای کش برمی‌دارد.
- **پخش ویدئو** را nginx مستقیم از دیسک ارائه می‌کند، پس محدودیت دیسک و شبکه است نه
  پردازنده. شبکه را برای «تعداد بیننده × نرخ بیت ویدئو» در نظر بگیرید (هر پخش ۷۲۰ حدود ۳ مگابیت بر ثانیه).
- **تبدیل ویدئو** در زمان تبدیل **همهٔ** هسته‌های پردازنده را مشغول می‌کند و به‌طور پیش‌فرض
  هر بار یک ویدئو (`TRANSCODE_CONCURRENCY=1`). پخش در این مدت ادامه دارد، اما سرور مشغول است.

**مدت زمان تبدیل** (اندازه‌گیری‌شده و تخمینی):

| پردازنده | ۵٫۵ دقیقه ویدئوی ۷۲۰ (۳۶۰/۴۸۰/۷۲۰) | فیلم ۲ ساعته ۱۰۸۰ (۴ کیفیت) |
| --- | --- | --- |
| پردازندهٔ ۴ هسته‌ای لپ‌تاپ ۲۰۱۶ (AMD A12-9800B) — اندازه‌گیری‌شده | حدود ۵ دقیقه | تخمین: ۴ تا ۵ ساعت |
| سرور امروزی ۸ هسته‌ای — تخمین | حدود ۱ تا ۲ دقیقه | تخمین: ۱ تا ۲ ساعت |

فیلم‌های واقعی از ویدئوی آزمایشی کندتر تبدیل می‌شوند. اگر تبدیل خیلی کند است، از تنظیم
سریع‌تر (`TRANSCODE_PRESET=ultrafast`، با فایل‌های بزرگ‌تر) یا هستهٔ بیشتر استفاده کنید.

### ۴. استقرار سه بخش (سرور اوبونتو)

مسیر کوتاه برای یک سرور معمولی اوبونتو در ادامه آمده است. همهٔ مراحل در
[DEPLOY-SERVER.md](DEPLOY-SERVER.md) با جزئیات توضیح داده شده‌اند.

#### ۴٫۱ دریافت کد و نرم‌افزارهای سیستم

</div>

```bash
sudo apt update && sudo apt -y install git nginx curl rsync
git clone <repo-url> /opt/muvilite/app
cd /opt/muvilite/app/refactored

# با مبدل (HLS در دسترس):
sudo ./setup-ubuntu.sh
# بدون مبدل (فقط MP4، سرور سبک‌تر):
sudo ./setup-ubuntu.sh --no-ffmpeg
```

<div dir="rtl">

اسکریپت `setup-ubuntu.sh` نسخهٔ مناسب Node.js و MongoDB (متناسب با کرنل)، ابزارهای
ساخت و — مگر با `--no-ffmpeg` — ffmpeg را نصب می‌کند.

#### ۴٫۲ بک‌اند

</div>

```bash
cd backend
npm ci --omit=dev
cp .env.example .env        # سپس ویرایش کنید
npm run seed                # داده‌های پایه و نخستین مدیر
```

<div dir="rtl">

مقدارهای مهم فایل `.env`:

</div>

```dotenv
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb://<user>:<password>@127.0.0.1:27017/muvilite?authSource=admin
JWT_SECRET=<openssl rand -hex 32>
UPLOAD_PATH=/var/lib/muvilite/uploads
FRONTEND_URL=https://example.com
ADMIN_URL=https://admin.example.com
ENABLE_CRON=true
SEED_ADMIN_MOBILE=09120000000
SEED_ADMIN_PASSWORD=<رمز اولیه>

# فقط با مبدل:
TRANSCODE_CONCURRENCY=1        # تعداد ویدئوهایی که هم‌زمان تبدیل می‌شوند
TRANSCODE_PRESET=veryfast      # ultrafast … medium
```

<div dir="rtl">

آن را به‌صورت سرویس systemd اجرا کنید (فایل سرویس در DEPLOY-SERVER.md بخش ۷) و سپس بررسی کنید:

</div>

```bash
curl -s http://127.0.0.1:4000/api/health
```

<div dir="rtl">

پیام `ffmpeg/ffprobe not found` هنگام راه‌اندازی، روی سرور بدون مبدل طبیعی است.

#### ۴٫۳ فرانت‌اند (سایت اصلی)

</div>

```bash
cd ../frontend
npm ci && npm run build
sudo rsync -a --delete dist/ /var/www/muvilite/frontend/
```

<div dir="rtl">

پخش‌کننده از پوشهٔ `frontend/vendor/muvi/` نصب می‌شود (فایل‌های فشرده‌ای که در مخزن
هستند)؛ مرحلهٔ دیگری لازم نیست.

#### ۴٫۴ پنل مدیریت

</div>

```bash
cd ../admin
npm ci && npm run build
sudo rsync -a --delete dist/ /var/www/muvilite/admin/
```

<div dir="rtl">

#### ۴٫۵ nginx و HTTPS

برای هر سایت یک بلوک `server`: فایل‌های ایستای خودش را ارائه می‌کند، `/uploads/` را از
`UPLOAD_PATH` می‌دهد و `/api/` را به `127.0.0.1:4000` می‌فرستد. سایت پنل مدیریت برای
بارگذاری فیلم به `client_max_body_size 2100m` نیاز دارد. پیکربندی کامل و مرحلهٔ certbot
در DEPLOY-SERVER.md بخش‌های ۹ و ۱۰ آمده است.

#### ۴٫۶ انتخاب حالت ویدئو

وارد پنل مدیریت شوید ← **«تنظیمات ویدئو»** ← **MP4** یا **HLS** را انتخاب کنید.
اگر انتخاب نکنید، سرور در صورت وجود ffmpeg از HLS و در غیر این صورت از MP4 استفاده می‌کند.

### ۵. به‌روزرسانی نصب موجود

</div>

```bash
cd /opt/muvilite/app/refactored && git pull
(cd backend  && npm ci --omit=dev && npm run seed) && sudo systemctl restart muvilite-api
(cd frontend && npm ci && npm run build) && sudo rsync -a --delete frontend/dist/ /var/www/muvilite/frontend/
(cd admin    && npm ci && npm run build) && sudo rsync -a --delete admin/dist/    /var/www/muvilite/admin/
```

<div dir="rtl">

اجرای `npm run seed` پس از این نسخه یک بار لازم است: مجوز **«تنظیمات»** را اضافه
می‌کند که بدون آن هیچ‌کس نمی‌تواند صفحهٔ تنظیمات ویدئو را باز کند. فقط موارد جاافتاده را
اضافه می‌کند و اجرای مکرر آن بی‌خطر است.

### ۶. روشن کردن مبدل در آینده

</div>

```bash
sudo apt install -y ffmpeg
sudo systemctl restart muvilite-api
```

<div dir="rtl">

سپس در «تنظیمات ویدئو» گزینهٔ **HLS** را انتخاب کنید. فیلم‌هایی که قبلاً بارگذاری شده‌اند
MP4 می‌مانند؛ برای تبدیل آن‌ها:

</div>

```bash
cd backend && npm run transcode:backfill    # با -- --dry-run فقط فهرست را نشان می‌دهد
sudo systemctl restart muvilite-api         # پردازشگر هنگام راه‌اندازی آن‌ها را برمی‌دارد
```

<div dir="rtl">

فیلم‌هایی که پیش از ۲۴ آبان ۱۴۰۵ به HLS تبدیل شده‌اند، در منوی کیفیت پخش‌کننده فقط «خودکار» را
دارند و بقیهٔ کیفیت‌ها «در دسترس نیست» نشان داده می‌شوند. یک بار اصلاحشان کنید (فقط فایل‌ها تغییر
می‌کنند، API می‌تواند روشن بماند و اجرای دوباره بی‌ضرر است):

</div>

```bash
cd backend && npm run hls:frame-rate        # با -- --dry-run فقط فهرست را نشان می‌دهد
```

<div dir="rtl">

هر فیلم تا آماده شدن نسخهٔ HLS خود، به‌صورت MP4 پخش می‌شود.

برای **خاموش کردن** مبدل کاری روی سرور لازم نیست: گزینهٔ **MP4** را انتخاب کنید. ffmpeg
می‌تواند نصب بماند؛ فقط وقتی HLS انتخاب شده باشد به کار می‌رود.

### ۷. رفع اشکال

| نشانه | علت / راه‌حل |
| --- | --- |
| «تنظیمات ویدئو» در منو نیست | پس از به‌روزرسانی `npm run seed` اجرا نشده، یا گروه شما مجوز «تنظیمات» را ندارد. |
| گزینهٔ HLS غیرفعال است | ffmpeg نصب نیست، یا پس از نصب آن API دوباره راه‌اندازی نشده است. |
| بارگذاری رد شد: «Unsupported file type … Allowed: video/mp4, video/webm» | حالت MP4 فقط MP4 و WebM می‌پذیرد. فایل را تبدیل کنید یا HLS را انتخاب کنید. |
| بارگذاری با خطای **503** «ffprobe is not installed» رد شد | HLS انتخاب شده و ffmpeg بعداً حذف شده است. آن را نصب کنید یا MP4 را انتخاب کنید. |
| فیلمی مدت زیادی «در حال تبدیل» می‌ماند | برای فیلم‌های بلند روی پردازندهٔ کم‌هسته طبیعی است (بخش ۳). پیشرفت در پنل مدیریت دیده می‌شود و خطاها با `journalctl -u muvilite-api`. |
| بارگذاری با خطای **413** رد شد | مقدار `client_max_body_size` در سایت پنل مدیریت nginx کم است. |

</div>
