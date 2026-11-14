import React, { useState } from 'react';
import { Search } from 'lucide-react';
import {
  formatDateTimeHi,
  formatINR,
  formatMonthKeyHi,
  RECHARGE_STATUS_HI,
  TX_TYPE_HI,
} from '../lib/format';
import type { FinancialTransaction, MonthlyCommission, RechargeRequest, RechargeStatus } from '../types';

interface HistoryLedgerViewProps {
  recharges: RechargeRequest[];
  transactions: FinancialTransaction[];
  commissions: MonthlyCommission[];
}

export const HistoryLedgerView: React.FC<HistoryLedgerViewProps> = ({
  recharges,
  transactions,
  commissions,
}) => {
  const [tab, setTab] = useState<'recharges' | 'ledger' | 'commissions'>('recharges');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RechargeStatus>('all');

  const filteredRecharges = recharges.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.mobileNumber.toLowerCase().includes(q) ||
      r.requestId.toLowerCase().includes(q) ||
      r.operator.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab('recharges')}
            className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'recharges' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            रिचार्ज इतिहास ({recharges.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('ledger')}
            className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'ledger' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            खाता बही ({transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('commissions')}
            className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'commissions' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            मासिक कमीशन ({commissions.length})
          </button>
        </div>

        {tab === 'recharges' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="नंबर या आईडी खोजें"
                className="w-48 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | RechargeStatus)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">सभी स्थिति</option>
              <option value="under_process">प्रक्रियाधीन</option>
              <option value="success">सफल</option>
              <option value="failed">विफल</option>
              <option value="refunded">रिफंड किया गया</option>
            </select>
          </div>
        )}
      </div>

      {tab === 'recharges' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {filteredRecharges.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">कोई मेल खाता रिचार्ज रिकॉर्ड नहीं मिला।</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">अनुरोध आईडी</th>
                    <th className="px-5 py-3">मोबाइल और ऑपरेटर</th>
                    <th className="px-5 py-3 text-right">राशि</th>
                    <th className="px-5 py-3">स्थिति</th>
                    <th className="px-5 py-3">संदर्भ / तिथि</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecharges.map((r) => {
                    const st = RECHARGE_STATUS_HI[r.status] || { label: r.status, tone: 'text-slate-700' };
                    return (
                      <tr key={r.requestId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5 font-mono-tabular font-medium text-slate-700">{r.requestId}</td>
                        <td className="px-5 py-3.5">
                          <div className="font-mono-tabular font-semibold text-slate-900">{r.mobileNumber}</div>
                          <div className="text-[11px] text-blue-700">{r.operator}</div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono-tabular font-bold text-slate-900">
                          {formatINR(r.amount)}
                        </td>
                        <td className={`px-5 py-3.5 font-semibold ${st.tone}`}>{st.label}</td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <div className="font-mono-tabular">{r.transactionRef || '—'}</div>
                          <div className="text-[11px] text-slate-400">{formatDateTimeHi(r.createdAt)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">कोई वित्तीय लेनदेन उपलब्ध नहीं है।</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">लेनदेन आईडी</th>
                    <th className="px-5 py-3">प्रकार व विवरण</th>
                    <th className="px-5 py-3 text-right">राशि</th>
                    <th className="px-5 py-3">तिथि</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const isCredit = tx.direction === 'credit';
                    return (
                      <tr key={tx.transactionId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5 font-mono-tabular text-slate-700">{tx.transactionId}</td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">{TX_TYPE_HI[tx.type] || tx.type}</div>
                          <div className="text-[11px] text-slate-500">{tx.description}</div>
                        </td>
                        <td
                          className={`px-5 py-3.5 text-right font-mono-tabular font-bold ${
                            isCredit ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {isCredit ? '+' : '-'}
                          {formatINR(tx.amount)}
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-slate-500">
                          {formatDateTimeHi(tx.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'commissions' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {commissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">अभी तक कोई मासिक कमीशन क्रेडिट नहीं हुआ है।</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {commissions.map((c) => (
                <div key={c.commissionId} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{formatMonthKeyHi(c.monthKey)}</div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      पात्र सफल रिचार्ज कुल: <span className="font-mono-tabular font-semibold">{formatINR(c.eligibleRechargeTotal)}</span> ·{' '}
                      कुल लेनदेन: {c.eligibleCount}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-tabular text-base font-bold text-emerald-700">
                      +{formatINR(c.commissionAmount)}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700">कमीशन वॉलेट में क्रेडिट</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
