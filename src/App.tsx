/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import {
  Bell,
  History,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  RefreshCw,
  Shield,
  Smartphone,
} from 'lucide-react';
import { AddMoneyView } from './components/AddMoneyView';
import { AdminPanel } from './components/AdminPanel';
import { AuthOnboarding } from './components/AuthOnboarding';
import { HistoryLedgerView } from './components/HistoryLedgerView';
import { NotificationsView } from './components/NotificationsView';
import { RechargeView } from './components/RechargeView';
import { RefundWithdrawalView } from './components/RefundWithdrawalView';
import { UserDashboard, type NavTab } from './components/UserDashboard';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
  timestampToIso,
} from './firebase';
import { apiRequest } from './lib/api';
import { formatINR } from './lib/format';
import type {
  AddMoneyRequest,
  FinancialTransaction,
  MonthlyCommission,
  RechargeRequest,
  RefundRequest,
  UserNotification,
  UserProfile,
  WithdrawalRequest,
} from './types';

function sortDescByCreatedAt<T extends { createdAt: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [refreshTick, setRefreshTick] = useState(0);

  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [addMoneyRequests, setAddMoneyRequests] = useState<AddMoneyRequest[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [commissions, setCommissions] = useState<MonthlyCommission[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<UserNotification[]>([]);

  const checkAdminAndBootstrap = useCallback(async (u: User) => {
    const isBootstrapped =
      Boolean(u.emailVerified) &&
      (u.email || '').toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    let adminFlag = isBootstrapped;
    if (!adminFlag) {
      try {
        const adminSnap = await getDoc(doc(db, 'admins', u.uid));
        adminFlag = adminSnap.exists();
      } catch {
        adminFlag = false;
      }
    }
    setIsAdminUser(adminFlag);

    if (adminFlag) {
      try {
        await apiRequest('/api/auth/bootstrap-admin', { method: 'POST' });
      } catch (err) {
        console.error('Admin bootstrap error:', err);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (!u) {
        setProfile(null);
        setIsAdminUser(false);
        setProfileLoading(false);
        setAuthReady(true);
        return;
      }
      setProfileLoading(true);
      await checkAdminAndBootstrap(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, [checkAdminAndBootstrap]);

  // Listen to current user profile
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const path = `users/${firebaseUser.uid}`;
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
        } else {
          const d = snap.data();
          setProfile({
            ...(d as UserProfile),
            createdAt: timestampToIso(d.createdAt),
            updatedAt: timestampToIso(d.updatedAt),
          });
        }
        setProfileLoading(false);
      },
      (err) => {
        setProfileLoading(false);
        handleFirestoreError(err, OperationType.GET, path);
      },
    );
    return () => unsub();
  }, [authReady, firebaseUser, refreshTick]);

  // Listen to user's financial collections once activated
  useEffect(() => {
    if (!authReady || !firebaseUser || !profile?.isActivated) {
      setRecharges([]);
      setAddMoneyRequests([]);
      setRefunds([]);
      setWithdrawals([]);
      setCommissions([]);
      setTransactions([]);
      setUserNotifications([]);
      return;
    }

    const uid = firebaseUser.uid;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, 'rechargeRequests'), where('userId', '==', uid)),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const raw = d.data();
            return {
              ...(raw as RechargeRequest),
              createdAt: timestampToIso(raw.createdAt),
              updatedAt: timestampToIso(raw.updatedAt),
            };
          });
          setRecharges(sortDescByCreatedAt(rows));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'rechargeRequests'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'addMoneyRequests'), where('userId', '==', uid)),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const raw = d.data();
            return {
              ...(raw as AddMoneyRequest),
              createdAt: timestampToIso(raw.createdAt),
              updatedAt: timestampToIso(raw.updatedAt),
            };
          });
          setAddMoneyRequests(sortDescByCreatedAt(rows));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'addMoneyRequests'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'refundRequests'), where('userId', '==', uid)),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const raw = d.data();
            return {
              ...(raw as RefundRequest),
              createdAt: timestampToIso(raw.createdAt),
              updatedAt: timestampToIso(raw.updatedAt),
            };
          });
          setRefunds(sortDescByCreatedAt(rows));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'refundRequests'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'withdrawalRequests'), where('userId', '==', uid)),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const raw = d.data();
            return {
              ...(raw as WithdrawalRequest),
              createdAt: timestampToIso(raw.createdAt),
              updatedAt: timestampToIso(raw.updatedAt),
            };
          });
          setWithdrawals(sortDescByCreatedAt(rows));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawalRequests'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'monthlyCommissions'), where('userId', '==', uid)),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const raw = d.data();
            return {
              ...(raw as MonthlyCommission),
              createdAt: timestampToIso(raw.createdAt),
              updatedAt: timestampToIso(raw.updatedAt),
            };
          });
          setCommissions(sortDescByCreatedAt(rows));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'monthlyCommissions'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'transactions'), where('userId', '==', uid)),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const raw = d.data();
            return {
              ...(raw as FinancialTransaction),
              createdAt: timestampToIso(raw.createdAt),
            };
          });
          setTransactions(sortDescByCreatedAt(rows));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('targetUserId', '==', uid)),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const raw = d.data();
            return {
              ...(raw as UserNotification),
              createdAt: timestampToIso(raw.createdAt),
            };
          });
          setUserNotifications(sortDescByCreatedAt(rows));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'),
      ),
    );

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, firebaseUser, profile?.isActivated]);

  // Listen to ADMIN notifications when user is admin
  useEffect(() => {
    if (!authReady || !firebaseUser || !isAdminUser) {
      setAdminNotifications([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'notifications'), where('targetUserId', '==', 'ADMIN')),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const raw = d.data();
          return {
            ...(raw as UserNotification),
            createdAt: timestampToIso(raw.createdAt),
          };
        });
        setAdminNotifications(sortDescByCreatedAt(rows));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications_admin'),
    );
    return () => unsub();
  }, [authReady, firebaseUser, isAdminUser]);

  const combinedNotifications = useMemo(() => {
    if (!isAdminUser) return userNotifications;
    return sortDescByCreatedAt([...adminNotifications, ...userNotifications]);
  }, [isAdminUser, adminNotifications, userNotifications]);

  const unreadCount = combinedNotifications.filter((n) => !n.isRead).length;

  const isActivatedDashboard = Boolean(firebaseUser && profile && profile.isActivated && profile.status === 'active');

  if (!authReady || profileLoading || !isActivatedDashboard || !profile) {
    return (
      <AuthOnboarding
        firebaseUser={firebaseUser}
        profile={profile}
        loading={!authReady || profileLoading}
        onProfileUpdated={() => setRefreshTick((t) => t + 1)}
      />
    );
  }

  const resolvedTab: NavTab = activeTab === 'admin' && !isAdminUser ? 'dashboard' : activeTab;

  const navItems: Array<{ id: NavTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dashboard', label: 'डैशबोर्ड', icon: LayoutDashboard },
    { id: 'recharge', label: 'मोबाइल रिचार्ज', icon: Smartphone },
    { id: 'add_money', label: 'पैसे जोड़ें', icon: PlusCircle },
    { id: 'refund_withdraw', label: 'रिफंड / निकासी', icon: RefreshCw },
    { id: 'history', label: 'इतिहास व खाता बही', icon: History },
    { id: 'notifications', label: 'सूचनाएं', icon: Bell },
    ...(isAdminUser ? [{ id: 'admin' as NavTab, label: 'एडमिन पैनल', icon: Shield }] : []),
  ];

  const mobileTabs = isAdminUser
    ? [
        { id: 'dashboard' as NavTab, label: 'होम', icon: LayoutDashboard },
        { id: 'recharge' as NavTab, label: 'रिचार्ज', icon: Smartphone },
        { id: 'add_money' as NavTab, label: 'पैसे जोड़ें', icon: PlusCircle },
        { id: 'refund_withdraw' as NavTab, label: 'निकासी', icon: RefreshCw },
        { id: 'admin' as NavTab, label: 'एडमिन', icon: Shield },
      ]
    : [
        { id: 'dashboard' as NavTab, label: 'होम', icon: LayoutDashboard },
        { id: 'recharge' as NavTab, label: 'रिचार्ज', icon: Smartphone },
        { id: 'add_money' as NavTab, label: 'पैसे जोड़ें', icon: PlusCircle },
        { id: 'refund_withdraw' as NavTab, label: 'निकासी', icon: RefreshCw },
        { id: 'history' as NavTab, label: 'खाता बही', icon: History },
      ];

  const currentTabTitle = navItems.find((n) => n.id === resolvedTab)?.label || 'डैशबोर्ड';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-6">
          <span className="text-base font-bold tracking-tight text-blue-700 whitespace-nowrap">
            RECHARGE COMMISSION
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = resolvedTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:bg-blue-50/70 hover:text-blue-700'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span
                    className={`font-mono-tabular text-xs font-bold ${
                      active ? 'text-blue-100' : 'text-blue-600'
                    }`}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 px-2">
            <div className="truncate text-xs font-bold text-slate-900">{profile.displayName}</div>
            <div className="truncate font-mono-tabular text-[11px] text-slate-500">{profile.mobileNumber}</div>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="flex min-h-[42px] w-full items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            <span>लॉगआउट करें</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Top Bar (3 zones, compact 56px) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm font-bold text-blue-700 lg:hidden whitespace-nowrap">RECHARGE COMMISSION</span>
            <span className="hidden text-base font-bold text-slate-900 lg:inline whitespace-nowrap">
              {currentTabTitle}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden text-xs text-slate-500 sm:block whitespace-nowrap">
              वॉलेट:{' '}
              <span className="font-mono-tabular font-bold text-blue-700">
                {formatINR(profile.walletBalance || 0)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              aria-label="सूचनाएं"
              className="relative flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 font-mono-tabular text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => signOut(auth)}
              aria-label="लॉगआउट"
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Development Mode Notice */}
        <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-1.5 text-center text-[11px] font-medium text-blue-900 lg:px-8">
          डेमो मोड: यह एक कार्यात्मक डेमो है। वास्तविक धन संग्रह, स्वचालित भुगतान गेटवे या वास्तविक बैंक निकासी सक्षम नहीं है।
        </div>

        {/* Viewport Content */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-10">
          {resolvedTab === 'dashboard' && (
            <UserDashboard
              profile={profile}
              recharges={recharges}
              transactions={transactions}
              commissions={commissions}
              onNavigate={setActiveTab}
            />
          )}
          {resolvedTab === 'recharge' && <RechargeView profile={profile} recharges={recharges} />}
          {resolvedTab === 'add_money' && <AddMoneyView requests={addMoneyRequests} />}
          {resolvedTab === 'refund_withdraw' && (
            <RefundWithdrawalView
              profile={profile}
              recharges={recharges}
              refunds={refunds}
              withdrawals={withdrawals}
            />
          )}
          {resolvedTab === 'history' && (
            <HistoryLedgerView
              recharges={recharges}
              transactions={transactions}
              commissions={commissions}
            />
          )}
          {resolvedTab === 'notifications' && (
            <NotificationsView notifications={combinedNotifications} />
          )}
          {resolvedTab === 'admin' && isAdminUser && <AdminPanel />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="मोबाइल नेविगेशन"
        className="fixed bottom-0 left-0 right-0 z-30 grid h-16 grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden"
      >
        {mobileTabs.map((item) => {
          const Icon = item.icon;
          const active = resolvedTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
