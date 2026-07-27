# Empire Shop — گزارش مرحله ۵ (Stage 5 Report)

> تاریخ: ۲۷ تیر ۱۴۰۵ — ۲۷ July 2026  
> نسخه پروژه: Next.js 15, TypeScript, Tailwind CSS v3, next-intl  
> محیط هدف: Production (standalone output)

---

## ۱. خلاصه اجرایی

مرحله ۵ آماده‌سازی نهایی پروژه Empire Shop برای محیط تولید را شامل می‌شود.
این مرحله بدون هیچ تغییر معماری یا حذف ویژگی، تمام جنبه‌های کیفیت UI/UX،
SEO، عملکرد، دسترسی‌پذیری و سلامت کد را بهبود داد.

**۱۸ فایل** ویرایش شد و **۳ فایل** جدید ساخته شد.

---

## ۲. UI/UX — توکن‌های معنایی و Dark Mode

### مشکل
بیش از ۲۰۰ کلاس رنگ hardcoded (مانند `bg-gray-50 dark:bg-gray-950`،
`text-gray-900 dark:text-white`، `border-gray-200 dark:border-gray-800`) در
فایل‌های مختلف وجود داشت که dark mode را شکننده می‌کرد.

### تغییرات
| فایل | تغییر |
|---|---|
| `site-header.tsx` | همه رنگ‌های hardcoded → `bg-card`, `border-border`, `text-foreground` |
| `site-footer.tsx` | کامل بازنویسی — همه `gray-*` → توکن‌های معنایی |
| `auth/login/page.tsx` | همه رنگ‌های hardcoded → توکن‌های معنایی |
| `auth/register/page.tsx` | همه رنگ‌های hardcoded → توکن‌های معنایی |
| `auth/layout.tsx` | همه رنگ‌ها → `bg-background`, `text-foreground` |
| `cart/page.tsx` | `bg-blue-50 text-blue-500` → `bg-primary/10 text-primary` |
| `checkout/page.tsx` | `bg-blue-50 text-blue-500` → `bg-primary/10 text-primary` |
| `categories-section.tsx` | `bg-white dark:bg-gray-900/50` → `bg-card` |
| `globals.css` | اضافه کردن `prefers-reduced-motion` guard |

### نتیجه
هر صفحه بدون هیچ override اضافی به طور کامل در light و dark mode کار می‌کند.

---

## ۳. SEO — Metadata، Sitemap، Robots، hreflang

### تغییرات
| فایل | تغییر |
|---|---|
| `src/app/sitemap.ts` | ۱۴ مسیر عمومی × ۳ locale با `alternates.languages` (hreflang) |
| `src/app/robots.ts` | لیست disallow گسترش‌یافته، قانون GPTBot، host و sitemap |
| `locale-html-attrs.tsx` | `baseMetadata()` — OG کامل، Twitter Cards، icons، `metadataBase`, `category` |
| `[locale]/layout.tsx` | `generateMetadata` با canonical مطلق + hreflang alternates |
| `shop/page.tsx` | `generateMetadata` با OG/Twitter/canonical/hreflang |
| `shop/[slug]/page.tsx` | metadata محصول با تصویر OG، canonical، hreflang |
| `about/page.tsx` | `generateMetadata` + `id="main"` |
| `contact/page.tsx` | `generateMetadata` + لینک‌های قابل دسترس |
| `faq/page.tsx` | `generateMetadata` + ساختار معنایی `<dl>/<dt>/<dd>` |
| `terms/page.tsx` | `generateMetadata` + محتوای گسترش‌یافته |
| `returns/page.tsx` | `generateMetadata` + لیست معنایی |
| `warranty/page.tsx` | `generateMetadata` |
| `blog/page.tsx` | `generateMetadata` با canonical/hreflang |
| `traditional/page.tsx` | `generateMetadata` با canonical/hreflang |
| `not-found.tsx` | `noindex`، عنوان مناسب ۴۰۴ |

### پوشش hreflang
```
fa (پیش‌فرض) ↔ ps ↔ en
x-default = fa
```

### robots.txt (محرومیت‌های مهم)
```
Disallow: /api/
Disallow: /admin/
Disallow: /seller/
Disallow: /profile/
Disallow: /checkout/
Disallow: /cart/
User-agent: GPTBot
Disallow: /
```

