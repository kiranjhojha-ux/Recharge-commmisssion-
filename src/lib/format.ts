import type {
  AddMoneyStatus,
  FinancialTransaction,
  RechargeStatus,
  RefundStatus,
  UserStatus,
  WithdrawalStatus,
} from '../types';

export function formatINR(amount: number): string {
  const num = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDateTimeHi(iso: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('hi-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthKeyHi(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const months = [
    'जनवरी',
    'फ़रवरी',
    'मार्च',
    'अप्रैल',
    'मई',
    'जून',
    'जुलाई',
    'अगस्त',
    'सितंबर',
    'अक्टूबर',
    'नवंबर',
    'दिसंबर',
  ];
  const idx = Number(m) - 1;
  return `${months[idx] || m} ${y}`;
}

export const USER_STATUS_HI: Record<UserStatus, { label: string; tone: string }> = {
  pending_activation: { label: 'सक्रियण शेष (₹499)', tone: 'text-amber-700' },
  pending_approval: { label: 'एडमिन अनुमोदन लंबित', tone: 'text-blue-700' },
  active: { label: 'सक्रिय', tone: 'text-emerald-700' },
  suspended: { label: 'निलंबित', tone: 'text-red-700' },
};

export const RECHARGE_STATUS_HI: Record<RechargeStatus, { label: string; tone: string }> = {
  under_process: { label: 'प्रक्रियाधीन (Under Process)', tone: 'text-blue-700' },
  success: { label: 'सफल (Success)', tone: 'text-emerald-700' },
  failed: { label: 'विफल (Failed)', tone: 'text-red-700' },
  refunded: { label: 'रिफंड किया गया (Refunded)', tone: 'text-amber-700' },
};

export const ADD_MONEY_STATUS_HI: Record<AddMoneyStatus, { label: string; tone: string }> = {
  pending: { label: 'सत्यापन लंबित', tone: 'text-blue-700' },
  approved: { label: 'स्वीकृत और क्रेडिट', tone: 'text-emerald-700' },
  rejected: { label: 'अस्वीकृत', tone: 'text-red-700' },
};

export const REFUND_STATUS_HI: Record<RefundStatus, { label: string; tone: string }> = {
  pending: { label: 'समीक्षा लंबित', tone: 'text-blue-700' },
  approved: { label: 'स्वीकृत (रिफंडेड)', tone: 'text-emerald-700' },
  rejected: { label: 'अस्वीकृत', tone: 'text-red-700' },
};

export const WITHDRAWAL_STATUS_HI: Record<WithdrawalStatus, { label: string; tone: string }> = {
  pending: { label: 'प्रक्रियाधीन', tone: 'text-blue-700' },
  paid: { label: 'भुगतान किया गया (Paid)', tone: 'text-emerald-700' },
  rejected: { label: 'अस्वीकृत', tone: 'text-red-700' },
};

export const TX_TYPE_HI: Record<FinancialTransaction['type'], string> = {
  add_money_credit: 'वॉलेट डिपॉजिट क्रेडिट',
  recharge_debit: 'मोबाइल रिचार्ज कटौती',
  recharge_failed_refund: 'विफल रिचार्ज वापसी',
  refund_credit: 'गलत रिचार्ज रिफंड क्रेडिट',
  commission_credit: 'मासिक 10% कमीशन क्रेडिट',
  withdrawal_hold: 'कमीशन निकासी अनुरोध',
  withdrawal_refund: 'अस्वीकृत निकासी वापसी',
  activation_fee_demo: '₹499 खाता सक्रियण (डेमो)',
};
