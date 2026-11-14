export type UserRole = 'user' | 'admin';
export type UserStatus = 'pending_activation' | 'pending_approval' | 'active' | 'suspended';
export type OperatorType = 'Jio' | 'Airtel' | 'Vi' | 'BSNL';
export type RechargeStatus = 'under_process' | 'success' | 'failed' | 'refunded';
export type AddMoneyStatus = 'pending' | 'approved' | 'rejected';
export type RefundStatus = 'pending' | 'approved' | 'rejected';
export type WithdrawalStatus = 'pending' | 'paid' | 'rejected';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  mobileNumber: string;
  inviteCode: string;
  otpVerified: boolean;
  role: UserRole;
  status: UserStatus;
  isActivated: boolean;
  activationFeeAmount: number;
  activationRef?: string;
  walletBalance: number;
  depositBalance: number;
  commissionBalance: number;
  lastOpType?: 'none' | 'recharge' | 'withdrawal' | 'admin';
  lastOpRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddMoneyRequest {
  requestId: string;
  userId: string;
  userMobile: string;
  userEmail: string;
  amount: number;
  paymentRef: string;
  status: AddMoneyStatus;
  adminNote?: string;
  processedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RechargeRequest {
  requestId: string;
  userId: string;
  userMobile: string;
  mobileNumber: string;
  operator: OperatorType;
  amount: number;
  deductedFromDeposit: number;
  deductedFromCommission: number;
  status: RechargeStatus;
  transactionRef?: string;
  adminNote?: string;
  monthKey: string;
  processedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequest {
  refundId: string;
  rechargeId: string;
  userId: string;
  wrongMobileNumber: string;
  correctMobileNumber: string;
  operator: OperatorType;
  amount: number;
  reason: string;
  status: RefundStatus;
  adminNote?: string;
  processedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalRequest {
  requestId: string;
  userId: string;
  userMobile: string;
  amount: number;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  status: WithdrawalStatus;
  paymentRef?: string;
  adminNote?: string;
  processedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyCommission {
  commissionId: string;
  userId: string;
  userMobile: string;
  monthKey: string;
  eligibleRechargeTotal: number;
  commissionRate: number;
  commissionAmount: number;
  eligibleCount: number;
  status: 'credited';
  approvedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialTransaction {
  transactionId: string;
  userId: string;
  type:
    | 'add_money_credit'
    | 'recharge_debit'
    | 'recharge_failed_refund'
    | 'refund_credit'
    | 'commission_credit'
    | 'withdrawal_hold'
    | 'withdrawal_refund'
    | 'activation_fee_demo';
  amount: number;
  direction: 'credit' | 'debit';
  balanceBucket: 'deposit' | 'commission' | 'mixed' | 'activation';
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface UserNotification {
  notificationId: string;
  targetUserId: string;
  title: string;
  message: string;
  category: 'activation' | 'add_money' | 'recharge' | 'commission' | 'refund' | 'withdrawal' | 'system';
  isRead: boolean;
  createdAt: string;
}

export interface InviteCode {
  code: string;
  label: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyCommissionPreview {
  userId: string;
  userMobile: string;
  displayName: string;
  userEmail: string;
  monthKey: string;
  eligibleRechargeTotal: number;
  eligibleCount: number;
  commissionAmount: number;
  alreadyCredited: boolean;
  creditedRecord?: MonthlyCommission;
}

export interface AdminOverviewData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    pendingActivation: number;
    pendingAddMoney: number;
    underProcessRecharges: number;
    pendingRefunds: number;
    pendingWithdrawals: number;
  };
  users: UserProfile[];
  addMoneyRequests: AddMoneyRequest[];
  rechargeRequests: RechargeRequest[];
  refundRequests: RefundRequest[];
  withdrawalRequests: WithdrawalRequest[];
  monthlyCommissions: MonthlyCommission[];
  transactions: FinancialTransaction[];
  inviteCodes: InviteCode[];
  commissionPreviews: MonthlyCommissionPreview[];
}
