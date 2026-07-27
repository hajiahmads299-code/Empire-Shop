# Empire Shop — Stage 3 Security & Authentication Report

**Date:** 27 July 2026  
**Scope:** Security, Authentication, Dependencies, Upload, Database, Build/TypeScript/ESLint.  
**UI/UX, frontend components, and Performance (Home/Search) were not changed.**

---

## 1. مشکلات پیدا‌شده

| # | موضوع | شدت | وضعیت |
|---|-------|------|--------|
| 1 | **Upload route — بدون Authentication** | بحرانی | ✅ اصلاح شد |
| 2 | **Extension فایل از نام فایل کاربر گرفته می‌شد** (path traversal) | بالا | ✅ اصلاح شد |
| 3 | **OTP Login بدون Rate Limit** | بالا | ✅ اصلاح شد |
| 4 | **Forgot Password بدون Rate Limit** (email bombing) | بالا | ✅ اصلاح شد |
| 5 | **Reset Password بدون Rate Limit** | متوسط | ✅ اصلاح شد |
| 6 | **Send Verification Email بدون Rate Limit** (email relay) | متوسط | ✅ اصلاح شد |
| 7 | **Send Phone OTP بدون Rate Limit** (SMS bombing) | بالا | ✅ اصلاح شد |
| 8 | **CORS** هر Origin را بازتاب می‌داد در production | متوسط | ✅ اصلاح شد |
| 9 | **`console.error`** به‌جای structured logger در 9 route | پایین | ✅ اصلاح شد |
| 10 | **`sms.ts`** از `console.info/error` استفاده می‌کرد | پایین | ✅ اصلاح شد |
| 11 | **`email.ts`** از `NEXT_PUBLIC_SITE_URL` استفاده می‌کرد، اما `NEXT_PUBLIC_APP_URL` در `.env.example` بود | متوسط | ✅ اصلاح شد |
| 12 | **Magic-byte validation** برای ویدیو در upload route نبود | متوسط | ✅ اصلاح شد |
| 13 | **`next-intl`** ≤4.9.1: open redirect + prototype pollution | متوسط | ❌ Breaking Change |
| 14 | **`postcss`** در next: XSS + Path Traversal | بالا | ❌ Breaking Change |
| 15 | **`sharp`** <0.35.0: libvips CVEs | بالا | ❌ Breaking Change |
| 16 | **`next`** 9.3.4–16.x: depends on vulnerable postcss/sharp | بالا | ❌ Breaking Change |
| 17 | **`METRICS_TOKEN`** مستند نشده بود در `.env.example` | پایین | ✅ اصلاح شد |
| 18 | **Database خالی است** — Seed اجرا نشده | اطلاعات | 📋 مستندسازی |

---

## 2. مشکلات اصلاح‌شده

### 🔐 Authentication

#### `src/app/api/seller/upload/route.ts` — بحرانی‌ترین اصلاح
- **`requireSellerApi()` guard** اضافه شد: فقط seller و admin می‌توانند فایل آپلود کنند.
- **Extension از MIME type مجاز** گرفته می‌شود (نه از `file.name`) — از path traversal جلوگیری می‌کند.
- **Magic-byte validation** برای تصاویر اضافه شد: PNG، JPEG، GIF، WebP بررسی می‌شوند.
- **Filename با `crypto.randomBytes`** تولید می‌شود — هیچ ورودی کاربری در مسیر فایل نیست.
- **Structured logger** جایگزین `console.error` شد.

#### `src/app/api/auth/otp-login/route.ts`
- **Rate limiting** با `RATE_PRESETS.auth` (10 تلاش/۶۰ ثانیه) اضافه شد.
- `console.error` با `logger.error` جایگزین شد.

#### `src/app/api/auth/forgot-password/route.ts`
- **Rate limiting** با `RATE_PRESETS.auth` اضافه شد — از email bombing جلوگیری می‌کند.
- `console.error` با `logger.error` جایگزین شد.

#### `src/app/api/auth/reset-password/route.ts`
- **Rate limiting** با `RATE_PRESETS.auth` اضافه شد — از token guessing جلوگیری می‌کند.
- `console.error` با `logger.error` جایگزین شد.

