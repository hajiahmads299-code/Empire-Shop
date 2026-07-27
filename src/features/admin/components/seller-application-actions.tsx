'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Props {
  applicationId: string;
  status: 'pending' | 'approved' | 'rejected';
}

export function SellerApplicationActions({ applicationId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [showReject, setShowReject] = React.useState(false);
  const [reason, setReason] = React.useState('');

  async function call(body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/seller-applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast.error(data?.error?.message ?? 'خطا');
        return;
      }
      toast.success(successMsg);
      setShowReject(false);
      router.refresh();
    } catch {
      toast.error('خطای شبکه');
    } finally {
      setBusy(false);
    }
  }

  if (status !== 'pending') {
    return (
      <span className="text-xs text-muted-foreground">بررسی شده</span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => call({ action: 'approve' }, 'درخواست تایید شد')}
          className="inline-flex h-8 items-center rounded-md border border-emerald-600/40 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          تایید
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowReject((v) => !v)}
          className="inline-flex h-8 items-center rounded-md border border-red-600/40 bg-red-500/10 px-3 text-xs font-medium text-red-700 hover:bg-red-500/20 disabled:opacity-50"
        >
          رد
        </button>
      </div>
      {showReject && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2">
          <textarea
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="دلیل رد را بنویسید..."
            className="w-full rounded border border-red-300 bg-card px-2 py-1 text-xs text-navy-800 outline-none focus:border-red-500"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-card"
            >
              انصراف
            </button>
            <button
              type="button"
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                call({ action: 'reject', rejectionReason: reason.trim() }, 'درخواست رد شد')
              }
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              ثبت رد
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
