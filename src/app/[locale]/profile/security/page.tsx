'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Shield, Mail, Phone, Lock, QrCode, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserInfo {
  id: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
}

export default function SecurityPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Email verification
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Phone verification
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<'send' | 'verify'>('send');
  const [phoneMsg, setPhoneMsg] = useState('');

  // 2FA setup
  const [twoFaData, setTwoFaData] = useState<{ qrCodeUrl: string; secret: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState('');

  // Disable 2FA
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setUser(json.data.user);
      })
      .finally(() => setLoading(false));
  }, []);

  const sendEmailVerification = async () => {
    setEmailSending(true);
    try {
      await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: 'fa' }),
      });
      setEmailSent(true);
    } finally {
      setEmailSending(false);
    }
  };

  const sendPhoneOtp = async () => {
    setPhoneSending(true);
    setPhoneMsg('');
    try {
      const res = await fetch('/api/auth/send-phone-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = await res.json();
      if (json.ok) { setPhoneStep('verify'); setPhoneMsg('کد تأیید ارسال شد.'); }
      else setPhoneMsg(json.error?.message ?? 'خطایی رخ داد');
    } finally {
      setPhoneSending(false);
    }
  };

  const verifyPhone = async () => {
    setPhoneSending(true);
    setPhoneMsg('');
    try {
      const res = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: phoneOtp }),
      });
      const json = await res.json();
      if (json.ok) {
        setUser((u) => u ? { ...u, phoneVerified: true } : u);
        setPhoneMsg('شماره تلفن تأیید شد!');
      } else setPhoneMsg(json.error?.message ?? 'کد نادرست است');
    } finally {
      setPhoneSending(false);
    }
  };

  const setup2FA = async () => {
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      const res = await fetch('/api/auth/2fa/setup');
      const json = await res.json();
      if (json.ok) setTwoFaData(json.data);
      else setTwoFaMsg(json.error?.message ?? 'خطایی رخ داد');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const verify2FA = async () => {
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFaCode }),
      });
      const json = await res.json();
      if (json.ok) {
        setUser((u) => u ? { ...u, twoFactorEnabled: true } : u);
        setTwoFaData(null);
        setTwoFaMsg('احراز هویت دو مرحله‌ای فعال شد!');
      } else setTwoFaMsg(json.error?.message ?? 'کد نادرست است');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const disable2FA = async () => {
    setDisableLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      });
      const json = await res.json();
      if (json.ok) {
        setUser((u) => u ? { ...u, twoFactorEnabled: false } : u);
        setDisablePassword('');
      } else alert(json.error?.message ?? 'خطایی رخ داد');
    } finally {
      setDisableLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">در حال بارگذاری…</div>;
  if (!user) return <div className="p-8 text-center">لطفاً وارد شوید.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6" dir="rtl">
      <header className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">امنیت حساب</h1>
          <p className="text-sm text-muted-foreground">مدیریت تأیید هویت و احراز هویت دو مرحله‌ای</p>
        </div>
      </header>

      {/* Email Verification */}
      {user.email && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5" />
              تأیید ایمیل
            </CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            {user.emailVerified ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">ایمیل تأیید شده است</span>
              </div>
            ) : emailSent ? (
              <p className="text-sm text-muted-foreground">ایمیل تأیید ارسال شد. لطفاً صندوق ورودی خود را بررسی کنید.</p>
            ) : (
              <Button variant="outline" size="sm" onClick={sendEmailVerification} disabled={emailSending}>
                {emailSending ? 'در حال ارسال…' : 'ارسال ایمیل تأیید'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Phone Verification */}
      {user.phone && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-5 w-5" />
              تأیید شماره تلفن
            </CardTitle>
            <CardDescription>{user.phone}</CardDescription>
          </CardHeader>
          <CardContent>
            {user.phoneVerified ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">شماره تلفن تأیید شده است</span>
              </div>
            ) : (
              <div className="space-y-3">
                {phoneStep === 'send' ? (
                  <Button variant="outline" size="sm" onClick={sendPhoneOtp} disabled={phoneSending}>
                    {phoneSending ? 'در حال ارسال…' : 'ارسال کد تأیید'}
                  </Button>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="phoneOtp">کد تأیید</Label>
                      <Input id="phoneOtp" type="text" inputMode="numeric" maxLength={6} value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} placeholder="۰۰۰۰۰۰" dir="ltr" />
                    </div>
                    <Button size="sm" onClick={verifyPhone} disabled={phoneSending}>تأیید</Button>
                  </div>
                )}
                {phoneMsg && <p className="text-sm text-muted-foreground">{phoneMsg}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2FA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-5 w-5" />
            احراز هویت دو مرحله‌ای (2FA)
          </CardTitle>
          <CardDescription>
            با اضافه کردن لایه دوم امنیت، از حساب خود بهتر محافظت کنید
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.twoFactorEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">احراز هویت دو مرحله‌ای فعال است</span>
              </div>
              <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">غیرفعال‌کردن ۲FA</p>
                <p className="text-xs text-muted-foreground">برای غیرفعال‌کردن، رمز عبور خود را وارد کنید</p>
                <div className="flex gap-2">
                  <Input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} placeholder="رمز عبور" dir="ltr" />
                  <Button variant="destructive" size="sm" onClick={disable2FA} disabled={disableLoading || !disablePassword}>
                    {disableLoading ? '…' : 'غیرفعال'}
                  </Button>
                </div>
              </div>
            </div>
          ) : twoFaData ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">۱. QR کد را با اپلیکیشن Google Authenticator اسکن کنید</p>
                <Image
                  src={twoFaData.qrCodeUrl}
                  alt="QR Code"
                  width={160}
                  height={160}
                  unoptimized
                  className="mx-auto w-40 rounded-lg border border-border"
                />
                <p className="text-center text-xs text-muted-foreground">یا کد زیر را وارد کنید:</p>
                <p className="text-center font-mono text-sm font-bold tracking-widest">{twoFaData.secret}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">۲. کد ۶ رقمی اپلیکیشن را وارد کنید</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value)}
                    placeholder="۰۰۰۰۰۰"
                    dir="ltr"
                    className="text-center text-lg tracking-widest"
                  />
                  <Button onClick={verify2FA} disabled={twoFaLoading || twoFaCode.length < 6}>
                    {twoFaLoading ? '…' : 'فعال‌سازی'}
                  </Button>
                </div>
              </div>
              {twoFaMsg && <p className="text-sm text-destructive">{twoFaMsg}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                با فعال‌کردن ۲FA، علاوه بر رمز عبور، یک کد موقت ۶ رقمی هم نیاز خواهد بود.
              </p>
              {twoFaMsg && <p className="text-sm text-emerald-600">{twoFaMsg}</p>}
              <Button variant="outline" onClick={setup2FA} disabled={twoFaLoading}>
                <QrCode className="ms-2 h-4 w-4" />
                {twoFaLoading ? 'در حال آماده‌سازی…' : 'فعال‌سازی ۲FA'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
