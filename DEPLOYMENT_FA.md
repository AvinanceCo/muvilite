# استقرار MuviLite روی یک سرور

[English](DEPLOYMENT.md)

با Docker Compose، سایت عمومی، پنل مدیریت، API، MongoDB و Caddy روی یک سرور لینوکسی اجرا می‌شوند. Caddy سایت و پنل را روی دو دامنهٔ جداگانه با HTTPS ارائه می‌دهد. هر دو از مسیرهای `/api/` و `/uploads/` روی دامنهٔ خود به API و رسانه‌ها دسترسی دارند. پورت‌های API و پایگاه داده روی میزبان منتشر نمی‌شوند. داده‌های MongoDB و رسانه‌های بارگذاری‌شده روی فضای ذخیره‌سازی پایدار می‌مانند. فایل‌های ساخت تصویر در پوشه‌های [بک‌اند](backend/Dockerfile)، [فرانت‌اند](frontend/Dockerfile) و [پنل مدیریت](admin/Dockerfile) قرار دارند.

## ۱. آماده‌سازی سرور

- از لینوکس ۶۴ بیتی، مانند Ubuntu 24.04 LTS، استفاده کنید. روی x86-64، MongoDB به AVX نیاز دارد. برای نصب کوچک، ۲ هستهٔ مجازی و ۴ گیگابایت رم در نظر بگیرید. برای تبدیل منظم ویدئو، ۴ هسته یا بیشتر و ۸ گیگابایت رم مناسب‌تر است. برای رسانه‌ها، بارگذاری‌های جاری و پشتیبان‌ها فضای کافی بگذارید.
- Docker Engine نسخهٔ ۲۸ یا جدیدتر و افزونهٔ Compose را نصب کنید. Git و OpenSSL هم لازم‌اند. نصب را با `sudo docker version` و `sudo docker compose version` بررسی کنید. دستورها را در Bash و با حسابی اجرا کنید که به Docker دسترسی دارد. [راهنمای رسمی نصب Docker در اوبونتو](https://docs.docker.com/engine/install/ubuntu/)
- برای انتشار عمومی، دو رکورد DNS از نوع A به IPv4 عمومی سرور اضافه کنید. پورت‌های ورودی TCP 80 و 443 را در فایروال باز کنید و در صورت نیاز، روی روتر به سرور هدایت کنید. UDP 443 برای HTTP/3 اختیاری است. فقط اگر دسترسی IPv6 را هم تنظیم کرده‌اید رکورد AAAA اضافه کنید.
- ساخت تصویرها به دسترسی خروجی به Docker Hub، npm و مخازن بسته‌های Debian نیاز دارد. برای HTTPS عمومی، دسترسی خروجی به مرجع صدور گواهی هم لازم است.
- پورت‌های ۸۰ و ۴۴۳ را برای Caddy آزاد کنید. اگر سرویس دیگری از این پورت‌ها استفاده می‌کند، ابتدا مشخص کنید کدام سرویس ورودی عمومی را در اختیار خواهد داشت.

```bash
git clone https://github.com/AvinanceCo/muvilite.git
cd muvilite
```

## ۲. تنظیم و مقداردهی اولیه

فایل `.env` را در ریشهٔ مخزن بسازید. سه مقدار تصادفیِ متفاوت تولید کنید و در سه فیلد خالی قرار دهید. برای `MONGO_APP_PASSWORD` از مقدار هگزادسیمال استفاده کنید، چون این رمز در نشانی اتصال MongoDB قرار می‌گیرد.

```bash
umask 077
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
nano .env
```

| تنظیم | کاربرد |
| --- | --- |
| `MONGO_ROOT_PASSWORD` | رمز حساب مدیریتی MongoDB. |
| `MONGO_APP_PASSWORD` | رمز حساب API با دسترسی محدود به پایگاه دادهٔ `muvilite`. |
| `JWT_SECRET` | کلید امضای نشست‌های مدیران. تغییر آن باعث خروج از حساب می‌شود. |
| `FRONTEND_SITE` و `ADMIN_SITE` | نشانی دقیق سایت و پنل، همراه `http://` یا `https://` و بدون اسلش پایانی. برای بررسی نخست، مقادیر نمونه را نگه دارید. |
| `BIND_ADDRESS` | برای بررسی نخست مقدار `127.0.0.1` را نگه دارید. |
| `ENABLE_CRON` و `WATCH_TREND_CRON` | زمان‌بندی محاسبهٔ روند تماشا بر اساس ساعت UTC. |

MongoDB حساب‌ها را هنگام اولین راه‌اندازی با فضای خالی ایجاد می‌کند. برای تغییر رمز در نصب موجود، ابتدا خود MongoDB و سپس `.env` را به‌روز کنید.

تصویرها را بسازید و MongoDB را اجرا کنید. برای مدیر اولیه، یک شمارهٔ موبایل و رمز قوی وارد کنید. رمز هنگام تایپ نمایش داده نمی‌شود.

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

منتظر پیام `Seed complete` بمانید. این دستور داده‌های پایه، از جمله نظرسنجی نمونه و صفحه‌های اولیه، را هم ایجاد می‌کند. اجرای دوباره برای همان حساب، رمز مدیر را تغییر نمی‌دهد.

## ۳. بررسی محلی و انتشار عمومی

سرویس‌ها را بالا بیاورید و این دستورها را روی سرور اجرا کنید. نشانی‌های نمونه برای بررسی محلی با HTTP هستند. از Docker Engine نسخهٔ ۲۸ یا جدیدتر استفاده کنید تا پورت‌های منتشرشده روی لوپ‌بک فقط از میزبان در دسترس باشند. [راهنمای انتشار پورت در Docker](https://docs.docker.com/engine/network/port-publishing/)

```bash
docker compose up -d --wait --wait-timeout 180
docker compose ps
curl -fsS -H 'Host: muvilite.localhost' http://127.0.0.1/api/health
curl -fsS -o /dev/null -H 'Host: admin.muvilite.localhost' http://127.0.0.1/
```

درخواست اول باید پاسخ JSON با `"status":"ok"` برگرداند. پس از آماده‌شدن DNS و فایروال، سه خط زیر را در `.env` با اطلاعات واقعی جایگزین کنید. Caddy گواهی‌های HTTPS را خودکار دریافت و تمدید می‌کند. [راهنمای HTTPS خودکار Caddy](https://caddyserver.com/docs/automatic-https)

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

به پنل مدیریت وارد شوید، یک ویدئوی کوچک بارگذاری کنید و پخش آن را از سایت عمومی بررسی کنید. تصویر بک‌اند ffmpeg و ffprobe را دارد. از پنل می‌توانید MP4 یا HLS را انتخاب کنید. پردازش HLS در پس‌زمینه انجام می‌شود. سقف پیش‌فرض ویدئو ۲ گیبی‌بایت است و Nginx پنل برای سربار درخواست بارگذاری هم ظرفیت دارد. برای تغییر سقف، مقدار `MAX_VIDEO_UPLOAD_SIZE_MB` را در `.env` تنظیم کنید. مقدار `client_max_body_size` در [admin/nginx.conf](admin/nginx.conf) باید کمی بیشتر باشد تا سربار درخواست جا شود. تصویرها و سرویس‌های مربوط را دوباره بسازید و اجرا کنید.

## ۴. نگهداری و به‌روزرسانی

```bash
docker compose ps
docker compose logs --tail=100 mongo backend frontend admin caddy
```

پیش از به‌روزرسانی، پشتیبان بگیرید. بعد از دریافت تغییرات، تصویرها را بازسازی کنید و دوباره HTTPS را بررسی کنید. نام پروژهٔ Compose را ثابت نگه دارید تا سرویس‌ها از همان فضای ذخیره‌سازی استفاده کنند.

```bash
git pull --ff-only
docker compose pull mongo caddy
docker compose build --pull
docker compose up -d --wait --wait-timeout 180
```

برای تغییر نسخهٔ اصلی MongoDB، راهنمای ارتقای آن را بررسی کنید. اجرای عادی `docker compose down` داده‌ها را حفظ می‌کند. گزینهٔ `-v` فضای ذخیره‌سازی پایگاه داده و رسانه‌ها را حذف می‌کند.

## ۵. پشتیبان‌گیری و بازیابی

از پایگاه داده و رسانه‌ها با هم پشتیبان بگیرید. دستور زیر نوشتن از طریق API را موقتاً متوقف می‌کند و پس از خروج، API را دوباره راه می‌اندازد. دستور را از ریشهٔ مخزن اجرا کنید و یک نسخهٔ رمزگذاری‌شده از فایل‌ها و `.env` را خارج از سرور نگه دارید.

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

بازیابی را در یک نصب تازه با فضای ذخیره‌سازی خالی، نسخه‌های سازگار برنامه و MongoDB و فایل `.env` آماده انجام دهید. مرحلهٔ مقداردهی اولیهٔ برنامه را رد کنید. هر دو فایل را از یک نوبت پشتیبان‌گیری بردارید. این فرمان‌ها برای میزبانی در نظر گرفته شده‌اند که به این نصب اختصاص دارد.

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

پس از بازیابی، ورود یکی از مدیران موجود و پخش رسانه‌های بازیابی‌شده را بررسی کنید.

## رفع اشکال

| نشانه | بررسی |
| --- | --- |
| MongoDB آماده نمی‌شود | لاگ `docker compose logs mongo`، قابلیت پردازنده، فضای دیسک و تطابق رمز با داده‌های موجود را بررسی کنید. |
| خطای 502 | خروجی `docker compose ps` و `docker compose logs --tail=100 backend caddy` را بررسی کنید. |
| دریافت گواهی HTTPS ناموفق است | DNS عمومی، دسترسی ورودی TCP 80/443 و لاگ Caddy را بررسی کنید. |
| ورود پس از مقداردهی اولیه ناموفق است | شمارهٔ مدیر و رمز عبور را بررسی کنید. رمز حساب موجود با مقداردهی دوباره عوض نمی‌شود. |
| خطای 413 هنگام بارگذاری | اندازهٔ فایل را با سقف API، Nginx و هر پراکسی جلوی Caddy مقایسه کنید. |
| توقف پردازش HLS | وضعیت کار در پنل، لاگ بک‌اند، فضای آزاد و بار پردازنده را بررسی کنید. |

[روش نصب دستی روی اوبونتو](DEPLOY-SERVER.md) به زبان انگلیسی در دسترس است.
