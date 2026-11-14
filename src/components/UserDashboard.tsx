import React from 'react';
import { ArrowDownLeft, ArrowUpRight, PlusCircle, RefreshCw, Smartphone, Wallet } from 'lucide-react';
import {
  formatDateTimeHi,
  formatINR,
  formatMonthKeyHi,
  getCurrentMonthKey,
  RECHARGE_STATUS_HI,
  TX_TYPE_HI,
} from '../lib/format';
import type {
  FinancialTransaction,
  MonthlyCommission,
  RechargeRequest,
  UserProfile,
} from '../types';

export type NavTab =
  | 'dashboard'
  | 'recharge'
  | 'add_money'
  | 'refund_withdraw'
  | 'history'
  | 'notifications'
  | 'admin';

interface UserDashboardProps {
  profile: UserProfile;
  recharges: RechargeRequest[];
  transactions: FinancialTransaction[];
  commissions: MonthlyCommission[];
  onNavigate: (tab: NavTab) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  profile,
  recharges,
  transactions,
  commissions,
  onNavigate,
}) => {
  const currentMonthKey = getCurrentMonthKey();

  const monthlyEligibleTotal = recharges
    .filter((r) => r.monthKey === currentMonthKey && r.status === 'success')
    .reduce((sum, r) => sum + r.amount, 0);

  const estimatedMonthlyCommission = Math.round(monthlyEligibleTotal * 0.1 * 100) / 100;
  const currentMonthCredited = commissions.find((c) => c.monthKey === currentMonthKey);

  return (
    <div className="space-y-6">
      {/* Wallet Hero Summary */}
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="text-xs font-medium text-blue-100">कुल वॉलेट बैलेंस</div>
            <div className="mt-1 font-mono-tabular text-3xl font-bold tracking-tight sm:text-4xl">
              {formatINR(profile.walletBalance || 0)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-100">
              <span>मोबाइल: {profile.mobileNumber}</span>
              <span aria-hidden="true">·</span>
              <span>आमंत्रण कोड: {profile.inviteCode}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('recharge')}
              className="flex min-h-[42px] items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 whitespace-nowrap shrink-0"
            >
              <Smartphone className="h-4 w-4" />
              <span>मोबाइल रिचार्ज</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('add_money')}
              className="flex min-h-[42px] items-center gap-2 rounded-xl border border-blue-400/60 bg-blue-500/30 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500/50 whitespace-nowrap shrink-0"
            >
              <PlusCircle className="h-4 w-4" />
              <span>पैसे जोड़ें</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">डिपॉजिट बैलेंस</div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-slate-900">
            {formatINR(profile.depositBalance || 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">सत्यापित डिपॉजिट व रिफंड राशि</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">कमीशन बैलेंस</div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-emerald-700">
            {formatINR(profile.commissionBalance || 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">निकासी या रिचार्ज हेतु उपलब्ध</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">
            मासिक रिचार्ज कुल ({formatMonthKeyHi(currentMonthKey)})
          </div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-slate-900">
            {formatINR(monthlyEligibleTotal)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">केवल सफल (विफल व रिफंड छोड़कर)</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">मासिक कमीशन (10%)</div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-bold text-blue-700">
            {formatINR(
              currentMonthCredited ? currentMonthCredited.commissionAmount : estimatedMonthlyCommission,
            )}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {currentMonthCredited ? 'एडमिन द्वारा क्रेडिट किया गया' : 'अनुमानित (एडमिन अनुमोदन शेष)'}
          </div>
        </div>
      </section>

      {/* Quick Actions Row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate('add_money')}
          className="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">पैसे जोड़ें</div>
            <div className="truncate text-[11px] text-slate-500">₹1000 के गुणज में</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('recharge')}
          className="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">मोबाइल रिचार्ज</div>
            <div className="truncate text-[11px] text-slate-500">Jio · Airtel · Vi · BSNL</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('refund_withdraw')}
          className="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">कमीशन निकासी</div>
            <div className="truncate text-[11px] text-slate-500">बैंक खाते में अनुरोध</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('refund_withdraw')}
          className="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">रिफंड अनुरोध</div>
            <div className="truncate text-[11px] text-slate-500">गलत नंबर रिचार्ज हेतु</div>
          </div>
        </button>
      </section>

      {/* Two-Column Recent Activity */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Recharges */}
        <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-bold text-slate-900">हालिया रिचार्ज इतिहास</h3>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              सभी देखें
            </button>
          </div>

          {recharges.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">अभी तक कोई रिचार्ज नहीं किया गया है।</p>
              <button
                type="button"
                onClick={() => onNavigate('recharge')}
                className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                पहला रिचार्ज करें
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recharges.slice(0, 6).map((r) => {
                const st = RECHARGE_STATUS_HI[r.status] || { label: r.status, tone: 'text-slate-700' };
                return (
                  <div key={r.requestId} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="font-mono-tabular">{r.mobileNumber}</span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-blue-700">{r.operator}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span className="font-mono-tabular">{r.requestId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDateTimeHi(r.createdAt)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono-tabular text-sm font-bold text-slate-900">
                        {formatINR(r.amount)}
                      </div>
                      <div className={`mt-0.5 text-xs font-semibold ${st.tone}`}>{st.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Financial Ledger */}
        <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-bold text-slate-900">हालिया खाता बही</h3>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              पूरा विवरण
            </button>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">कोई वित्तीय लेनदेन उपलब्ध नहीं है।</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.slice(0, 6).map((tx) => {
                const isCredit = tx.direction === 'credit';
                return (
                  <div key={tx.transactionId} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isCredit ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isCredit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-900">
                          {TX_TYPE_HI[tx.type] || tx.type}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">{tx.description}</div>
                      </div>
                    </div>
                    <div
                      className={`shrink-0 font-mono-tabular text-sm font-bold ${
                        isCredit ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
