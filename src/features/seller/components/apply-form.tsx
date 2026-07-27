'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Upload, X, CheckCircle2, Clock, AlertCircle, Store,
  ChevronRight, Building2, CreditCard, FileText, Sparkles,
} from 'lucide-react';

interface Application {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  description: string | null;
  logoUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  createdAt: string;
}

interface Props {
  locale: string;
  initialApplication: Application | null;
  canApply: boolean;
}

const STATUS_LABELS = {
  pending: 'در انتظار بررسی',
  approved: 'تأیید شده',
  rejected: 'رد شده',
} as const;

const STATUS_STYLES = {
  pending: {
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    icon: Clock,
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50',
    text: 'text-amber-800 dark:text-amber-300',
  },
  approved: {
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50',
    text: 'text-emerald-800 dark:text-emerald-300',
  },
  rejected: {
    badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50',
    text: 'text-red-800 dark:text-red-300',
  },
} as const;

const BUSINESS_TYPES = [
  'پوشاک و مد',
  'لوازم الکترونیکی',
  'خانه و آشپزخانه',
  'آرایشی و بهداشتی',
  'ورزش و تفریح',
  'کتاب و لوازم تحریر',
  'محصولات سنتی و صنایع دستی',
  'مواد غذایی و خشکبار',
  'زعفران و ادویه‌جات',
  'قالین و فرش',
  'جواهرات و سنگ‌های قیمتی',
  'کودک و نوزاد',
  'خودرو و موتورسیکلت',
  'ابزار و تجهیزات',
  'سایر',
];

const STEPS = [
  { id: 1, label: 'اطلاعات فروشگاه', icon: Building2 },
  { id: 2, label: 'اطلاعات مالی', icon: CreditCard },
  { id: 3, label: 'مدارک و توضیحات', icon: FileText },
];