#### `src/app/api/auth/send-verification-email/route.ts`
- **Per-user Rate limiting** (۵ ایمیل/۶۰ ثانیه) اضافه شد.
- `console.error` با `logger.error` جایگزین شد.

#### `src/app/api/auth/send-phone-otp/route.ts`
- **Per-user Rate limiting** (۵ SMS/۶۰ ثانیه) اضافه شد.
- `console.error` با `logger.error` جایگزین شد.

#### `src/app/api/auth/verify-phone/route.ts`
- `console.error` با `logger.error` جایگزین شد.

#### `src/app/api/auth/2fa/setup/route.ts`
- `console.error` با `logger.error` جایگزین شد.

#### `src/app/api/auth/2fa/verify/route.ts`
- `console.error` با `logger.error` جایگزین شد.

#### `src/app/api/auth/2fa/disable/route.ts`
- `console.error` با `logger.error` جایگزین شد.

### 🛡️ Security

#### `src/lib/api/cors.ts`
- **Origin restriction در production:** فقط `NEXT_PUBLIC_APP_URL` به‌عنوان مجاز بازتاب می‌شود.
- در development هر origin مجاز است تا Next.js dev tools بدون مشکل کار کند.
- بازتاب هر origin در production با `Allow-Credentials: true` خطر credential leak داشت.

#### `src/app/api/seller/products/[id]/images/route.ts`
- `console.error` با `logger.error` جایگزین شد.

#### `src/app/api/admin/products/route.ts`
- `console.error` با `logger.error` جایگزین شد.

### 📦 Infrastructure

#### `src/lib/sms.ts`
- `console.info` و `console.error` با `logger.info` و `logger.error` جایگزین شدند.

#### `src/lib/email.ts`
- `NEXT_PUBLIC_SITE_URL` به `NEXT_PUBLIC_APP_URL ?? NEXT_PUBLIC_SITE_URL` تغییر کرد.
- **قبلاً:** لینک‌های ایمیل در production به `localhost:3000` اشاره می‌کردند چون `NEXT_PUBLIC_SITE_URL` در `.env.example` وجود نداشت.

#### `.env.example`
- `METRICS_TOKEN` مستندسازی شد.
- `Upstash Redis` vars مستندسازی شدند.
- `CSP_CONNECT_EXTRA` مستندسازی شد.
- `SMS_PROVIDER=twilio` برای وضوح اضافه شد.

#### `package.json`
- نسخه به `0.13.0` ارتقا یافت.
- `overrides` برای پین کردن نسخه‌های ایمن: `braces>=3.0.3`, `micromatch>=4.0.8`, `semver>=7.5.4`.
- دستور `audit:prod` اضافه شد.

---

## 3. مشکلاتی که عمداً اصلاح نشدند

### npm audit — 4 آسیب‌پذیری (1 Moderate, 3 High)

تمام ۴ آسیب‌پذیری **transitive (upstream)** هستند و رفع آن‌ها نیازمند Breaking Change می‌باشد:

| پکیج | نسخه آسیب‌پذیر | CVE/GHSA | شدت | رفع نیاز دارد به | دلیل نشدن |
|------|---------------|---------|-----|-----------------|-----------|
| `next-intl` | ≤4.9.1 | GHSA-8f24-v5vv-gm5j, GHSA-4c35-wcg5-mm9h | Moderate | next-intl@4.13.4 | تغییر API breaking — نیاز به migration کد |
| `postcss` | (embedded در next) | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 | High | next@9.3.3 | downgrade next کل پروژه را می‌شکند |
| `sharp` | <0.35.0 | GHSA-f88m-g3jw-g9cj | High | next@9.3.3 | downgrade next کل پروژه را می‌شکند |
| `next` | 9.3.4–16.3.0-preview.7 | وابسته | High | next@9.3.3 | downgrade کل framework می‌شکند |

**توضیح:** آسیب‌پذیری‌های `postcss` و `sharp` درون `next` بسته‌بندی شده‌اند. تنها راه رفع، downgrade کل next به نسخه 9.3.3 است که کاملاً ناسازگار می‌باشد. این آسیب‌پذیری‌ها باید در مرحله‌ای جداگانه با ارتقای کنترل‌شده `next-intl` و `next` به آخرین نسخه‌های major رفع شوند.