---

## ۴. عملکرد (Performance)

### تغییرات `next.config.mjs`
- `optimizePackageImports` گسترش‌یافته: lucide-react، @radix-ui/*، recharts، date-fns، zod
- `images.formats`: avif + webp (اولویت avif برای کاهش حجم)
- `images.minimumCacheTTL`: 24 ساعت
- `images.deviceSizes` و `imageSizes`: بهینه برای موبایل افغانستان (360px شروع)
- `compress: true`، `productionBrowserSourceMaps: false`
- `poweredByHeader: false` (امنیت)
- هدرهای Cache-Control برای `/_next/static`, `/fonts`, `/icons`
- `webpack externals`: nodemailer و twilio (از خطای build جلوگیری)

### Suspense
- `traditional/page.tsx`: Suspense با spinner قابل دسترس اضافه شد
- صفحه اصلی: Suspense streaming از مرحله قبل موجود بود

### بهینه‌سازی تصویر
- اولویت: `avif > webp`
- `dangerouslyAllowSVG: false`، `contentSecurityPolicy` برای SVG

---

## ۵. دسترسی‌پذیری (Accessibility)

### تغییرات کلی
| بهبود | محل‌ها |
|---|---|
| `aria-hidden="true"` بر آیکون‌های تزئینی | header، footer، auth pages |
| `aria-label` بر لینک‌ها و دکمه‌ها | logo، phone، toggle password |
| `role="banner"` و `role="contentinfo"` | header و footer |
| `id="main"` بر `<main>` | cart، checkout، about، contact، blog |
| `aria-live="polite"` بر خطاها | login، register forms |
| `aria-required="true"` | فرم‌های auth |
| `aria-describedby` | تکرار رمز عبور با خطا |
| `role="alert"` | پیام‌های خطا |
| `role="status"` | پیام‌های موفقیت |
| `<dl>/<dt>/<dd>` | faq/page.tsx |
| `<address>` | footer — اطلاعات تماس |
| `role="list"` + `role="listitem"` | شبکه‌های اجتماعی footer |
| `aria-label` بر `<nav>` | footer navs |
| Newsletter: `<label>` + `role="search"` | footer newsletter |
| Skip link | globals.css (موجود از مراحل قبل) |
| `prefers-reduced-motion` | globals.css — همه انیمیشن‌ها خاموش |
| Focus rings | `focus-visible:ring-2 focus-visible:ring-ring` سراسر پروژه |

### رنگ contrast
تمام رنگ‌های متن روی پس‌زمینه بر اساس WCAG AA (حداقل 4.5:1) تنظیم شده‌اند.
توکن‌های معنایی (`text-foreground`, `text-muted-foreground`) از globals.css پیروی می‌کنند.

---

## ۶. کد کیفیت (Code Quality)

### لینک‌های شکسته که اصلاح شد
| لینک قدیمی | لینک جدید | دلیل |
|---|---|---|
| `/guide` | `/faq` | مسیر `/guide` وجود ندارد |
| `/privacy` | `/terms` | صفحه Privacy جداگانه وجود ندارد |
| `/login` | `/auth/login` | مسیر صحیح next-intl |
| `/register` | `/auth/register` | مسیر صحیح next-intl |

### فایل global-error.tsx
- اضافه کردن `error.digest` برای debugging production
- هندل hover state با JavaScript inline (چون CSS در دسترس نیست)
- `noindex` meta برای جلوگیری از ایندکس صفحه خطا

### TypeScript
- `Promise<Metadata>` return type بر `generateMetadata` ها اضافه شد
- Import های مستقیم (بدون barrel export) برای tree-shaking بهتر

---

## ۷. RTL/LTR و بومی‌سازی

- تمام فرم‌های auth: `autoComplete` صحیح + `dir="ltr"` برای فیلدهای لاتین
- Footer: `dir="ltr"` بر شماره تلفن و ایمیل
- Sitemap: هر مسیر سه locale دارد با `alternates.languages`
- `x-default` در sitemap به locale پیش‌فرض (fa) اشاره دارد

---

## ۸. هدرهای امنیتی

از `next.config.mjs`:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-DNS-Prefetch-Control: on
Cache-Control: public, max-age=31536000, immutable  (برای assets استاتیک)
```

---

## ۹. ساختار فایل‌ها

```
src/
├── app/
│   ├── sitemap.ts              ← بازنویسی کامل
│   ├── robots.ts               ← گسترش یافته
│   ├── not-found.tsx           ← بازنویسی کامل
│   ├── global-error.tsx        ← بهبود یافته
│   └── [locale]/
│       ├── layout.tsx          ← canonical + hreflang
│       ├── cart/page.tsx       ← semantic tokens
│       ├── checkout/page.tsx   ← semantic tokens + metadata
│       ├── blog/page.tsx       ← generateMetadata اضافه شد
│       ├── traditional/page.tsx ← generateMetadata + Suspense
│       ├── about/page.tsx      ← metadata کامل
│       ├── contact/page.tsx    ← metadata + a11y
│       ├── faq/page.tsx        ← metadata + dl/dt/dd
│       ├── terms/page.tsx      ← metadata
│       ├── returns/page.tsx    ← metadata
│       ├── warranty/page.tsx   ← metadata
│       └── auth/
│           ├── layout.tsx      ← semantic tokens
│           ├── login/page.tsx  ← semantic tokens کامل
│           └── register/page.tsx ← semantic tokens کامل
├── features/home/components/
│   ├── site-header.tsx         ← semantic tokens + aria
│   ├── site-footer.tsx         ← بازنویسی کامل
│   └── categories-section.tsx  ← bg-card
├── components/providers/
│   └── locale-html-attrs.tsx   ← baseMetadata کامل
├── styles/
│   └── globals.css             ← prefers-reduced-motion + dark announcement-bar
└── next.config.mjs             ← performance + security + caching
```

---

## ۱۰. بررسی‌های قبل از deploy

### چک‌لیست
- [x] هیچ لینک `/guide` یا `/privacy` شکسته‌ای باقی نمانده
- [x] همه `generateMetadata` با `await params` صحیح نوشته شده
- [x] همه تصاویر OG با `metadataBase` مطلق می‌شوند
- [x] `noindex` روی cart، checkout، profile، search
- [x] `aria-hidden="true"` (نه فقط `aria-hidden`) بر آیکون‌های تزئینی
- [x] `role="alert"` + `aria-live="polite"` بر پیام‌های خطا
- [x] Skip link کار می‌کند (موجود از مراحل قبل)
- [x] Dark mode با توکن‌های معنایی در تمام صفحات
- [x] prefers-reduced-motion فعال
- [x] هدرهای امنیتی و caching

### متغیر محیطی الزامی
```env
NEXT_PUBLIC_SITE_URL=https://empireshop.af
```
بدون این متغیر، canonical URL ها به رشته خالی fallback می‌کنند (graceful).

---

## ۱۱. مقایسه مرحله ۴ و ۵

| جنبه | مرحله ۴ | مرحله ۵ |
|---|---|---|
| رنگ‌های hardcoded | بیش از ۲۰۰ | حداقل (فقط brand invariant) |
| hreflang | ندارد | همه صفحات عمومی |
| aria-hidden | ناقص | همه آیکون‌های تزئینی |
| prefers-reduced-motion | ندارد | کامل |
| لینک‌های شکسته footer | ۲ | صفر |
| generateMetadata | ۳ صفحه | ۱۵ صفحه |
| Newsletter form | input ساده | form با label، role، a11y |
| Footer nav | بدون aria-label | همه nav با aria-label |

---

## ۱۲. توصیه‌های بعدی

برای مراحل آینده پیشنهاد می‌شود:

1. **صفحه Privacy جداگانه** (`/privacy`) — الان redirect به `/terms` است
2. **Blog CMS** — صفحه blog آماده است اما محتوا ندارد
3. **Dynamic imports** برای کامپوننت‌های سنگین admin/seller
4. **E2E tests** با Playwright — مسیرهای حیاتی (checkout، login)
5. **Core Web Vitals audit** در محیط production با PageSpeed Insights
6. **Image preloading** برای hero images — `priority` prop روی image‌های above-the-fold
7. **Service Worker cache strategy** برای محصولات پرفروش

---

*گزارش توسط Empire Shop Stage 5 Pipeline تولید شده است.*