export function SellerApplyForm({ locale, initialApplication, canApply }: Props) {
  const router = useRouter();
  const [app, setApp] = React.useState<Application | null>(initialApplication);
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [docsNames, setDocsNames] = React.useState<string[]>([]);
  const [form, setForm] = React.useState({
    shopName: '',
    ownerName: '',
    phone: '',
    address: '',
    businessType: '',
    accountNumber: '',
    description: '',
    logoDataUrl: '',
    docsDataUrls: [] as string[],
  });

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('حداکثر حجم لوگو ۲ مگابایت است');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      setForm((f) => ({ ...f, logoDataUrl: dataUrl }));
      setLogoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function onDocsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const oversized = files.filter((f) => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error('حداکثر حجم هر فایل ۵ مگابایت است');
      return;
    }
    const readers = files.map(
      (file) =>
        new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result ?? ''));
          r.readAsDataURL(file);
        }),
    );
    const dataUrls = await Promise.all(readers);
    setForm((f) => ({ ...f, docsDataUrls: [...f.docsDataUrls, ...dataUrls] }));
    setDocsNames((prev) => [...prev, ...files.map((f) => f.name)]);
  }

  function removeDoc(idx: number) {
    setForm((f) => ({ ...f, docsDataUrls: f.docsDataUrls.filter((_, i) => i !== idx) }));
    setDocsNames((prev) => prev.filter((_, i) => i !== idx));
  }

  function goNextStep() {
    if (step === 1) {
      if (!form.shopName.trim() || !form.ownerName.trim() || !form.phone.trim() || !form.businessType) {
        toast.error('لطفاً تمام فیلدهای الزامی مرحله اول را تکمیل کنید');
        return;
      }
      if (!form.address.trim()) {
        toast.error('آدرس فروشگاه الزامی است');
        return;
      }
    }
    setStep((s) => Math.min(s + 1, 3));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goPrevStep() {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.shopName.trim() || !form.ownerName.trim() || !form.phone.trim() || !form.address.trim()) {
      toast.error('لطفاً تمام فیلدهای الزامی را تکمیل کنید');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/seller/applications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          shopName: form.shopName,
          ownerName: form.ownerName,
          phone: form.phone,
          address: form.address,
          description: [
            form.description,
            form.businessType ? `نوع فعالیت: ${form.businessType}` : '',
            form.accountNumber ? `شماره حساب/کیف پول: ${form.accountNumber}` : '',
          ].filter(Boolean).join('\n'),
          logoDataUrl: form.logoDataUrl,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast.error(data?.error?.message ?? 'خطا در ثبت درخواست');
        return;
      }
      toast.success('درخواست شما با موفقیت ثبت شد! ظرف ۲۴ ساعت بررسی خواهد شد.');
      router.refresh();
      setApp({
        id: data.data.id,
        shopName: form.shopName,
        ownerName: form.ownerName,
        phone: form.phone,
        address: form.address,
        description: form.description || null,
        logoUrl: null,
        status: 'pending',
        rejectionReason: null,
        createdAt: new Date().toISOString(),
      });
    } catch {
      toast.error('خطای شبکه — لطفاً دوباره تلاش کنید');
    } finally {
      setBusy(false);
    }
  }

  /* ─── Status view (pending / approved) ─── */
  if (app && (app.status === 'pending' || app.status === 'approved')) {
    const style = STATUS_STYLES[app.status];
    const StatusIcon = style.icon;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950/60 shadow-sm">
            <Store className="h-6 w-6 text-rose-600 dark:text-rose-400" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">درخواست فروشندگی</h1>
            <p className="text-sm text-muted-foreground">وضعیت درخواست شما</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">اطلاعات ثبت‌شده</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${style.badge}`}>
              <StatusIcon className="h-3.5 w-3.5" aria-hidden />
              {STATUS_LABELS[app.status]}
            </span>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <InfoField label="نام فروشگاه" value={app.shopName} />
            <InfoField label="نام صاحب فروشگاه" value={app.ownerName} />
            <InfoField label="شماره تماس" value={app.phone} dir="ltr" />
            <InfoField label="آدرس" value={app.address} full />
            {app.description && <InfoField label="توضیحات" value={app.description} full />}
          </dl>
        </div>

        {/* Status message */}
        <div className={`rounded-2xl border p-4 ${style.bg}`}>
          {app.status === 'approved' ? (
            <div className={`flex items-start gap-3 ${style.text}`}>
              <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-sm">درخواست شما تأیید شد! 🎉</p>
                <p className="text-xs mt-1">
                  اکنون می‌توانید به{' '}
                  <a href={`/${locale}/seller`} className="font-semibold underline">
                    پنل فروشنده
                  </a>{' '}
                  مراجعه کرده و شروع به فروش کنید.
                </p>
              </div>
            </div>
          ) : (
            <div className={`flex items-start gap-3 ${style.text}`}>
              <Clock className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-sm">درخواست در حال بررسی است</p>
                <p className="text-xs mt-1">
                  درخواست شما با موفقیت ثبت شد و توسط تیم ما بررسی می‌شود. معمولاً ظرف ۲۴ ساعت پاسخ می‌دهیم.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const wasRejected = app?.status === 'rejected';

  if (!canApply && !wasRejected) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm text-center py-12">
          <Store className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            شما در حال حاضر امکان ارسال درخواست فروشندگی را ندارید.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 shadow-md text-2xl">
          🏪
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">فروشنده شوید</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            فرم را در ۳ مرحله تکمیل کنید — رایگان و سریع
          </p>
        </div>
      </div>

      {/* Rejection alert */}
      {wasRejected && app?.rejectionReason && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-300">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-red-500" />
          <div>
            <p className="font-bold">درخواست قبلی شما رد شد</p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-400">دلیل: {app.rejectionReason}</p>
            <p className="mt-1.5 text-xs">با اصلاح اطلاعات، درخواست جدیدی ثبت کنید.</p>
          </div>
        </div>
      )}

      {/* Step progress */}
      <div className="mb-6 flex items-center gap-0">
        {STEPS.map((s, i) => {
          const StepIcon = s.icon;
          const isDone = step > s.id;
          const isCurrent = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={[
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                  isDone ? 'border-emerald-500 bg-emerald-500 text-white' :
                  isCurrent ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-600' :
                  'border-border bg-card text-muted-foreground',
                ].join(' ')}>
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <span className={[
                  'text-[10px] font-semibold hidden sm:block',
                  isCurrent ? 'text-rose-600 dark:text-rose-400' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                ].join(' ')}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={[
                  'h-0.5 flex-1 mx-2 mb-4 rounded transition-colors',
                  step > s.id ? 'bg-emerald-400' : 'bg-border',
                ].join(' ')} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Form card */}
      <form onSubmit={step === 3 ? onSubmit : (e) => { e.preventDefault(); goNextStep(); }} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Step 1: Shop Info */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground border-b border-border pb-3 mb-2">
              <Building2 className="h-4 w-4 text-rose-500" />
              اطلاعات فروشگاه
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="نام فروشگاه" required>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="مثلاً: فروشگاه احمد"
                  value={form.shopName}
                  onChange={(e) => update('shopName', e.target.value)}
                  className="input-base"
                />
              </FormField>

              <FormField label="نام صاحب فروشگاه" required>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="نام و نام خانوادگی"
                  value={form.ownerName}
                  onChange={(e) => update('ownerName', e.target.value)}
                  className="input-base"
                />
              </FormField>

              <FormField label="شماره تماس" required>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  pattern="[+()0-9\s\-]+"
                  placeholder="07XXXXXXXX"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className="input-base"
                />
              </FormField>

              <FormField label="نوع فعالیت" required>
                <select
                  required
                  value={form.businessType}
                  onChange={(e) => update('businessType', e.target.value)}
                  className="input-base"
                >
                  <option value="">انتخاب کنید…</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="آدرس فروشگاه" required>
              <textarea
                required
                minLength={5}
                maxLength={500}
                rows={2}
                placeholder="ولایت، شهر، ناحیه، کوچه و نشانی دقیق…"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                className="input-base"
              />
            </FormField>
          </div>
        )}

        {/* Step 2: Financial Info */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground border-b border-border pb-3 mb-2">
              <CreditCard className="h-4 w-4 text-rose-500" />
              اطلاعات پرداخت و تسویه
            </div>

            <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 p-4 text-xs text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">💡 راهنما</p>
              <p>این اطلاعات برای واریز درآمد فروش شما استفاده می‌شود. می‌توانید بعداً از پنل فروشنده ویرایش کنید.</p>
            </div>

            <FormField label="شماره حساب بانکی یا کیف پول (HesabPay)">
              <input
                type="text"
                dir="ltr"
                placeholder="شماره حساب، IBAN یا آدرس HesabPay"
                value={form.accountNumber}
                onChange={(e) => update('accountNumber', e.target.value)}
                className="input-base"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                اگر هنوز حساب ندارید، می‌توانید این قسمت را خالی بگذارید.
              </p>
            </FormField>

            {/* Benefits reminder */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-4">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> مزایای فروشنده بودن در EmpireShop
              </p>
              <ul className="space-y-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                {['تسویه هفتگی درآمد فروش', 'ابزار مدیریت فروش حرفه‌ای', 'پشتیبانی اختصاصی فروشندگان', 'دسترسی به گزارش‌های فروش'].map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Step 3: Documents & Description */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground border-b border-border pb-3 mb-2">
              <FileText className="h-4 w-4 text-rose-500" />
              مدارک و اطلاعات تکمیلی
            </div>

            <FormField label="توضیحات درباره فروشگاه (اختیاری)">
              <textarea
                maxLength={2000}
                rows={3}
                placeholder="درباره محصولات، تجربه و اهداف فروشگاه خود بنویسید…"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                className="input-base"
              />
            </FormField>

            {/* Logo upload */}
            <FormField label="لوگوی فروشگاه (اختیاری)">
              <div className="flex items-center gap-4 flex-wrap">
                {logoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="پیش‌نمایش لوگو"
                    className="h-16 w-16 rounded-xl border border-border object-cover shadow-sm"
                  />
                )}
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all">
                  <Upload className="h-4 w-4" aria-hidden />
                  آپلود لوگو
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onLogoChange}
                    className="sr-only"
                  />
                </label>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">PNG / JPG / WEBP — حداکثر ۲ مگابایت</p>
            </FormField>

            {/* Documents upload */}
            <FormField label="مدارک هویتی / تجاری (اختیاری)">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all">
                <Upload className="h-4 w-4" aria-hidden />
                آپلود مدارک
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={onDocsChange}
                  className="sr-only"
                />
              </label>
              {docsNames.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {docsNames.map((name, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs text-foreground">
                      <span className="truncate">{name}</span>
                      <button
                        type="button"
                        onClick={() => removeDoc(i)}
                        className="ms-2 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                        aria-label="حذف فایل"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">کارت ملی، جواز کسب یا هر مدرک مرتبط — حداکثر ۵ مگابایت هر فایل</p>
            </FormField>

            {/* Terms */}
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              با ثبت درخواست، شرایط و ضوابط فروشندگی EmpireShop را می‌پذیرید.
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={goPrevStep}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
              مرحله قبل
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2"
            >
              مرحله بعد
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 hover:-translate-y-0.5 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  در حال ارسال…
                </>
              ) : (
                <>
                  ✅ ثبت درخواست
                </>
              )}
            </button>
          )}
        </div>
      </form>

      <style>{`
        .input-base {
          width: 100%;
          border-radius: 0.75rem;
          border: 1.5px solid hsl(var(--border));
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          padding: 0.65rem 0.875rem;
          font-size: 0.875rem;
          font-family: inherit;
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
          line-height: 1.5;
        }
        .input-base:focus {
          border-color: #e11d48;
          box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.10);
        }
        .input-base::placeholder { color: hsl(var(--muted-foreground)); opacity: 0.7; }
        select.input-base { cursor: pointer; }
        textarea.input-base { resize: vertical; min-height: 80px; }
      `}</style>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-rose-500 ms-0.5" aria-hidden> *</span>}
      </span>
      {children}
    </label>
  );
}

function InfoField({ label, value, dir, full }: { label: string; value: string; dir?: string; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground" dir={dir}>{value}</dd>
    </div>
  );
}