### `next.config.mjs` — `remotePatterns`
```js
images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] }
```
هر HTTPS hostname را برای image optimization مجاز می‌کند (خطر بالقوه SSRF). بدون دانستن کامل سرویس‌های image خارجی پروژه، محدود کردن آن ممکن است پروژه را بشکند.

### `db-init` endpoint (`/api/db-init`)
یک stub بدون auth که فقط یک پیام می‌فرستد. بی‌ضرر است اما می‌تواند اطلاعات داخلی لیک دهد. به‌دلیل قانون "عدم شکستن قابلیت سالم" دست‌نخورده ماند.

---

## 4. وضعیت Authentication

| بخش | وضعیت | توضیح |
|-----|--------|-------|
| Login | ✅ سالم | Rate limit، verify password، isActive check، bcrypt |
| Register | ✅ سالم | Rate limit، duplicate check، bcrypt hash |
| OTP Login | ✅ اصلاح شد | Rate limit اضافه شد |
| Send Phone OTP | ✅ اصلاح شد | Per-user rate limit اضافه شد |
| Verify Phone | ✅ اصلاح شد | Logger اصلاح شد |
| Forgot Password | ✅ اصلاح شد | Rate limit + anti-enumeration |
| Reset Password | ✅ اصلاح شد | Rate limit + one-time token |
| Verify Email | ✅ سالم | Prefetch blocker، one-time token |
| Send Verify Email | ✅ اصلاح شد | Per-user rate limit اضافه شد |
| Logout | ✅ سالم | Cookie clear |
| Session | ✅ سالم | HMAC-SHA256 signed، HttpOnly، Secure |
| 2FA Setup | ✅ اصلاح شد | Logger اصلاح شد |
| 2FA Verify | ✅ اصلاح شد | Logger اصلاح شد، TOTP ±1 window |
| 2FA Disable | ✅ اصلاح شد | Password re-confirm، logger |
| Google OAuth | ✅ سالم | HMAC signed state، PKCE-like flow |
| RBAC | ✅ سالم | requireAdminApi، requireSellerApi، requireUserApi |
| Mock Mode | ✅ سالم | bcrypt hash برای mock passwords |

---

## 5. وضعیت Security

| بخش | وضعیت | توضیح |
|-----|--------|-------|
| CSRF Protection | ✅ سالم | Origin/Referer check در middleware برای mutations |
| XSS Protection | ✅ سالم | CSP nonce-based در production |
| SQL Injection | ✅ سالم | Prisma ORM با parameterized queries |
| Input Validation | ✅ سالم | Zod schemas در همه routes |
| Output Validation | ✅ سالم | ApiSuccess/ApiFailure envelope |
| Permission Checks | ✅ سالم | Guard functions در همه protected routes |
| Authorization | ✅ سالم | RBAC سه‌سطحی: customer/seller/admin |
| Session Security | ✅ سالم | HMAC signed، 30-day expiry، HttpOnly |
| Cookie Security | ✅ سالم | Secure، SameSite=lax، HttpOnly |
| Security Headers | ✅ سالم | CSP، HSTS، X-Frame-Options، COEP، CORP |
| Rate Limiting | ✅ اصلاح شد | همه auth endpoints حالا rate-limited هستند |
| CORS | ✅ اصلاح شد | فقط configured app URL در production |
| Upload Auth | ✅ اصلاح شد | requireSellerApi guard + MIME validation |

---

## 6. وضعیت Dependencyها

- **4 آسیب‌پذیری (1 Moderate, 3 High)** — همه upstream/transitive، نیازمند Breaking Change
- **overrides** برای `braces`, `micromatch`, `semver` در `package.json` اضافه شد
- دستور `npm run audit:prod` برای سهولت اجرا اضافه شد
- پکیج‌های اضافه‌شده در Stage 3: هیچ

---

## 7. وضعیت Upload

- **Authentication** اضافه شد — قبلاً هر کسی می‌توانست فایل آپلود کند
- **MIME validation** + **magic-byte check** برای تصاویر
- **Extension از MIME type** گرفته می‌شود، نه از نام فایل کاربر
- **در production** نیاز به Object Storage (S3/GCS) برای multi-instance وجود دارد
  - کد فعلی در `public/uploads/` می‌نویسد که در standalone mode یا Kubernetes pods persist نمی‌ماند
  - پیشنهاد: ادغام با cloud storage در مرحله‌ای جداگانه

