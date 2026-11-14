# Security Specification — RECHARGE COMMISSION

## 1. Data Invariants
1. **Profile Integrity & Zero Self-Activation**: On `/users/{userId}` create, a non-admin user MUST set `uid == request.auth.uid`, `role == 'user'`, `isActivated == false`, `walletBalance == 0`, `depositBalance == 0`, `commissionBalance == 0`, and `status in ['pending_activation', 'pending_approval']`.
2. **Wallet Tampering Prohibition**: A user cannot arbitrarily modify `walletBalance`, `depositBalance`, `commissionBalance`, `isActivated`, `role`, or `status` (except transitioning `pending_activation -> pending_approval` with `activationRef`).
3. **Atomic Recharge Deduction**: A user can ONLY decrement `depositBalance`/`commissionBalance`/`walletBalance` during an atomic batch commit that synchronously creates a valid `/rechargeRequests/{requestId}` (`getAfter(...)`) AND `/transactions/{transactionId}` (`getAfter(...)`) where the deducted sum equals the recharge amount.
4. **Atomic Withdrawal Hold**: A user can ONLY decrement `commissionBalance`/`walletBalance` during an atomic batch commit that synchronously creates a valid `/withdrawalRequests/{requestId}` AND `/transactions/{transactionId}` where the deducted commission equals the withdrawal amount.
5. **Add Money Verification Gate**: Add money requests MUST be in multiples of ₹1000 (`amount >= 1000 && amount % 1000 == 0`) with initial `status == 'pending'`. Only an Admin can approve/reject.
6. **Duplicate Prevention**:
   - Refunds are keyed by `rechargeId` (`/refundRequests/{rechargeId}`), and creation requires the referenced recharge to exist, belong to `request.auth.uid`, and not already be `refunded` or `failed`.
   - Monthly commissions are keyed by `${userId}_${monthKey}` (`/monthlyCommissions/{commissionId}`), created ONLY by Admin.
   - Terminal states (`approved`, `rejected`, `success`, `failed`, `refunded`, `paid`, `credited`) are locked against non-admin modification.
7. **PII Isolation**: Only the owner (`request.auth.uid == userId`) or Admin can read `/users/{userId}`, `/addMoneyRequests`, `/rechargeRequests`, `/refundRequests`, `/withdrawalRequests`, `/monthlyCommissions`, `/transactions`.
8. **Admin Isolation**: Only bootstrapped Admin (`kiranjhojha@gmail.com` with `email_verified == true`) or UIDs in `/admins` have admin privileges.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Balance Injection on Register**: Creating `/users/{uid}` with `walletBalance: 50000`.
2. **Self-Role Escalation on Register**: Creating `/users/{uid}` with `role: 'admin'`, `isActivated: true`.
3. **Direct Balance Update**: Updating `/users/{uid}` `depositBalance: 10000` without an atomic recharge/admin write.
4. **Non-Admin Approving Add Money**: User updating `/addMoneyRequests/{reqId}` `status: 'approved'`.
5. **Invalid Add Money Multiple**: Creating `/addMoneyRequests/{reqId}` with `amount: 500` or `amount: 1500`.
6. **Shadow Field Injection**: Creating `/rechargeRequests/{reqId}` with extra field `isFree: true`.
7. **Identity Spoofing**: Creating `/rechargeRequests/{reqId}` with `userId: 'victim_uid'`.
8. **Orphaned Refund Request**: Creating `/refundRequests/{fakeId}` where `/rechargeRequests/{fakeId}` does not exist.
9. **Non-Admin Crediting Monthly Commission**: Creating `/monthlyCommissions/{uid}_2026-11` as a regular user.
10. **PII Cross-User Read**: User A calling `get` or `list` on User B's `/users/{userB}` or `/withdrawalRequests`.
11. **Timestamp Forgery**: Creating a document with backdated `createdAt` (`!= request.time`).
12. **Unverified Email Spoof**: Request with `email: 'kiranjhojha@gmail.com'` and `email_verified: false`.
