import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Send, Shield, XCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  ADD_MONEY_STATUS_HI,
  formatDateTimeHi,
  formatINR,
  formatMonthKeyHi,
  getCurrentMonthKey,
  RECHARGE_STATUS_HI,
  REFUND_STATUS_HI,
  TX_TYPE_HI,
  USER_STATUS_HI,
  WITHDRAWAL_STATUS_HI,
} from '../lib/format';
import type { AdminOverviewData } from '../types';

type AdminTab =
  | 'users'
  | 'add_money'
  | 'recharges'
  | 'commissions'
  | 'refunds'
  | 'withdrawals'
  | 'transactions';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('recharges');
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Per-row input maps for transaction references and notes
  const [txRefs, setTxRefs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Custom notification state
  const [notifyUserId, setNotifyUserId] = useState('');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');

  // Invite code creation state
  const [newInviteCode, setNewInviteCode] = useState('');
  const [newInviteLabel, setNewInviteLabel] = useState('');

  // Transaction search state
  const [txSearch, setTxSearch] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AdminOverviewData>(
        `/api/admin/overview?monthKey=${encodeURIComponent(monthKey)}`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'एडमिन डेटा लोड करने में त्रुटि हुई।');
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const runAction = async (key: string, fn: () => Promise<void>, successText: string) => {
    setBusyKey(key);
    setError(null);
    setToast(null);
    try {
      await fn();
      setToast(successText);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'कार्रवाई विफल रही।');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSendCustomNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyUserId || !notifyTitle.trim() || !notifyMessage.trim()) return;
    await runAction(
      'custom-notify',
      async () => {
        await apiRequest('/api/admin/notify', {
          method: 'POST',
          body: {
            targetUserId: notifyUserId,
            title: notifyTitle.trim(),
            message: notifyMessage.trim(),
          },
        });
        setNotifyTitle('');
        setNotifyMessage('');
      },
      'उपयोगकर्ता को सूचना भेज दी गई है।',
    );
  };

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">एडमिन नियंत्रण पैनल (Admin Panel)</h2>
            <p className="text-xs text-slate-600">
              उपयोगकर्ता सक्रियण, डिपॉजिट सत्यापन, मैन्युअल रिचार्ज, 10% मासिक कमीशन, रिफंड और निकासी प्रबंधन
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>डेटा रीफ़्रेश करें</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}
      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          {toast}
        </div>
      )}

      {/* Admin Stats Grid */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">कुल उपयोगकर्ता</div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-slate-900">{data.stats.totalUsers}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">सक्रिय उपयोगकर्ता</div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-emerald-700">{data.stats.activeUsers}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">लंबित सक्रियण</div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-amber-700">
              {data.stats.pendingActivation}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">डिपॉजिट लंबित</div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-blue-700">
              {data.stats.pendingAddMoney}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">रिचार्ज प्रक्रियाधीन</div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-blue-700">
              {data.stats.underProcessRecharges}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-medium text-slate-500">रिफंड / निकासी लंबित</div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-slate-900">
              {data.stats.pendingRefunds + data.stats.pendingWithdrawals}
            </div>
          </div>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
        {(
          [
            ['recharges', 'रिचार्ज अनुरोध'],
            ['add_money', 'पैसे जोड़ने के अनुरोध'],
            ['users', 'उपयोगकर्ता व सक्रियण'],
            ['commissions', 'मासिक कमीशन (10%)'],
            ['refunds', 'रिफंड अनुरोध'],
            ['withdrawals', 'निकासी अनुरोध'],
            ['transactions', 'सभी लेनदेन'],
          ] as Array<[AdminTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`min-h-[38px] rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          एडमिन रिकॉर्ड लोड हो रहे हैं...
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* TAB 1: RECHARGE REQUESTS (MANUAL PROCESSING) */}
          {activeTab === 'recharges' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-bold text-slate-900">मोबाइल रिचार्ज अनुरोध (मैन्युअल प्रोसेसिंग)</h3>
              </div>
              {data.rechargeRequests.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">कोई रिचार्ज अनुरोध नहीं है।</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.rechargeRequests.map((r) => {
                    const st = RECHARGE_STATUS_HI[r.status] || { label: r.status, tone: 'text-slate-700' };
                    return (
                      <div key={r.requestId} className="space-y-3 px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                              <span className="font-mono-tabular">{r.mobileNumber}</span>
                              <span className="text-blue-700">{r.operator}</span>
                              <span className="font-mono-tabular">{formatINR(r.amount)}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                              <span className="font-mono-tabular">{r.requestId}</span>
                              <span aria-hidden="true">·</span>
                              <span>यूज़र मोबाइल: {r.userMobile}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatDateTimeHi(r.createdAt)}</span>
                            </div>
                          </div>
                          <div className={`text-xs font-bold ${st.tone}`}>{st.label}</div>
                        </div>

                        {r.status === 'under_process' ? (
                          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={txRefs[r.requestId] || ''}
                              onChange={(e) => setTxRefs((p) => ({ ...p, [r.requestId]: e.target.value }))}
                              placeholder="लेनदेन संदर्भ / Operator Ref दर्ज करें"
                              className="font-mono-tabular flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={notes[r.requestId] || ''}
                              onChange={(e) => setNotes((p) => ({ ...p, [r.requestId]: e.target.value }))}
                              placeholder="उपयोगकर्ता के लिए संदेश (वैकल्पिक)"
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={busyKey === `rch-${r.requestId}`}
                                onClick={() =>
                                  runAction(
                                    `rch-${r.requestId}`,
                                    () =>
                                      apiRequest(`/api/admin/recharge/${r.requestId}/process`, {
                                        method: 'POST',
                                        body: {
                                          status: 'success',
                                          transactionRef: txRefs[r.requestId] || '',
                                          adminNote: notes[r.requestId] || '',
                                        },
                                      }),
                                    `रिचार्ज ${r.requestId} सफल चिह्नित किया गया और उपयोगकर्ता को सूचना भेजी गई।`,
                                  )
                                }
                                className="flex min-h-[38px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>सफल चिह्नित करें</span>
                              </button>
                              <button
                                type="button"
                                disabled={busyKey === `rch-${r.requestId}`}
                                onClick={() =>
                                  runAction(
                                    `rch-${r.requestId}`,
                                    () =>
                                      apiRequest(`/api/admin/recharge/${r.requestId}/process`, {
                                        method: 'POST',
                                        body: {
                                          status: 'failed',
                                          transactionRef: txRefs[r.requestId] || 'FAILED',
                                          adminNote: notes[r.requestId] || '',
                                        },
                                      }),
                                    `रिचार्ज ${r.requestId} विफल चिह्नित कर राशि वापस की गई।`,
                                  )
                                }
                                className="flex min-h-[38px] items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span>विफल चिह्नित करें</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-600">
                            संदर्भ: <span className="font-mono-tabular font-semibold">{r.transactionRef || '—'}</span>
                            {r.adminNote ? ` · ${r.adminNote}` : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD MONEY REQUESTS */}
          {activeTab === 'add_money' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-bold text-slate-900">वॉलेट डिपॉजिट (Add Money) सत्यापन अनुरोध</h3>
              </div>
              {data.addMoneyRequests.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">कोई डिपॉजिट अनुरोध नहीं है।</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.addMoneyRequests.map((req) => {
                    const st = ADD_MONEY_STATUS_HI[req.status] || { label: req.status, tone: 'text-slate-700' };
                    return (
                      <div key={req.requestId} className="space-y-3 px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-mono-tabular text-base font-bold text-slate-900">
                              {formatINR(req.amount)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-600">
                              {req.userEmail} · मोबाइल: <span className="font-mono-tabular">{req.userMobile}</span> · संदर्भ:{' '}
                              <span className="font-mono-tabular font-semibold text-slate-900">{req.paymentRef}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {req.requestId} · {formatDateTimeHi(req.createdAt)}
                            </div>
                          </div>
                          <div className={`text-xs font-bold ${st.tone}`}>{st.label}</div>
                        </div>

                        {req.status === 'pending' && (
                          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={notes[req.requestId] || ''}
                              onChange={(e) => setNotes((p) => ({ ...p, [req.requestId]: e.target.value }))}
                              placeholder="एडमिन टिप्पणी (वैकल्पिक)"
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={busyKey === `add-${req.requestId}`}
                                onClick={() =>
                                  runAction(
                                    `add-${req.requestId}`,
                                    () =>
                                      apiRequest(`/api/admin/add-money/${req.requestId}/process`, {
                                        method: 'POST',
                                        body: { action: 'approve', adminNote: notes[req.requestId] || '' },
                                      }),
                                    `₹${req.amount} उपयोगकर्ता के डिपॉजिट वॉलेट में क्रेडिट किए गए।`,
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                स्वीकृत करें और बैलेंस जोड़ें
                              </button>
                              <button
                                type="button"
                                disabled={busyKey === `add-${req.requestId}`}
                                onClick={() =>
                                  runAction(
                                    `add-${req.requestId}`,
                                    () =>
                                      apiRequest(`/api/admin/add-money/${req.requestId}/process`, {
                                        method: 'POST',
                                        body: { action: 'reject', adminNote: notes[req.requestId] || '' },
                                      }),
                                    `अनुरोध ${req.requestId} अस्वीकृत किया गया।`,
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                अस्वीकार करें
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: USERS & RS 499 ACTIVATION */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h3 className="text-base font-bold text-slate-900">पंजीकृत उपयोगकर्ता एवं ₹499 खाता सक्रियण</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {data.users.map((u) => {
                    const st = USER_STATUS_HI[u.status] || { label: u.status, tone: 'text-slate-700' };
                    return (
                      <div key={u.uid} className="flex flex-col justify-between gap-3 px-6 py-4 sm:flex-row sm:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                            <span>{u.displayName}</span>
                            <span className={`text-xs font-semibold ${st.tone}`}>· {st.label}</span>
                            {u.role === 'admin' && <span className="text-xs font-semibold text-blue-700">· एडमिन</span>}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-600">
                            {u.email} · मोबाइल: <span className="font-mono-tabular">{u.mobileNumber}</span> · आमंत्रण:{' '}
                            <span className="font-mono-tabular">{u.inviteCode}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 font-mono-tabular text-xs text-slate-700">
                            <span>कुल वॉलेट: {formatINR(u.walletBalance)}</span>
                            <span>डिपॉजिट: {formatINR(u.depositBalance)}</span>
                            <span>कमीशन: {formatINR(u.commissionBalance)}</span>
                            {u.activationRef && <span>सक्रियण संदर्भ: {u.activationRef}</span>}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          {!u.isActivated && u.role !== 'admin' && u.status !== 'suspended' && (
                            <>
                              <button
                                type="button"
                                disabled={busyKey === `act-${u.uid}`}
                                onClick={() =>
                                  runAction(
                                    `act-${u.uid}`,
                                    () =>
                                      apiRequest(`/api/admin/users/${u.uid}/approve-activation`, {
                                        method: 'POST',
                                        body: { action: 'approve' },
                                      }),
                                    `${u.displayName} का खाता सक्रिय कर दिया गया है।`,
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                खाता सक्रिय करें
                              </button>
                              {u.status === 'pending_approval' && (
                                <button
                                  type="button"
                                  disabled={busyKey === `act-${u.uid}`}
                                  onClick={() =>
                                    runAction(
                                      `act-${u.uid}`,
                                      () =>
                                        apiRequest(`/api/admin/users/${u.uid}/approve-activation`, {
                                          method: 'POST',
                                          body: { action: 'reject' },
                                        }),
                                      `${u.displayName} का सक्रियण अनुरोध अस्वीकृत किया गया।`,
                                    )
                                  }
                                  className="min-h-[38px] rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                                >
                                  अस्वीकार करें
                                </button>
                              )}
                            </>
                          )}

                          {u.role !== 'admin' && (u.status === 'active' || u.status === 'suspended') && (
                            <button
                              type="button"
                              disabled={busyKey === `tog-${u.uid}`}
                              onClick={() =>
                                runAction(
                                  `tog-${u.uid}`,
                                  () =>
                                    apiRequest(`/api/admin/users/${u.uid}/toggle-status`, {
                                      method: 'POST',
                                    }),
                                  u.status === 'suspended'
                                    ? `${u.displayName} का खाता पुनः सक्रिय किया गया।`
                                    : `${u.displayName} का खाता निलंबित किया गया।`,
                                )
                              }
                              className={`min-h-[38px] rounded-lg border px-3.5 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                                u.status === 'suspended'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {u.status === 'suspended' ? 'पुनः सक्रिय करें' : 'निलंबित करें'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Invite Codes Management */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">आमंत्रण कोड प्रबंधन (Invite Codes)</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    पंजीकरण के लिए मान्य आमंत्रण कोड आवश्यक है। डिफ़ॉल्ट डेमो कोड: <span className="font-mono-tabular font-bold text-slate-800">RC2026</span>
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newInviteCode.trim()) return;
                    runAction(
                      'create-invite',
                      async () => {
                        await apiRequest('/api/admin/invite-codes', {
                          method: 'POST',
                          body: {
                            action: 'create',
                            code: newInviteCode.trim().toUpperCase(),
                            label: newInviteLabel.trim() || 'एडमिन आमंत्रण कोड',
                          },
                        });
                        setNewInviteCode('');
                        setNewInviteLabel('');
                      },
                      'नया आमंत्रण कोड सफलतापूर्वक बनाया गया।',
                    );
                  }}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                >
                  <input
                    type="text"
                    value={newInviteCode}
                    onChange={(e) => setNewInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    placeholder="नया कोड (उदा. AGENT2026)"
                    required
                    className="font-mono-tabular rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newInviteLabel}
                    onChange={(e) => setNewInviteLabel(e.target.value)}
                    placeholder="विवरण (उदा. नया एजेंट बैच)"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busyKey === 'create-invite'}
                    className="min-h-[38px] rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    आमंत्रण कोड जोड़ें
                  </button>
                </form>

                {data.inviteCodes.length > 0 && (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {data.inviteCodes.map((ic) => (
                      <div key={ic.code} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                        <div>
                          <span className="font-mono-tabular font-bold text-slate-900">{ic.code}</span>
                          <span className="ml-2 text-slate-500">· {ic.label}</span>
                        </div>
                        <button
                          type="button"
                          disabled={busyKey === `ic-${ic.code}`}
                          onClick={() =>
                            runAction(
                              `ic-${ic.code}`,
                              () =>
                                apiRequest('/api/admin/invite-codes', {
                                  method: 'POST',
                                  body: { action: 'toggle', code: ic.code },
                                }),
                              `कोड ${ic.code} की स्थिति अपडेट की गई।`,
                            )
                          }
                          className={`rounded-lg border px-3 py-1 font-semibold ${
                            ic.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {ic.isActive ? 'सक्रिय (निष्क्रिय करें)' : 'निष्क्रिय (सक्रिय करें)'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Send Direct Notification to Any User */}
              <form
                onSubmit={handleSendCustomNotification}
                className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
              >
                <h3 className="text-base font-bold text-slate-900">उपयोगकर्ता को सीधे सूचना भेजें</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">उपयोगकर्ता चुनें</label>
                    <select
                      value={notifyUserId}
                      onChange={(e) => setNotifyUserId(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="">-- उपयोगकर्ता चुनें --</option>
                      {data.users.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName} ({u.mobileNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">शीर्षक</label>
                    <input
                      type="text"
                      value={notifyTitle}
                      onChange={(e) => setNotifyTitle(e.target.value)}
                      placeholder="सूचना का शीर्षक"
                      required
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">संदेश</label>
                  <textarea
                    rows={2}
                    value={notifyMessage}
                    onChange={(e) => setNotifyMessage(e.target.value)}
                    placeholder="उपयोगकर्ता के लिए हिंदी संदेश लिखें"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busyKey === 'custom-notify'}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>सूचना भेजें</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: MONTHLY 10% COMMISSION MANAGEMENT */}
          {activeTab === 'commissions' && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    मासिक 10% कमीशन प्रबंधन ({formatMonthKeyHi(monthKey)})
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    केवल सफल (Success) रिचार्ज पर 10% गणना। विफल व रिफंड लेनदेन स्वतः हटा दिए गए हैं।
                  </p>
                </div>
                <input
                  type="month"
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                  className="font-mono-tabular rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {data.commissionPreviews.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  इस माह में कमीशन के लिए कोई पात्र सफल रिचार्ज नहीं मिला।
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.commissionPreviews.map((cp) => (
                    <div
                      key={`${cp.userId}_${cp.monthKey}`}
                      className="flex flex-col justify-between gap-3 px-6 py-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {cp.displayName} <span className="font-mono-tabular text-xs text-slate-500">({cp.userMobile})</span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          पात्र सफल रिचार्ज कुल:{' '}
                          <span className="font-mono-tabular font-semibold">{formatINR(cp.eligibleRechargeTotal)}</span> ·{' '}
                          लेनदेन संख्या: {cp.eligibleCount}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500">10% कमीशन राशि</div>
                          <div className="font-mono-tabular text-base font-bold text-emerald-700">
                            {formatINR(cp.commissionAmount)}
                          </div>
                        </div>

                        {cp.alreadyCredited ? (
                          <span className="text-xs font-bold text-emerald-700">क्रेडिट किया जा चुका है</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyKey === `comm-${cp.userId}`}
                            onClick={() =>
                              runAction(
                                `comm-${cp.userId}`,
                                () =>
                                  apiRequest('/api/admin/commission/approve', {
                                    method: 'POST',
                                    body: { userId: cp.userId, monthKey: cp.monthKey },
                                  }),
                                `${cp.displayName} को ${formatINR(cp.commissionAmount)} मासिक कमीशन क्रेडिट किया गया।`,
                              )
                            }
                            className="min-h-[40px] rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
                          >
                            स्वीकृत करें और कमीशन क्रेडिट करें
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: REFUND REQUESTS */}
          {activeTab === 'refunds' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-bold text-slate-900">गलत रिचार्ज रिफंड अनुरोध</h3>
              </div>
              {data.refundRequests.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">कोई रिफंड अनुरोध नहीं है।</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.refundRequests.map((rf) => {
                    const st = REFUND_STATUS_HI[rf.status] || { label: rf.status, tone: 'text-slate-700' };
                    return (
                      <div key={rf.rechargeId} className="space-y-3 px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-mono-tabular text-sm font-bold text-slate-900">
                              {rf.rechargeId} · {rf.operator} · {formatINR(rf.amount)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-700">
                              गलत नंबर: <span className="font-mono-tabular">{rf.wrongMobileNumber}</span> · सही नंबर:{' '}
                              <span className="font-mono-tabular font-bold text-blue-700">{rf.correctMobileNumber}</span>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-600">कारण: {rf.reason}</div>
                          </div>
                          <div className={`text-xs font-bold ${st.tone}`}>{st.label}</div>
                        </div>

                        {rf.status === 'pending' && (
                          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={notes[rf.rechargeId] || ''}
                              onChange={(e) => setNotes((p) => ({ ...p, [rf.rechargeId]: e.target.value }))}
                              placeholder="एडमिन टिप्पणी (वैकल्पिक)"
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={busyKey === `rf-${rf.rechargeId}`}
                                onClick={() =>
                                  runAction(
                                    `rf-${rf.rechargeId}`,
                                    () =>
                                      apiRequest(`/api/admin/refund/${rf.rechargeId}/process`, {
                                        method: 'POST',
                                        body: { action: 'approve', adminNote: notes[rf.rechargeId] || '' },
                                      }),
                                    `रिफंड स्वीकृत किया गया और ₹${rf.amount} वॉलेट में क्रेडिट किया गया।`,
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                स्वीकृत करें (वॉलेट में रिफंड)
                              </button>
                              <button
                                type="button"
                                disabled={busyKey === `rf-${rf.rechargeId}`}
                                onClick={() =>
                                  runAction(
                                    `rf-${rf.rechargeId}`,
                                    () =>
                                      apiRequest(`/api/admin/refund/${rf.rechargeId}/process`, {
                                        method: 'POST',
                                        body: { action: 'reject', adminNote: notes[rf.rechargeId] || '' },
                                      }),
                                    `रिफंड अनुरोध अस्वीकृत किया गया।`,
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                अस्वीकार करें
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: WITHDRAWAL REQUESTS */}
          {activeTab === 'withdrawals' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-bold text-slate-900">कमीशन निकासी अनुरोध</h3>
              </div>
              {data.withdrawalRequests.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">कोई निकासी अनुरोध नहीं है।</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.withdrawalRequests.map((w) => {
                    const st = WITHDRAWAL_STATUS_HI[w.status] || { label: w.status, tone: 'text-slate-700' };
                    return (
                      <div key={w.requestId} className="space-y-3 px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-mono-tabular text-base font-bold text-slate-900">
                              {formatINR(w.amount)} · {w.accountHolderName}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-700">
                              {w.bankName} · खाता: <span className="font-mono-tabular">{w.accountNumber}</span> · IFSC:{' '}
                              <span className="font-mono-tabular">{w.ifscCode}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {w.requestId} · यूज़र मोबाइल: {w.userMobile} · {formatDateTimeHi(w.createdAt)}
                            </div>
                          </div>
                          <div className={`text-xs font-bold ${st.tone}`}>{st.label}</div>
                        </div>

                        {w.status === 'pending' && (
                          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={txRefs[w.requestId] || ''}
                              onChange={(e) => setTxRefs((p) => ({ ...p, [w.requestId]: e.target.value }))}
                              placeholder="भुगतान संदर्भ / डेमो UTR दर्ज करें"
                              className="font-mono-tabular flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={busyKey === `wdr-${w.requestId}`}
                                onClick={() =>
                                  runAction(
                                    `wdr-${w.requestId}`,
                                    () =>
                                      apiRequest(`/api/admin/withdrawal/${w.requestId}/process`, {
                                        method: 'POST',
                                        body: {
                                          status: 'paid',
                                          paymentRef: txRefs[w.requestId] || '',
                                          adminNote: notes[w.requestId] || '',
                                        },
                                      }),
                                    `निकासी ${w.requestId} भुगतान किया गया चिह्नित है।`,
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                भुगतान किया गया चिह्नित करें
                              </button>
                              <button
                                type="button"
                                disabled={busyKey === `wdr-${w.requestId}`}
                                onClick={() =>
                                  runAction(
                                    `wdr-${w.requestId}`,
                                    () =>
                                      apiRequest(`/api/admin/withdrawal/${w.requestId}/process`, {
                                        method: 'POST',
                                        body: {
                                          status: 'rejected',
                                          adminNote: notes[w.requestId] || '',
                                        },
                                      }),
                                    `निकासी अस्वीकृत कर राशि कमीशन वॉलेट में वापस की गई।`,
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                अस्वीकार करें
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: ALL TRANSACTIONS LEDGER */}
          {activeTab === 'transactions' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-bold text-slate-900">
                  सभी वित्तीय लेनदेन ({data.transactions.length})
                </h3>
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="आईडी, यूज़र या विवरण खोजें"
                  className="w-60 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              {data.transactions.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">कोई वित्तीय लेनदेन उपलब्ध नहीं है।</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th className="px-5 py-3">लेनदेन आईडी</th>
                        <th className="px-5 py-3">यूज़र आईडी</th>
                        <th className="px-5 py-3">प्रकार व विवरण</th>
                        <th className="px-5 py-3 text-right">राशि</th>
                        <th className="px-5 py-3">तिथि</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.transactions
                        .filter((tx) => {
                          const q = txSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            tx.transactionId.toLowerCase().includes(q) ||
                            tx.userId.toLowerCase().includes(q) ||
                            tx.referenceId.toLowerCase().includes(q) ||
                            tx.description.toLowerCase().includes(q)
                          );
                        })
                        .map((tx) => {
                          const isCredit = tx.direction === 'credit';
                          return (
                            <tr key={tx.transactionId} className="hover:bg-slate-50/70">
                              <td className="px-5 py-3.5 font-mono-tabular text-slate-700">{tx.transactionId}</td>
                              <td className="px-5 py-3.5 font-mono-tabular text-slate-500">
                                {tx.userId.slice(0, 10)}…
                              </td>
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
        </div>
      ) : null}
    </div>
  );
};
