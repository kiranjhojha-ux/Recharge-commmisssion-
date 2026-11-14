import React, { useState } from 'react';
import { RefreshCw, Wallet } from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  formatDateTimeHi,
  formatINR,
  REFUND_STATUS_HI,
  WITHDRAWAL_STATUS_HI,
} from '../lib/format';
import type { RechargeRequest, RefundRequest, UserProfile, WithdrawalRequest } from '../types';

interface RefundWithdrawalViewProps {
  profile: UserProfile;
  recharges: RechargeRequest[];
  refunds: RefundRequest[];
  withdrawals: WithdrawalRequest[];
}

export const RefundWithdrawalView: React.FC<RefundWithdrawalViewProps> = ({
  profile,
  recharges,
  refunds,
  withdrawals,
}) => {
  const [subTab, setSubTab] = useState<'withdraw' | 'refund'>('withdraw');

  // Withdrawal states
  const [wAmount, setWAmount] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [wBusy, setWBusy] = useState(false);
  const [wMsg, setWMsg] = useState<string | null>(null);
  const [wErr, setWErr] = useState<string | null>(null);

  // Refund states
  const existingRefundRechargeIds = new Set(refunds.map((r) => r.rechargeId));
  const eligibleForRefund = recharges.filter(
    (r) => (r.status === 'under_process' || r.status === 'success') && !existingRefundRechargeIds.has(r.requestId),
  );
  const [selectedRechargeId, setSelectedRechargeId] = useState('');
  const [correctMobileNumber, setCorrectMobileNumber] = useState('');
  const [reason, setReason] = useState('');
  const [rBusy, setRBusy] = useState(false);
  const [rMsg, setRMsg] = useState<string | null>(null);
  const [rErr, setRErr] = useState<string | null>(null);

  const activeRechargeId = selectedRechargeId || eligibleForRefund[0]?.requestId || '';

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWErr(null);
    setWMsg(null);
    setWBusy(true);
    try {
      const res = await apiRequest<{ ok: boolean; requestId: string }>('/api/withdrawal/create', {
        method: 'POST',
        body: {
          amount: Number(wAmount),
          accountHolderName: accountHolderName.trim(),
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
        },
      });
      setWMsg(`निकासी अनुरोध (${res.requestId}) सफलतापूर्वक सबमिट हो गया।`);
      setWAmount('');
    } catch (err) {
      setWErr(err instanceof Error ? err.message : 'निकासी अनुरोध विफल रहा।');
    } finally {
      setWBusy(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRErr(null);
    setRMsg(null);
    if (!activeRechargeId) {
      setRErr('कृपया रिफंड के लिए कोई रिचार्ज चुनें।');
      return;
    }
    setRBusy(true);
    try {
      const res = await apiRequest<{ ok: boolean; refundId: string }>('/api/refund/create', {
        method: 'POST',
        body: {
          rechargeId: activeRechargeId,
          correctMobileNumber: correctMobileNumber.trim(),
          reason: reason.trim(),
        },
      });
      setRMsg(`रिफंड अनुरोध (${res.refundId}) एडमिन समीक्षा के लिए भेज दिया गया है।`);
      setCorrectMobileNumber('');
      setReason('');
      setSelectedRechargeId('');
    } catch (err) {
      setRErr(err instanceof Error ? err.message : 'रिफंड अनुरोध विफल रहा।');
    } finally {
      setRBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Segmented Switch */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setSubTab('withdraw')}
          className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            subTab === 'withdraw' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          कमीशन निकासी (Withdraw)
        </button>
        <button
          type="button"
          onClick={() => setSubTab('refund')}
          className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
            subTab === 'refund' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          गलत रिचार्ज रिफंड (Refund)
        </button>
      </div>

      {subTab === 'withdraw' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">कमीशन निकासी अनुरोध</h2>
                <p className="mt-1 text-xs text-slate-600">
                  डेमो मोड: वास्तविक बैंक निकासी सक्षम नहीं है; अनुरोध एडमिन द्वारा मैन्युअल रूप से संसाधित किया जाएगा।
                </p>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-500">कमीशन बैलेंस</div>
                <div className="font-mono-tabular text-base font-bold text-emerald-700">
                  {formatINR(profile.commissionBalance || 0)}
                </div>
              </div>
            </div>

            {wErr && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                {wErr}
              </div>
            )}
            {wMsg && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900">
                {wMsg}
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">निकासी राशि (न्यूनतम ₹100)</label>
                <input
                  type="number"
                  min={100}
                  step="0.01"
                  value={wAmount}
                  onChange={(e) => setWAmount(e.target.value)}
                  placeholder="उदा. 500"
                  required
                  className="font-mono-tabular w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">खाताधारक का नाम</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="बैंक खाते के अनुसार पूरा नाम"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">बैंक का नाम</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="उदा. स्टेट बैंक ऑफ इंडिया"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">बैंक खाता संख्या</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="खाता संख्या"
                    required
                    className="font-mono-tabular w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">IFSC कोड</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="उदा. SBIN0001234"
                    required
                    className="font-mono-tabular w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={wBusy || (profile.commissionBalance || 0) < 100}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                <Wallet className="h-4 w-4" />
                <span>{wBusy ? 'सबमिट हो रहा है...' : 'निकासी अनुरोध सबमिट करें'}</span>
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-6">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">निकासी अनुरोध इतिहास</h3>
            </div>
            {withdrawals.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">कोई निकासी अनुरोध नहीं है।</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {withdrawals.map((w) => {
                  const st = WITHDRAWAL_STATUS_HI[w.status] || { label: w.status, tone: 'text-slate-700' };
                  return (
                    <div key={w.requestId} className="space-y-1 px-6 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono-tabular text-base font-bold text-slate-900">{formatINR(w.amount)}</div>
                        <div className={`text-xs font-semibold ${st.tone}`}>{st.label}</div>
                      </div>
                      <div className="text-xs text-slate-700">
                        {w.bankName} · <span className="font-mono-tabular">{w.ifscCode}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                        <span className="font-mono-tabular">{w.requestId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDateTimeHi(w.createdAt)}</span>
                        {w.paymentRef && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">Ref: {w.paymentRef}</span>
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
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">गलत रिचार्ज रिफंड अनुरोध</h2>
              <p className="mt-1 text-xs text-slate-600">
                गलत मोबाइल नंबर पर हुए रिचार्ज के लिए सही मोबाइल नंबर और कारण दर्ज करें। एडमिन स्वीकृति पर राशि वॉलेट में वापस क्रेडिट की जाएगी।
              </p>
            </div>

            {rErr && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                {rErr}
              </div>
            )}
            {rMsg && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900">
                {rMsg}
              </div>
            )}

            {eligibleForRefund.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-600">
                रिफंड अनुरोध के लिए कोई पात्र रिचार्ज उपलब्ध नहीं है।
              </div>
            ) : (
              <form onSubmit={handleRefundSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">रिचार्ज चुनें</label>
                  <select
                    value={activeRechargeId}
                    onChange={(e) => setSelectedRechargeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {eligibleForRefund.map((r) => (
                      <option key={r.requestId} value={r.requestId}>
                        {r.requestId} · {r.operator} · {r.mobileNumber} · {formatINR(r.amount)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">सही मोबाइल नंबर (10 अंक)</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={correctMobileNumber}
                    onChange={(e) => setCorrectMobileNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="सही मोबाइल नंबर दर्ज करें"
                    required
                    className="font-mono-tabular w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">रिफंड का कारण</label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="गलत नंबर पर रिचार्ज होने का विवरण लिखें"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={rBusy}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>{rBusy ? 'सबमिट हो रहा है...' : 'रिफंड अनुरोध सबमिट करें'}</span>
                </button>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-6">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">रिफंड अनुरोध इतिहास</h3>
            </div>
            {refunds.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">कोई रिफंड अनुरोध नहीं है।</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {refunds.map((rf) => {
                  const st = REFUND_STATUS_HI[rf.status] || { label: rf.status, tone: 'text-slate-700' };
                  return (
                    <div key={rf.rechargeId} className="space-y-1 px-6 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono-tabular text-sm font-bold text-slate-900">
                          {formatINR(rf.amount)} · {rf.operator}
                        </div>
                        <div className={`text-xs font-semibold ${st.tone}`}>{st.label}</div>
                      </div>
                      <div className="text-xs text-slate-700">
                        गलत नंबर: <span className="font-mono-tabular">{rf.wrongMobileNumber}</span> · सही नंबर:{' '}
                        <span className="font-mono-tabular">{rf.correctMobileNumber}</span>
                      </div>
                      <div className="text-xs text-slate-600">कारण: {rf.reason}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                        <span className="font-mono-tabular">{rf.refundId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDateTimeHi(rf.createdAt)}</span>
                      </div>
                      {rf.adminNote && <div className="text-xs text-slate-600">एडमिन टिप्पणी: {rf.adminNote}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