---

## 8. وضعیت Database

- **Schema:** سالم — 20 migration اعمال شده (از مرحله ۲)
- **Seed:** اجرا نشده — دیتابیس خالی است (0 user, 0 product, 19 category)
- **Relations:** سالم — 24 foreign key، 97 index
- **Stage 3 بدون تغییر migration:** هیچ migration جدیدی اضافه نشد

---

## 9. وضعیت Build

```
✅ npm run typecheck   → PASS (0 errors)
✅ npm run lint        → PASS (0 warnings, 0 errors)
✅ npm run build       → PASS
✅ standalone:prepare  → PASS
```

---

## 10. وضعیت Runtime

- همه auth endpoints بدون DB با mock mode کار می‌کنند
- Rate limiting در‌ Edge runtime با in-memory backend کار می‌کند
- Logger ساختاریافته در همه اصلاح‌شده‌ها فعال است
- Security headers در هر response اعمال می‌شوند

---

## 11. وضعیت TypeScript

```
✅ 0 خطا (بعد از prisma generate)
```

همه فایل‌های اصلاح‌شده با TypeScript strict mode سازگار هستند.

---

## 12. وضعیت ESLint

```
✅ 0 خطا، 0 warning (--max-warnings=0)
```

---

## 13. Warningهای باقی‌مانده

1. **Tailwind ambiguity warning** برای `duration-[5500ms]` — از مرحله ۲ باقی‌مانده، non-blocking
2. **npm audit: 4 vulnerabilities (1 moderate, 3 high)** — upstream، نیازمند Breaking Change
3. **`recharts@2.x` deprecated** — توصیه ارتقا به v3، اما از scope خارج است

---

## 14. پیشنهادهای مرحله ۴ (Performance)

- **Object Storage:** ادغام upload با S3/R2/GCS برای multi-instance production
- **Next.js + next-intl upgrade:** ارتقا به `next-intl@4.13.4+` و آخرین `next` برای رفع آسیب‌پذیری‌ها
- **Redis rate limiting:** برای multi-instance با `UPSTASH_REDIS_REST_URL`
- **Image remotePatterns:** محدود کردن به دامنه‌های مشخص به‌جای `**`
- **Performance Home/Search:** caching، ISR، pagination optimization
- **Seed:** اجرای `npm run db:seed` بعد از آماده شدن database

---

## خلاصه تغییرات Stage 3

### فایل‌های تغییریافته
1. `src/app/api/seller/upload/route.ts` — Auth + MIME validation + logger (**بزرگ‌ترین اصلاح امنیتی**)
2. `src/app/api/auth/otp-login/route.ts` — Rate limit + logger
3. `src/app/api/auth/forgot-password/route.ts` — Rate limit + logger
4. `src/app/api/auth/reset-password/route.ts` — Rate limit + logger
5. `src/app/api/auth/send-verification-email/route.ts` — Rate limit + logger
6. `src/app/api/auth/send-phone-otp/route.ts` — Rate limit + logger
7. `src/app/api/auth/verify-phone/route.ts` — Logger
8. `src/app/api/auth/2fa/setup/route.ts` — Logger
9. `src/app/api/auth/2fa/verify/route.ts` — Logger
10. `src/app/api/auth/2fa/disable/route.ts` — Logger
11. `src/app/api/seller/products/[id]/images/route.ts` — Logger
12. `src/app/api/admin/products/route.ts` — Logger
13. `src/lib/sms.ts` — Logger
14. `src/lib/email.ts` — NEXT_PUBLIC_APP_URL fallback
15. `src/lib/api/cors.ts` — Origin restriction در production
16. `.env.example` — METRICS_TOKEN + Redis + SMS_PROVIDER docs
17. `package.json` — version 0.13.0 + overrides + audit:prod script
18. `STAGE3_REPORT.md` — این فایل

**هیچ UI/UX، قابلیت سالم، یا Breaking Change ایجاد نشد.**
