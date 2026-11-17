# نظام تقارير الزيارات الميدانية — نسخة الإنتاج

نظام عربي متكامل (**PWA**) لإدارة تقارير الزيارات الميدانية لمندوبي المبيعات والمديرين، مبني باستخدام React 19، TypeScript، tRPC، Drizzle ORM، وMySQL 8.4، مع تخزين محلي مؤمّن للمرفقات في مجلد `uploads/`.

> **الأمان والإنتاج:** يبدأ التطبيق بإغلاق وضع العرض التجريبي (`DEMO_MODE_ENABLED=false`) افتراضياً، ويرفض التشغيل في بيئة الإنتاج (`NODE_ENV=production`) إذا كان مفتاح `JWT_SECRET` ضعيفاً أو قصيراً، أو إذا غاب حساب المدير الأولي، أو إذا فُعّل الوضع التجريبي. تغيير كلمة المرور أو إعادة تعيينها يُبطل جلسات ذلك الحساب.

## المتطلبات

- Node.js 20 أو أحدث (يُوصى بـ Node 22 LTS)
- pnpm 10 أو أحدث
- MySQL 8.4 (أو MariaDB متوافق) محلياً أو عبر Docker Compose

## التشغيل السريع للتطوير المحلي

1. انسخ ملف البيئة النموذجي واضبط المتغيرات في `.env`:
   ```bash
   cp env.template .env
   ```
2. شغّل قاعدة البيانات وثبّت الحزم:
   ```bash
   docker compose --profile dev up -d db
   pnpm install
   pnpm db:migrate
   ```
3. شغّل الخادم المحلي:
   ```bash
   pnpm dev
   # أو على Windows داخل مجلدات OneDrive إذا علقت المراقبة:
   pnpm dev:server
   ```

افتح `http://localhost:3000`. لإجراء تجربة سريعة في بيئة التطوير فقط (عند عدم وجود حسابات)، يمكنك ضبط `DEMO_MODE_ENABLED=true` في `.env` المحلي.

## المتغيرات البيئية الأساسية

| المتغير | الغرض |
|---|---|
| `DATABASE_URL` | رابط اتصال MySQL / MariaDB للتطوير على الجهاز. داخل Docker يُستبدل بعنوان خدمة `mysql` |
| `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` | كلمتا مرور القاعدة. الإنتاج يرفض التشغيل إذا غابتا |
| `DB_POOL_SIZE` | الحد الأقصى لعدد الاتصالات في تجمع القاعدة (الافتراضي `10`) |
| `JWT_SECRET` | مفتاح توقيع الجلسات (**إلزامي بطول 32+ حرفاً عشوائياً في الإنتاج**) |
| `NODE_ENV` | `development` محلياً و`production` على الخادم الحي |
| `PORT` | منفذ خادم Node (الافتراضي `3000`). في الإنتاج يتوقف التشغيل إذا كان المنفذ مشغولاً |
| `UPLOAD_DIR` | مسار مجلد حفظ صور الزيارات (محمي بصلاحيات الجلسة) |
| `TRUST_PROXY` | `1` فقط خلف Nginx أو Caddy. حاوية الإنتاج تضبطه بنفسها |
| `APP_TIMEZONE` | المنطقة الزمنية لحدود شهر المؤشرات (الافتراضي `Asia/Riyadh`) |
| `SITE_ADDRESS` | اسم النطاق العام لخدمة Caddy في الإنتاج |
| `DEMO_MODE_ENABLED` | `false` افتراضياً؛ يُسمح بتفعيله محلياً فقط ويُحظر في الإنتاج |
| `INITIAL_ADMIN_OPENID` / `INITIAL_ADMIN_PASSWORD` / `INITIAL_ADMIN_EMAIL` | بيانات المدير الأولي. في الإنتاج يجب ضبط اسم المستخدم وكلمة المرور صراحة، ولا يُستخدم اسم `admin` إلا إذا كُتب في `INITIAL_ADMIN_OPENID` |

## النشر والإنتاج

