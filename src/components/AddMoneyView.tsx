import React, { useState } from 'react';
import { CheckCircle2, PlusCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { ADD_MONEY_STATUS_HI, formatDateTimeHi, formatINR } from '../lib/format';
import type { AddMoneyRequest } from '../types';
import { DemoQrCode } from './DemoQrCode';

interface AddMoneyViewProps {
  requests: AddMoneyRequest[];
}

const PRESET_AMOUNTS = [1000, 2000, 3000, 4000, 5000];

export const AddMoneyView: React.FC<AddMoneyViewProps> = ({ requests }) => {
  const [amountStr, setAmountStr] = useState('1000');
  const [paymentRef, setPaymentRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const numericAmount = Number(amountStr);
  const isValidAmount =
    Number.isInteger(numericAmount) && numericAmount >= 1000 && numericAmount <= 500000 && numericAmount % 1000 === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessId(null);

    if (!isValidAmount) {
      setError('न्यूनतम राशि ₹1000 है और केवल ₹1000 के गुणज (₹1000, ₹2000, ₹3000, ₹4000...) ही मान्य हैं।');
      return;
    }
    if (paymentRef.trim().length < 3) {
      setError('कृपया मान्य डेमो भुगतान संदर्भ / UTR दर्ज करें।');
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest<{ ok: boolean; requestId: string }>('/api/wallet/add-money', {
        method: 'POST',
        body: { amount: numericAmount, paymentRef: paymentRef.trim() },
      });
      setSuccessId(res.requestId);
      setPaymentRef('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'अनुरोध सबमिट नहीं हो सका।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">वॉलेट में पैसे जोड़ें (Add Money)</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            न्यूनतम राशि ₹1000 है। केवल ₹1000 के गुणज (₹1000, ₹2000, ₹3000, ₹4000 आदि) ही स्वीकार किए जाते हैं। एडमिन सत्यापन के बाद ही राशि वॉलेट में जोड़ी जाएगी।
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
            {error}
          </div>
        )}

        {successId && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <div className="font-bold">अनुरोध सफलतापूर्वक सबमिट हो गया (सत्यापन लंबित)</div>
              <div className="mt-0.5">
                अनुरोध आईडी: <span className="font-mono-tabular font-semibold">{successId}</span> — एडमिन सत्यापन के बाद ही आपका डिपॉजिट बैलेंस अपडेट होगा।
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">राशि चुनें (₹1000 के गुणज में)</label>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountStr(String(amt))}
                  className={`min-h-[40px] rounded-xl border px-3.5 py-2 font-mono-tabular text-xs font-semibold transition-colors ${
                    numericAmount === amt
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formatINR(amt)}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1000}
              step={1000}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="उदा. 1000, 2000, 3000"
              required
              className="font-mono-tabular w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
            />
            {!isValidAmount && amountStr !== '' && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                कृपया ₹1000 या उसका गुणज दर्ज करें (जैसे 1000, 2000, 3000)।
              </p>
            )}
          </div>

          <DemoQrCode
            amount={isValidAmount ? numericAmount : 1000}
            purpose="वॉलेट डिपॉजिट अनुरोध — एडमिन सत्यापन आवश्यक"
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              डेमो भुगतान संदर्भ / UTR संख्या
            </label>
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="उदा. DEMOUTR884210"
              required
              className="font-mono-tabular w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !isValidAmount}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            <PlusCircle className="h-4 w-4" />
            <span>{busy ? 'अनुरोध भेजा जा रहा है...' : 'पैसे जोड़ने का अनुरोध सबमिट करें'}</span>
          </button>
        </form>
      </div>

      {/* Right History */}
      <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-6">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">पैसे जोड़ने के अनुरोधों का इतिहास</h3>
        </div>

        {requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">अभी तक कोई डिपॉजिट अनुरोध नहीं किया गया है।</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((req) => {
              const st = ADD_MONEY_STATUS_HI[req.status] || { label: req.status, tone: 'text-slate-700' };
              return (
                <div key={req.requestId} className="space-y-1 px-6 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono-tabular text-base font-bold text-slate-900">
                      {formatINR(req.amount)}
                    </div>
                    <div className={`text-xs font-semibold ${st.tone}`}>{st.label}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    <span className="font-mono-tabular">{req.requestId}</span>
                    <span aria-hidden="true">·</span>
                    <span>संदर्भ: {req.paymentRef}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDateTimeHi(req.createdAt)}</span>
                  </div>
                  {req.adminNote && <div className="text-xs text-slate-600">एडमिन टिप्पणी: {req.adminNote}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
