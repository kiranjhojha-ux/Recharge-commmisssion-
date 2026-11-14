import React, { useState } from 'react';
import { CheckCircle2, Smartphone } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatDateTimeHi, formatINR, RECHARGE_STATUS_HI } from '../lib/format';
import type { OperatorType, RechargeRequest, UserProfile } from '../types';

interface RechargeViewProps {
  profile: UserProfile;
  recharges: RechargeRequest[];
}

const OPERATORS: Array<{ id: OperatorType; label: string; color: string }> = [
  { id: 'Jio', label: 'Jio', color: 'border-blue-600 bg-blue-50 text-blue-900' },
  { id: 'Airtel', label: 'Airtel', color: 'border-red-600 bg-red-50 text-red-900' },
  { id: 'Vi', label: 'Vi', color: 'border-amber-600 bg-amber-50 text-amber-900' },
  { id: 'BSNL', label: 'BSNL', color: 'border-emerald-600 bg-emerald-50 text-emerald-900' },
];

const QUICK_PLANS = [199, 239, 299, 349, 666, 859];

export const RechargeView: React.FC<RechargeViewProps> = ({ profile, recharges }) => {
  const [operator, setOperator] = useState<OperatorType>('Jio');
  const [mobileNumber, setMobileNumber] = useState('');
  const [amountStr, setAmountStr] = useState('239');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  const amount = Number(amountStr);
  const walletBalance = profile.walletBalance || 0;
  const hasBalance = Number.isInteger(amount) && amount >= 10 && walletBalance >= amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedRequestId(null);

    if (!/^[6-9][0-9]{9}$/.test(mobileNumber.trim())) {
      setError('कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।');
      return;
    }
    if (!Number.isInteger(amount) || amount < 10 || amount > 50000) {
      setError('रिचार्ज राशि ₹10 से ₹50,000 के बीच होनी चाहिए।');
      return;
    }
    if (walletBalance < amount) {
      setError(`वॉलेट में पर्याप्त बैलेंस नहीं है। उपलब्ध बैलेंस: ${formatINR(walletBalance)}`);
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest<{ ok: boolean; requestId: string }>('/api/recharge/create', {
        method: 'POST',
        body: {
          mobileNumber: mobileNumber.trim(),
          operator,
          amount,
        },
      });
      setCreatedRequestId(res.requestId);
      setMobileNumber('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'रिचार्ज अनुरोध विफल रहा।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Recharge Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">मोबाइल रिचार्ज करें</h2>
            <p className="mt-1 text-xs text-slate-600">
              सबमिट करने पर वॉलेट से सुरक्षित राशि काटी जाएगी और अनुरोध प्रक्रियाधीन (Under Process) होगा।
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-500">उपलब्ध बैलेंस</div>
            <div className="font-mono-tabular text-sm font-bold text-blue-700">{formatINR(walletBalance)}</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
            {error}
          </div>
        )}

        {createdRequestId && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <div className="font-bold">रिचार्ज अनुरोध सबमिट हो गया — प्रक्रियाधीन (Under Process)</div>
              <div className="mt-0.5">
                अद्वितीय रिचार्ज आईडी: <span className="font-mono-tabular font-bold">{createdRequestId}</span> — एडमिन को सूचना भेज दी गई है।
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">ऑपरेटर चुनें</label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {OPERATORS.map((op) => {
                const selected = operator === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setOperator(op.id)}
                    className={`min-h-[48px] rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                      selected ? op.color : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">मोबाइल नंबर (10 अंक)</label>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="उदा. 9876543210"
                required
                className="font-mono-tabular w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">रिचार्ज राशि (₹)</label>
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_PLANS.map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setAmountStr(String(plan))}
                  className={`min-h-[38px] rounded-xl border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors ${
                    amount === plan
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formatINR(plan)}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={10}
              max={50000}
              step={1}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="रिचार्ज राशि दर्ज करें"
              required
              className="font-mono-tabular w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
            />
            {amount > walletBalance && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                बैलेंस कम है। कृपया पहले वॉलेट में पैसे जोड़ें।
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !hasBalance}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <Smartphone className="h-4 w-4" />
            <span>{busy ? 'प्रक्रिया जारी है...' : `${operator} रिचार्ज सबमिट करें (${formatINR(amount || 0)})`}</span>
          </button>
        </form>
      </div>

      {/* Right Recent Recharge Requests */}
      <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-6">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">ताज़ा रिचार्ज स्थिति</h3>
        </div>

        {recharges.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">कोई रिचार्ज अनुरोध उपलब्ध नहीं है।</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recharges.slice(0, 10).map((r) => {
              const st = RECHARGE_STATUS_HI[r.status] || { label: r.status, tone: 'text-slate-700' };
              return (
                <div key={r.requestId} className="space-y-1 px-6 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular text-sm font-bold text-slate-900">{r.mobileNumber}</span>
                      <span className="text-xs font-semibold text-blue-700">{r.operator}</span>
                    </div>
                    <div className="font-mono-tabular text-sm font-bold text-slate-900">{formatINR(r.amount)}</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono-tabular text-slate-500">{r.requestId}</span>
                    <span className={`font-semibold ${st.tone}`}>{st.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                    <span>{formatDateTimeHi(r.createdAt)}</span>
                    {r.transactionRef && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">Ref: {r.transactionRef}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