### Coolify على track.sindean.com مع Cloudflare
1. في Cloudflare أضف سجل `A` للاسم `track` يشير إلى عنوان الـ VPS، مع تفعيل البروكسي (السحابة البرتقالية).
2. اضبط SSL/TLS على **Full**. لا تستخدم **Flexible**، لأنه يسبب حلقة تحويل بين Cloudflare وCoolify ويمنع كعكة الجلسة الآمنة.
3. فعّل Always Use HTTPS. أوقف Rocket Loader وEmail Address Obfuscation لهذا النطاق حتى لا ينكسر تطبيق React.
4. في Coolify: New Resource ثم Docker Compose، واختر المستودع والملف [docker-compose.coolify.yml](docker-compose.coolify.yml).
5. بعد الحفظ، افتح مكوّن `app` واضبط النطاق على `https://track.sindean.com`. لا تعطِ نطاقاً لخدمة `mysql`.
6. انشر. إذا فشل إصدار الشهادة على المصدر، حوّل السجل مؤقتاً إلى DNS only ثم أعد النشر، وبعد نجاح الشهادة أعد السحابة البرتقالية وبدّل التشفير إلى **Full (strict)**.
7. كلمات مرور القاعدة والمدير و`JWT_SECRET` تُولَّد في Environment Variables؛ انسخ `INITIAL_ADMIN_PASSWORD` من هناك. الدخول باسم `admin`.
8. الصور تبقى في المجلد الدائم `field_visits_uploads`. لا تحذف هذا المجلد عند إعادة النشر.

### الخيار الأول: النشر عبر PM2 على خادم Linux (Ubuntu / Nginx)
1. ضبط ملف `.env` الإنتاجي بقيم آمنة و`NODE_ENV=production` و`TRUST_PROXY=1` و`INITIAL_ADMIN_OPENID` و`INITIAL_ADMIN_PASSWORD`.
2. استخدام السكريبت [deploy.sh](deploy.sh) الذي ينفذ تلقائياً: فحص الأنواع `pnpm run check`، الاختبارات `pnpm test`، ترحيل القاعدة `pnpm db:migrate`، البناء `pnpm build`، إعادة التحميل عبر PM2، والتحقق من نقطة الفحص `GET /api/health`.
3. ضبط Nginx كـ Reverse Proxy مع شهادة SSL (**HTTPS** إلزامي لعمل الكاميرا والـ GPS وتثبيت PWA في الهواتف):

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

لا تفتح منفذ MySQL على الشبكة العامة. التطبيق نسخة واحدة لأن الصور تُحفظ على قرص الخادم.

### الخيار الثاني: النشر بالحاويات (Docker Compose Production)
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
يشغّل قاعدة البيانات **بدون منفذ على المضيف**، وحالة التطبيق، وCaddy على 80/443 حسب [deploy/Caddyfile](deploy/Caddyfile). عيّن `SITE_ADDRESS` و`MYSQL_PASSWORD` و`MYSQL_ROOT_PASSWORD` حتى يرفض Compose الإقلاع إذا غابت. Caddy يصدر الشهادة ويمرر `X-Forwarded-Proto`. لا تشغّل قاعدة التطوير (`--profile dev`) مع هذا الملف في الوقت نفسه.

عند الإقلاع تنفّذ الحاوية ترحيل Drizzle ثم تشغّل Node. فحص الصحة يستخدم `node` للوصول إلى `GET /api/health`.

### النسخ الاحتياطي
على خادم Linux الذي تتوفر فيه `mysqldump`:

```bash
chmod +x scripts/backup.sh
# يومياً الساعة 02:15
# 15 2 * * * cd /opt/sales-visits && ./scripts/backup.sh
```

ينشئ `backups/db-<utc>.sql.gz` و`backups/uploads-<utc>.tar.gz`. انسخ المجلدين إلى تخزين خارج الخادم. للاستعادة:

```bash
gunzip -c backups/db-STAMP.sql.gz | mysql -h 127.0.0.1 -u fieldvisits -p field_visits
tar -xzf backups/uploads-STAMP.tar.gz -C /opt/sales-visits
```

## الاختبارات وفحص الجودة
```bash
pnpm run check   # فحص TypeScript
pnpm test        # تشغيل اختبارات Vitest
pnpm run build   # بناء واجهة الإنتاج وخادم Node
```
