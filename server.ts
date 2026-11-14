import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  commitFirestoreWrites,
  firebaseConfig,
  getFirestoreDoc,
  isUserAdmin,
  queryFirestoreCollection,
  verifyFirebaseIdToken,
} from './server/firestoreRest.ts';
import type { VerifiedFirebaseUser } from './server/firestoreRest.ts';
import type {
  AddMoneyRequest,
  FinancialTransaction,
  InviteCode,
  MonthlyCommission,
  MonthlyCommissionPreview,
  OperatorType,
  RechargeRequest,
  RefundRequest,
  UserProfile,
  WithdrawalRequest,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OTP_SECRET =
  process.env.OTP_SECRET ||
  crypto.createHash('sha256').update(`${firebaseConfig.projectId}:${firebaseConfig.apiKey}:rc-demo-otp`).digest('hex');

const VALID_OPERATORS: OperatorType[] = ['Jio', 'Airtel', 'Vi', 'BSNL'];

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function getCurrentIstMonthKey(): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const istDate = new Date(istMs);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function makeUniqueId(prefix: string): string {
  const now = new Date();
  const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
    now.getUTCDate(),
  ).padStart(2, '0')}`;
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

function signOtpToken(uid: string, mobileNumber: string, otp: string, expiresAt: number): string {
  const payload = `${uid}|${mobileNumber}|${otp}|${expiresAt}`;
  const sig = crypto.createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

function verifyOtpToken(token: string, uid: string, mobileNumber: string, otpInput: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    if (parts.length !== 5) return false;
    const [tokenUid, tokenMobile, tokenOtp, expStr, sig] = parts;
    const expiresAt = Number(expStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
    if (tokenUid !== uid || tokenMobile !== mobileNumber) return false;

    const expectedSig = crypto
      .createHmac('sha256', OTP_SECRET)
      .update(`${tokenUid}|${tokenMobile}|${tokenOtp}|${expStr}`)
      .digest('hex');

    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }

    const inputBuf = Buffer.from(otpInput.trim(), 'utf8');
    const otpBuf = Buffer.from(tokenOtp, 'utf8');
    return inputBuf.length === otpBuf.length && crypto.timingSafeEqual(inputBuf, otpBuf);
  } catch {
    return false;
  }
}

async function authenticate(req: Request, res: Response): Promise<VerifiedFirebaseUser | null> {
  try {
    return await verifyFirebaseIdToken(req.headers.authorization);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'अमान्य प्रमाणीकरण।';
    const status = message.startsWith('FORBIDDEN') ? 403 : 401;
    res.status(status).json({ error: message.replace(/^(UNAUTHENTICATED|FORBIDDEN):\s*/, '') });
    return null;
  }
}

async function authenticateAdmin(req: Request, res: Response): Promise<VerifiedFirebaseUser | null> {
  const user = await authenticate(req, res);
  if (!user) return null;
  const admin = await isUserAdmin(user);
  if (!admin) {
    res.status(403).json({ error: 'अस्वीकृत: केवल एडमिन ही इस अनुभाग तक पहुँच सकते हैं।' });
    return null;
  }
  return user;
}

function handleApiError(res: Response, err: unknown) {
  console.error('API Error:', err);
  const msg = err instanceof Error ? err.message : 'सर्वर त्रुटि हुई।';
  if (msg.includes('ALREADY_EXISTS') || msg.includes('FAILED_PRECONDITION')) {
    res.status(409).json({ error: 'यह लेनदेन या अनुरोध पहले ही संसाधित हो चुका है।' });
    return;
  }
  if (msg.includes('PERMISSION_DENIED')) {
    res.status(403).json({ error: 'सुरक्षा नियमों द्वारा यह कार्रवाई अस्वीकृत की गई है।' });
    return;
  }
  res.status(500).json({ error: msg });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'RECHARGE COMMISSION', mode: 'development-demo' });
  });

  // 1. Bootstrap Admin profile automatically on sign-in if email matches bootstrapped admin
  app.post('/api/auth/bootstrap-admin', async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
      const admin = await isUserAdmin(user);
      if (!admin) {
        res.status(403).json({ error: 'एडमिन अनुमति नहीं है।' });
        return;
      }

      const existing = await getFirestoreDoc<UserProfile>(`users/${user.uid}`, user.idToken);
      if (existing.exists && existing.data) {
        if (existing.data.role !== 'admin' || !existing.data.isActivated) {
          await commitFirestoreWrites(
            [
              {
                docPath: `users/${user.uid}`,
                fields: {
                  role: 'admin',
                  status: 'active',
                  isActivated: true,
                },
                updateMask: ['role', 'status', 'isActivated'],
                serverTimestampFields: ['updatedAt'],
                precondition: { updateTime: existing.updateTime },
              },
            ],
            user.idToken,
          );
        }
        res.json({ ok: true, bootstrapped: false });
        return;
      }

      await commitFirestoreWrites(
        [
          {
            docPath: `users/${user.uid}`,
            fields: {
              uid: user.uid,
              email: user.email,
              displayName: user.name,
              mobileNumber: '9999999999',
              inviteCode: 'ADMIN2026',
              otpVerified: true,
              role: 'admin',
              status: 'active',
              isActivated: true,
              activationFeeAmount: 499,
              activationRef: 'ADMIN_BOOTSTRAP',
              walletBalance: 0,
              depositBalance: 0,
              commissionBalance: 0,
              lastOpType: 'admin',
              lastOpRef: 'INIT',
            },
            serverTimestampFields: ['createdAt', 'updatedAt'],
            precondition: { exists: false },
          },
        ],
        user.idToken,
      );

      res.json({ ok: true, bootstrapped: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 2. Send Demo OTP for Registration
  app.post('/api/auth/send-otp', async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    const mobileNumber = String(req.body?.mobileNumber || '').trim();
    if (!/^[6-9][0-9]{9}$/.test(mobileNumber)) {
      res.status(400).json({ error: 'कृपया 10 अंकों का मान्य भारतीय मोबाइल नंबर दर्ज करें।' });
      return;
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const challengeToken = signOtpToken(user.uid, mobileNumber, otp, expiresAt);

    res.json({
      ok: true,
      challengeToken,
      expiresAt,
      demoOtp: otp,
      message: 'डेमो मोड: OTP सफलतापूर्वक जनरेट किया गया।',
    });
  });

  // 3. Verify OTP + Invite Code and Register User Profile
  app.post('/api/auth/verify-otp', async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
      const mobileNumber = String(req.body?.mobileNumber || '').trim();
      const otp = String(req.body?.otp || '').trim();
      const challengeToken = String(req.body?.challengeToken || '').trim();
      const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase();
      const displayName = String(req.body?.displayName || user.name).trim().slice(0, 120);

      if (!/^[6-9][0-9]{9}$/.test(mobileNumber)) {
        res.status(400).json({ error: 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।' });
        return;
      }
      if (!/^[0-9]{6}$/.test(otp)) {
        res.status(400).json({ error: 'कृपया 6 अंकों का OTP दर्ज करें।' });
        return;
      }
      if (!verifyOtpToken(challengeToken, user.uid, mobileNumber, otp)) {
        res.status(400).json({ error: 'OTP गलत है या समय समाप्त हो गया है। कृपया नया OTP प्राप्त करें।' });
        return;
      }
      if (!inviteCode || inviteCode.length < 3 || inviteCode.length > 32 || !/^[A-Z0-9_-]+$/.test(inviteCode)) {
        res.status(400).json({ error: 'कृपया मान्य आमंत्रण कोड (Invite Code) दर्ज करें (जैसे: RC2026)।' });
        return;
      }

      if (inviteCode !== 'RC2026') {
        const inviteDoc = await getFirestoreDoc<InviteCode>(`inviteCodes/${inviteCode}`, user.idToken);
        if (!inviteDoc.exists || !inviteDoc.data || !inviteDoc.data.isActive) {
          res.status(400).json({
            error: 'अमान्य या निष्क्रिय आमंत्रण कोड। कृपया एडमिन से प्राप्त मान्य आमंत्रण कोड दर्ज करें।',
          });
          return;
        }
      }

      const existing = await getFirestoreDoc<UserProfile>(`users/${user.uid}`, user.idToken);
      if (existing.exists) {
        res.status(409).json({ error: 'आपका खाता पहले से पंजीकृत है।' });
        return;
      }

      const isBootstrapped = user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() && user.emailVerified;

      await commitFirestoreWrites(
        [
          {
            docPath: `users/${user.uid}`,
            fields: {
              uid: user.uid,
              email: user.email,
              displayName: displayName || user.name,
              mobileNumber,
              inviteCode,
              otpVerified: true,
              role: isBootstrapped ? 'admin' : 'user',
              status: isBootstrapped ? 'active' : 'pending_activation',
              isActivated: isBootstrapped,
              activationFeeAmount: 499,
              walletBalance: 0,
              depositBalance: 0,
              commissionBalance: 0,
              lastOpType: 'none',
              lastOpRef: '',
            },
            serverTimestampFields: ['createdAt', 'updatedAt'],
            precondition: { exists: false },
          },
        ],
        user.idToken,
      );

      res.json({ ok: true, status: isBootstrapped ? 'active' : 'pending_activation' });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 4. Submit Rs 499 Activation Fee Demo Reference for Admin Approval
  app.post('/api/auth/submit-activation', async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
      const activationRef = String(req.body?.activationRef || '').trim();
      if (activationRef.length < 4 || activationRef.length > 100) {
        res.status(400).json({ error: 'कृपया कम से कम 4 अक्षरों का भुगतान संदर्भ / डेमो UTR दर्ज करें।' });
        return;
      }

      const userDoc = await getFirestoreDoc<UserProfile>(`users/${user.uid}`, user.idToken);
      if (!userDoc.exists || !userDoc.data) {
        res.status(404).json({ error: 'उपयोगकर्ता प्रोफ़ाइल नहीं मिली।' });
        return;
      }
      if (userDoc.data.status !== 'pending_activation') {
        res.status(409).json({ error: 'सक्रियण अनुरोध पहले ही सबमिट किया जा चुका है या खाता सक्रिय है।' });
        return;
      }

      const notifId = makeUniqueId('NTF');
      await commitFirestoreWrites(
        [
          {
            docPath: `users/${user.uid}`,
            fields: {
              status: 'pending_approval',
              activationRef,
            },
            updateMask: ['status', 'activationRef'],
            serverTimestampFields: ['updatedAt'],
            precondition: { updateTime: userDoc.updateTime },
          },
          {
            docPath: `notifications/${notifId}`,
            fields: {
              notificationId: notifId,
              targetUserId: 'ADMIN',
              title: 'नया ₹499 खाता सक्रियण अनुरोध',
              message: `${userDoc.data.displayName} (${userDoc.data.mobileNumber}) ने सक्रियण संदर्भ ${activationRef} सबमिट किया है।`,
              category: 'activation',
              isRead: false,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
        ],
        user.idToken,
      );

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 5. Add Money Request (Minimum Rs 1000, Multiples of Rs 1000 only, Admin verification required)
  app.post('/api/wallet/add-money', async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
      const amount = Number(req.body?.amount);
      const paymentRef = String(req.body?.paymentRef || '').trim();

      if (!Number.isInteger(amount) || amount < 1000 || amount > 500000 || amount % 1000 !== 0) {
        res.status(400).json({
          error: 'न्यूनतम राशि ₹1000 है और केवल ₹1000 के गुणज (₹1000, ₹2000, ₹3000...) ही मान्य हैं।',
        });
        return;
      }
      if (paymentRef.length < 3 || paymentRef.length > 100) {
        res.status(400).json({ error: 'कृपया मान्य डेमो भुगतान संदर्भ / UTR दर्ज करें।' });
        return;
      }

      const userDoc = await getFirestoreDoc<UserProfile>(`users/${user.uid}`, user.idToken);
      if (!userDoc.exists || !userDoc.data || !userDoc.data.isActivated || userDoc.data.status !== 'active') {
        res.status(403).json({ error: 'पैसे जोड़ने के लिए आपका खाता एडमिन द्वारा सक्रिय होना आवश्यक है।' });
        return;
      }

      const requestId = makeUniqueId('ADD');
      const notifId = makeUniqueId('NTF');

      await commitFirestoreWrites(
        [
          {
            docPath: `addMoneyRequests/${requestId}`,
            fields: {
              requestId,
              userId: user.uid,
              userMobile: userDoc.data.mobileNumber,
              userEmail: userDoc.data.email,
              amount,
              paymentRef,
              status: 'pending',
            },
            serverTimestampFields: ['createdAt', 'updatedAt'],
            precondition: { exists: false },
          },
          {
            docPath: `notifications/${notifId}`,
            fields: {
              notificationId: notifId,
              targetUserId: 'ADMIN',
              title: 'नया पैसे जोड़ने का अनुरोध',
              message: `${userDoc.data.displayName} (${userDoc.data.mobileNumber}) ने ₹${amount} जोड़ने का अनुरोध किया है (संदर्भ: ${paymentRef})।`,
              category: 'add_money',
              isRead: false,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
        ],
        user.idToken,
      );

      res.json({ ok: true, requestId });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 6. Mobile Recharge (Atomic server-side wallet deduction + Under Process status + Notify Admin)
  app.post('/api/recharge/create', async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
      const mobileNumber = String(req.body?.mobileNumber || '').trim();
      const operator = String(req.body?.operator || '').trim() as OperatorType;
      const amount = Number(req.body?.amount);

      if (!/^[6-9][0-9]{9}$/.test(mobileNumber)) {
        res.status(400).json({ error: 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।' });
        return;
      }
      if (!VALID_OPERATORS.includes(operator)) {
        res.status(400).json({ error: 'कृपया मान्य ऑपरेटर चुनें (Jio, Airtel, Vi, BSNL)।' });
        return;
      }
      if (!Number.isInteger(amount) || amount < 10 || amount > 50000) {
        res.status(400).json({ error: 'रिचार्ज राशि ₹10 से ₹50,000 के बीच पूर्णांक होनी चाहिए।' });
        return;
      }

      const userDoc = await getFirestoreDoc<UserProfile>(`users/${user.uid}`, user.idToken);
      if (!userDoc.exists || !userDoc.data) {
        res.status(404).json({ error: 'उपयोगकर्ता प्रोफ़ाइल नहीं मिली।' });
        return;
      }
      const profile = userDoc.data;
      if (!profile.isActivated || profile.status !== 'active') {
        res.status(403).json({ error: 'रिचार्ज करने के लिए आपका खाता सक्रिय होना आवश्यक है।' });
        return;
      }

      const depositBal = roundMoney(profile.depositBalance || 0);
      const commissionBal = roundMoney(profile.commissionBalance || 0);
      const totalBal = roundMoney(depositBal + commissionBal);

      if (totalBal < amount) {
        res.status(400).json({
          error: `वॉलेट में पर्याप्त बैलेंस नहीं है। उपलब्ध बैलेंस: ₹${totalBal.toFixed(2)}`,
        });
        return;
      }

      const deductedFromDeposit = roundMoney(Math.min(depositBal, amount));
      const deductedFromCommission = roundMoney(amount - deductedFromDeposit);
      const newDeposit = roundMoney(depositBal - deductedFromDeposit);
      const newCommission = roundMoney(commissionBal - deductedFromCommission);
      const newWallet = roundMoney(newDeposit + newCommission);

      const requestId = makeUniqueId('RCH');
      const txId = makeUniqueId('TXN');
      const notifId = makeUniqueId('NTF');
      const monthKey = getCurrentIstMonthKey();

      const balanceBucket =
        deductedFromDeposit > 0 && deductedFromCommission > 0
          ? 'mixed'
          : deductedFromDeposit > 0
          ? 'deposit'
          : 'commission';

      await commitFirestoreWrites(
        [
          {
            docPath: `users/${user.uid}`,
            fields: {
              walletBalance: newWallet,
              depositBalance: newDeposit,
              commissionBalance: newCommission,
              lastOpType: 'recharge',
              lastOpRef: requestId,
            },
            updateMask: ['walletBalance', 'depositBalance', 'commissionBalance', 'lastOpType', 'lastOpRef'],
            serverTimestampFields: ['updatedAt'],
            precondition: { updateTime: userDoc.updateTime },
          },
          {
            docPath: `rechargeRequests/${requestId}`,
            fields: {
              requestId,
              userId: user.uid,
              userMobile: profile.mobileNumber,
              mobileNumber,
              operator,
              amount,
              deductedFromDeposit,
              deductedFromCommission,
              status: 'under_process',
              monthKey,
            },
            serverTimestampFields: ['createdAt', 'updatedAt'],
            precondition: { exists: false },
          },
          {
            docPath: `transactions/${txId}`,
            fields: {
              transactionId: txId,
              userId: user.uid,
              type: 'recharge_debit',
              amount,
              direction: 'debit',
              balanceBucket,
              referenceId: requestId,
              description: `${operator} मोबाइल ${mobileNumber} का रिचार्ज अनुरोध (प्रक्रियाधीन)`,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
          {
            docPath: `notifications/${notifId}`,
            fields: {
              notificationId: notifId,
              targetUserId: 'ADMIN',
              title: 'नया मोबाइल रिचार्ज अनुरोध',
              message: `${profile.displayName} ने ${operator} (${mobileNumber}) के लिए ₹${amount} का रिचार्ज अनुरोध किया है (${requestId})।`,
              category: 'recharge',
              isRead: false,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
        ],
        user.idToken,
      );

      res.json({ ok: true, requestId, status: 'under_process' });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 7. Submit Wrong Recharge Refund Request (keyed by rechargeId to prevent duplicate refunds)
  app.post('/api/refund/create', async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
      const rechargeId = String(req.body?.rechargeId || '').trim();
      const correctMobileNumber = String(req.body?.correctMobileNumber || '').trim();
      const reason = String(req.body?.reason || '').trim();

      if (!rechargeId || !/^[a-zA-Z0-9_-]+$/.test(rechargeId)) {
        res.status(400).json({ error: 'अमान्य रिचार्ज आईडी।' });
        return;
      }
      if (!/^[6-9][0-9]{9}$/.test(correctMobileNumber)) {
        res.status(400).json({ error: 'कृपया 10 अंकों का सही मोबाइल नंबर दर्ज करें।' });
        return;
      }
      if (reason.length < 3 || reason.length > 500) {
        res.status(400).json({ error: 'कृपया रिफंड का कारण (3 से 500 अक्षर) लिखें।' });
        return;
      }

      const rechargeDoc = await getFirestoreDoc<RechargeRequest>(`rechargeRequests/${rechargeId}`, user.idToken);
      if (!rechargeDoc.exists || !rechargeDoc.data) {
        res.status(404).json({ error: 'रिचार्ज रिकॉर्ड नहीं मिला।' });
        return;
      }
      if (rechargeDoc.data.userId !== user.uid) {
        res.status(403).json({ error: 'अस्वीकृत: आप केवल अपने रिचार्ज के लिए रिफंड का अनुरोध कर सकते हैं।' });
        return;
      }
      if (rechargeDoc.data.status !== 'under_process' && rechargeDoc.data.status !== 'success') {
        res.status(400).json({ error: 'केवल प्रक्रियाधीन या सफल रिचार्ज के लिए ही रिफंड अनुरोध किया जा सकता है।' });
        return;
      }

      const existingRefund = await getFirestoreDoc<RefundRequest>(`refundRequests/${rechargeId}`, user.idToken);
      if (existingRefund.exists) {
        res.status(409).json({ error: 'इस रिचार्ज के लिए रिफंड अनुरोध पहले से मौजूद है।' });
        return;
      }

      const refundId = makeUniqueId('RFD');
      const notifId = makeUniqueId('NTF');

      await commitFirestoreWrites(
        [
          {
            docPath: `refundRequests/${rechargeId}`,
            fields: {
              refundId,
              rechargeId,
              userId: user.uid,
              wrongMobileNumber: rechargeDoc.data.mobileNumber,
              correctMobileNumber,
              operator: rechargeDoc.data.operator,
              amount: rechargeDoc.data.amount,
              reason,
              status: 'pending',
            },
            serverTimestampFields: ['createdAt', 'updatedAt'],
            precondition: { exists: false },
          },
          {
            docPath: `notifications/${notifId}`,
            fields: {
              notificationId: notifId,
              targetUserId: 'ADMIN',
              title: 'नया गलत रिचार्ज रिफंड अनुरोध',
              message: `रिचार्ज ${rechargeId} (₹${rechargeDoc.data.amount}) के लिए रिफंड अनुरोध प्राप्त हुआ है। सही नंबर: ${correctMobileNumber}`,
              category: 'refund',
              isRead: false,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
        ],
        user.idToken,
      );

      res.json({ ok: true, refundId });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 8. Submit Commission Withdrawal Request (Atomic commission hold)
  app.post('/api/withdrawal/create', async (req, res) => {
    const user = await authenticate(req, res);
    if (!user) return;

    try {
      const amount = roundMoney(Number(req.body?.amount));
      const accountHolderName = String(req.body?.accountHolderName || '').trim();
      const bankName = String(req.body?.bankName || '').trim();
      const accountNumber = String(req.body?.accountNumber || '').trim();
      const ifscCode = String(req.body?.ifscCode || '').trim().toUpperCase();

      if (!Number.isFinite(amount) || amount < 100 || amount > 500000) {
        res.status(400).json({ error: 'न्यूनतम निकासी राशि ₹100 है।' });
        return;
      }
      if (accountHolderName.length < 2 || accountHolderName.length > 120) {
        res.status(400).json({ error: 'कृपया खाताधारक का मान्य नाम दर्ज करें।' });
        return;
      }
      if (bankName.length < 2 || bankName.length > 120) {
        res.status(400).json({ error: 'कृपया बैंक का मान्य नाम दर्ज करें।' });
        return;
      }
      if (accountNumber.length < 6 || accountNumber.length > 40) {
        res.status(400).json({ error: 'कृपया मान्य बैंक खाता संख्या दर्ज करें।' });
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        res.status(400).json({ error: 'कृपया 11 अक्षरों का मान्य IFSC कोड दर्ज करें (जैसे: SBIN0001234)।' });
        return;
      }

      const userDoc = await getFirestoreDoc<UserProfile>(`users/${user.uid}`, user.idToken);
      if (!userDoc.exists || !userDoc.data) {
        res.status(404).json({ error: 'उपयोगकर्ता प्रोफ़ाइल नहीं मिली।' });
        return;
      }
      const profile = userDoc.data;
      if (!profile.isActivated || profile.status !== 'active') {
        res.status(403).json({ error: 'निकासी के लिए खाता सक्रिय होना आवश्यक है।' });
        return;
      }

      const commissionBal = roundMoney(profile.commissionBalance || 0);
      if (commissionBal < amount) {
        res.status(400).json({
          error: `पर्याप्त कमीशन बैलेंस नहीं है। उपलब्ध कमीशन: ₹${commissionBal.toFixed(2)}`,
        });
        return;
      }

      const newCommission = roundMoney(commissionBal - amount);
      const newWallet = roundMoney((profile.depositBalance || 0) + newCommission);
      const requestId = makeUniqueId('WDR');
      const txId = makeUniqueId('TXN');
      const notifId = makeUniqueId('NTF');

      await commitFirestoreWrites(
        [
          {
            docPath: `users/${user.uid}`,
            fields: {
              commissionBalance: newCommission,
              walletBalance: newWallet,
              lastOpType: 'withdrawal',
              lastOpRef: requestId,
            },
            updateMask: ['commissionBalance', 'walletBalance', 'lastOpType', 'lastOpRef'],
            serverTimestampFields: ['updatedAt'],
            precondition: { updateTime: userDoc.updateTime },
          },
          {
            docPath: `withdrawalRequests/${requestId}`,
            fields: {
              requestId,
              userId: user.uid,
              userMobile: profile.mobileNumber,
              amount,
              accountHolderName,
              bankName,
              accountNumber,
              ifscCode,
              status: 'pending',
            },
            serverTimestampFields: ['createdAt', 'updatedAt'],
            precondition: { exists: false },
          },
          {
            docPath: `transactions/${txId}`,
            fields: {
              transactionId: txId,
              userId: user.uid,
              type: 'withdrawal_hold',
              amount,
              direction: 'debit',
              balanceBucket: 'commission',
              referenceId: requestId,
              description: `कमीशन निकासी अनुरोध (${bankName} - ${ifscCode})`,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
          {
            docPath: `notifications/${notifId}`,
            fields: {
              notificationId: notifId,
              targetUserId: 'ADMIN',
              title: 'नया कमीशन निकासी अनुरोध',
              message: `${profile.displayName} ने ₹${amount.toFixed(2)} कमीशन निकासी का अनुरोध किया है (${bankName})।`,
              category: 'withdrawal',
              isRead: false,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
        ],
        user.idToken,
      );

      res.json({ ok: true, requestId });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // ================== ADMIN ENDPOINTS ==================

  // 9. Admin Overview & Monthly Commission Calculation Preview
  app.get('/api/admin/overview', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const monthKey = String(req.query.monthKey || getCurrentIstMonthKey());
      const [
        usersRows,
        addMoneyRows,
        rechargeRows,
        refundRows,
        withdrawalRows,
        commissionRows,
        transactionRows,
        inviteCodeRows,
      ] = await Promise.all([
        queryFirestoreCollection<UserProfile>('users', admin.idToken),
        queryFirestoreCollection<AddMoneyRequest>('addMoneyRequests', admin.idToken),
        queryFirestoreCollection<RechargeRequest>('rechargeRequests', admin.idToken),
        queryFirestoreCollection<RefundRequest>('refundRequests', admin.idToken),
        queryFirestoreCollection<WithdrawalRequest>('withdrawalRequests', admin.idToken),
        queryFirestoreCollection<MonthlyCommission>('monthlyCommissions', admin.idToken),
        queryFirestoreCollection<FinancialTransaction>('transactions', admin.idToken),
        queryFirestoreCollection<InviteCode>('inviteCodes', admin.idToken),
      ]);

      const sortDesc = <T extends { createdAt?: string }>(arr: T[]): T[] =>
        [...arr].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

      const users = sortDesc(usersRows.map((r) => r.data));
      const addMoneyRequests = sortDesc(addMoneyRows.map((r) => r.data));
      const rechargeRequests = sortDesc(rechargeRows.map((r) => r.data));
      const refundRequests = sortDesc(refundRows.map((r) => r.data));
      const withdrawalRequests = sortDesc(withdrawalRows.map((r) => r.data));
      const monthlyCommissions = sortDesc(commissionRows.map((r) => r.data));
      const transactions = sortDesc(transactionRows.map((r) => r.data));
      const inviteCodes = sortDesc(inviteCodeRows.map((r) => r.data));

      // Calculate 10% eligible monthly commission per user (ONLY status === 'success')
      const commissionByKey = new Map<string, MonthlyCommission>();
      for (const c of monthlyCommissions) {
        commissionByKey.set(`${c.userId}_${c.monthKey}`, c);
      }

      const eligibleByUser = new Map<string, { total: number; count: number }>();
      for (const r of rechargeRequests) {
        if (r.monthKey === monthKey && r.status === 'success') {
          const prev = eligibleByUser.get(r.userId) || { total: 0, count: 0 };
          eligibleByUser.set(r.userId, {
            total: roundMoney(prev.total + r.amount),
            count: prev.count + 1,
          });
        }
      }

      const commissionPreviews: MonthlyCommissionPreview[] = [];
      for (const u of users) {
        const agg = eligibleByUser.get(u.uid);
        const creditedRecord = commissionByKey.get(`${u.uid}_${monthKey}`);
        if ((agg && agg.total > 0) || creditedRecord) {
          const eligibleRechargeTotal = agg ? agg.total : creditedRecord?.eligibleRechargeTotal || 0;
          const eligibleCount = agg ? agg.count : creditedRecord?.eligibleCount || 0;
          commissionPreviews.push({
            userId: u.uid,
            userMobile: u.mobileNumber,
            displayName: u.displayName,
            userEmail: u.email,
            monthKey,
            eligibleRechargeTotal,
            eligibleCount,
            commissionAmount: creditedRecord
              ? creditedRecord.commissionAmount
              : roundMoney(eligibleRechargeTotal * 0.1),
            alreadyCredited: Boolean(creditedRecord),
            creditedRecord,
          });
        }
      }

      res.json({
        stats: {
          totalUsers: users.length,
          activeUsers: users.filter((u) => u.status === 'active' && u.isActivated).length,
          pendingActivation: users.filter((u) => u.status === 'pending_approval' || u.status === 'pending_activation')
            .length,
          pendingAddMoney: addMoneyRequests.filter((r) => r.status === 'pending').length,
          underProcessRecharges: rechargeRequests.filter((r) => r.status === 'under_process').length,
          pendingRefunds: refundRequests.filter((r) => r.status === 'pending').length,
          pendingWithdrawals: withdrawalRequests.filter((r) => r.status === 'pending').length,
        },
        users,
        addMoneyRequests,
        rechargeRequests,
        refundRequests,
        withdrawalRequests,
        monthlyCommissions,
        transactions,
        inviteCodes,
        commissionPreviews,
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 10. Approve or Reject User Rs 499 Activation
  app.post('/api/admin/users/:uid/approve-activation', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const targetUid = req.params.uid;
      const action = req.body?.action === 'reject' ? 'reject' : 'approve';
      const userDoc = await getFirestoreDoc<UserProfile>(`users/${targetUid}`, admin.idToken);

      if (!userDoc.exists || !userDoc.data) {
        res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला।' });
        return;
      }
      if (userDoc.data.isActivated && action === 'approve') {
        res.status(409).json({ error: 'यह खाता पहले से सक्रिय है।' });
        return;
      }

      const notifId = makeUniqueId('NTF');
      const txId = makeUniqueId('TXN');

      if (action === 'approve') {
        await commitFirestoreWrites(
          [
            {
              docPath: `users/${targetUid}`,
              fields: {
                status: 'active',
                isActivated: true,
              },
              updateMask: ['status', 'isActivated'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: userDoc.updateTime },
            },
            {
              docPath: `transactions/${txId}`,
              fields: {
                transactionId: txId,
                userId: targetUid,
                type: 'activation_fee_demo',
                amount: 499,
                direction: 'debit',
                balanceBucket: 'activation',
                referenceId: userDoc.data.activationRef || 'DEMO_499',
                description: '₹499 खाता सक्रियण शुल्क सत्यापित और खाता सक्रिय किया गया',
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: targetUid,
                title: 'खाता सक्रिय हो गया है',
                message: 'बधाई हो! आपका ₹499 सक्रियण सत्यापित हो गया है और आपका खाता अब सक्रिय है।',
                category: 'activation',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      } else {
        await commitFirestoreWrites(
          [
            {
              docPath: `users/${targetUid}`,
              fields: {
                status: 'pending_activation',
                isActivated: false,
              },
              updateMask: ['status', 'isActivated'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: userDoc.updateTime },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: targetUid,
                title: 'सक्रियण अनुरोध अस्वीकृत',
                message: 'आपका ₹499 सक्रियण संदर्भ सत्यापित नहीं हो सका। कृपया सही संदर्भ पुनः सबमिट करें।',
                category: 'activation',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      }

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 11. Approve or Reject Add Money Request
  app.post('/api/admin/add-money/:requestId/process', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const { requestId } = req.params;
      const action = req.body?.action === 'reject' ? 'reject' : 'approve';
      const adminNote = String(req.body?.adminNote || '').trim().slice(0, 300);

      const reqDoc = await getFirestoreDoc<AddMoneyRequest>(`addMoneyRequests/${requestId}`, admin.idToken);
      if (!reqDoc.exists || !reqDoc.data) {
        res.status(404).json({ error: 'पैसे जोड़ने का अनुरोध नहीं मिला।' });
        return;
      }
      if (reqDoc.data.status !== 'pending') {
        res.status(409).json({ error: 'यह अनुरोध पहले ही संसाधित किया जा चुका है।' });
        return;
      }

      const targetUserDoc = await getFirestoreDoc<UserProfile>(`users/${reqDoc.data.userId}`, admin.idToken);
      if (!targetUserDoc.exists || !targetUserDoc.data) {
        res.status(404).json({ error: 'संबंधित उपयोगकर्ता नहीं मिला।' });
        return;
      }

      const notifId = makeUniqueId('NTF');
      if (action === 'approve') {
        const newDeposit = roundMoney((targetUserDoc.data.depositBalance || 0) + reqDoc.data.amount);
        const newWallet = roundMoney(newDeposit + (targetUserDoc.data.commissionBalance || 0));
        const txId = makeUniqueId('TXN');

        await commitFirestoreWrites(
          [
            {
              docPath: `addMoneyRequests/${requestId}`,
              fields: {
                status: 'approved',
                adminNote: adminNote || 'एडमिन द्वारा सत्यापित और स्वीकृत',
                processedBy: admin.uid,
              },
              updateMask: ['status', 'adminNote', 'processedBy'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: reqDoc.updateTime },
            },
            {
              docPath: `users/${reqDoc.data.userId}`,
              fields: {
                depositBalance: newDeposit,
                walletBalance: newWallet,
                lastOpType: 'admin',
                lastOpRef: requestId,
              },
              updateMask: ['depositBalance', 'walletBalance', 'lastOpType', 'lastOpRef'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: targetUserDoc.updateTime },
            },
            {
              docPath: `transactions/${txId}`,
              fields: {
                transactionId: txId,
                userId: reqDoc.data.userId,
                type: 'add_money_credit',
                amount: reqDoc.data.amount,
                direction: 'credit',
                balanceBucket: 'deposit',
                referenceId: requestId,
                description: `डिपॉजिट सत्यापित: ₹${reqDoc.data.amount} वॉलेट में जोड़े गए`,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: reqDoc.data.userId,
                title: 'पैसे वॉलेट में जोड़े गए',
                message: `आपका ₹${reqDoc.data.amount} का डिपॉजिट अनुरोध (${requestId}) स्वीकृत हो गया है।`,
                category: 'add_money',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      } else {
        await commitFirestoreWrites(
          [
            {
              docPath: `addMoneyRequests/${requestId}`,
              fields: {
                status: 'rejected',
                adminNote: adminNote || 'भुगतान संदर्भ सत्यापित नहीं हो सका',
                processedBy: admin.uid,
              },
              updateMask: ['status', 'adminNote', 'processedBy'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: reqDoc.updateTime },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: reqDoc.data.userId,
                title: 'पैसे जोड़ने का अनुरोध अस्वीकृत',
                message: `आपका ₹${reqDoc.data.amount} का अनुरोध (${requestId}) अस्वीकृत किया गया। कारण: ${
                  adminNote || 'अमान्य संदर्भ'
                }`,
                category: 'add_money',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      }

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 12. Manual Recharge Processing (Mark Successful or Failed + Transaction Reference + Notify User)
  app.post('/api/admin/recharge/:requestId/process', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const { requestId } = req.params;
      const status = req.body?.status === 'failed' ? 'failed' : 'success';
      const transactionRef = String(req.body?.transactionRef || '').trim().slice(0, 100);
      const adminNote = String(req.body?.adminNote || '').trim().slice(0, 300);

      if (status === 'success' && transactionRef.length < 2) {
        res.status(400).json({ error: 'सफल चिह्नित करने के लिए कृपया लेनदेन संदर्भ (Transaction Ref) दर्ज करें।' });
        return;
      }

      const rechargeDoc = await getFirestoreDoc<RechargeRequest>(`rechargeRequests/${requestId}`, admin.idToken);
      if (!rechargeDoc.exists || !rechargeDoc.data) {
        res.status(404).json({ error: 'रिचार्ज अनुरोध नहीं मिला।' });
        return;
      }
      if (rechargeDoc.data.status !== 'under_process') {
        res.status(409).json({ error: 'केवल प्रक्रियाधीन (Under Process) रिचार्ज को ही अपडेट किया जा सकता है।' });
        return;
      }

      const notifId = makeUniqueId('NTF');
      if (status === 'success') {
        await commitFirestoreWrites(
          [
            {
              docPath: `rechargeRequests/${requestId}`,
              fields: {
                status: 'success',
                transactionRef,
                adminNote: adminNote || 'रिचार्ज सफल',
                processedBy: admin.uid,
              },
              updateMask: ['status', 'transactionRef', 'adminNote', 'processedBy'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: rechargeDoc.updateTime },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: rechargeDoc.data.userId,
                title: 'रिचार्ज सफल रहा',
                message: `${rechargeDoc.data.operator} (${rechargeDoc.data.mobileNumber}) के लिए ₹${rechargeDoc.data.amount} का रिचार्ज सफल रहा। संदर्भ: ${transactionRef}`,
                category: 'recharge',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      } else {
        // Mark Failed -> Atomically refund deducted balances back to user
        const targetUserDoc = await getFirestoreDoc<UserProfile>(`users/${rechargeDoc.data.userId}`, admin.idToken);
        if (!targetUserDoc.exists || !targetUserDoc.data) {
          res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला।' });
          return;
        }
        const newDeposit = roundMoney(
          (targetUserDoc.data.depositBalance || 0) + (rechargeDoc.data.deductedFromDeposit || 0),
        );
        const newCommission = roundMoney(
          (targetUserDoc.data.commissionBalance || 0) + (rechargeDoc.data.deductedFromCommission || 0),
        );
        const newWallet = roundMoney(newDeposit + newCommission);
        const txId = makeUniqueId('TXN');

        await commitFirestoreWrites(
          [
            {
              docPath: `rechargeRequests/${requestId}`,
              fields: {
                status: 'failed',
                transactionRef: transactionRef || 'FAILED',
                adminNote: adminNote || 'रिचार्ज विफल — राशि वॉलेट में वापस की गई',
                processedBy: admin.uid,
              },
              updateMask: ['status', 'transactionRef', 'adminNote', 'processedBy'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: rechargeDoc.updateTime },
            },
            {
              docPath: `users/${rechargeDoc.data.userId}`,
              fields: {
                depositBalance: newDeposit,
                commissionBalance: newCommission,
                walletBalance: newWallet,
                lastOpType: 'admin',
                lastOpRef: requestId,
              },
              updateMask: ['depositBalance', 'commissionBalance', 'walletBalance', 'lastOpType', 'lastOpRef'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: targetUserDoc.updateTime },
            },
            {
              docPath: `transactions/${txId}`,
              fields: {
                transactionId: txId,
                userId: rechargeDoc.data.userId,
                type: 'recharge_failed_refund',
                amount: rechargeDoc.data.amount,
                direction: 'credit',
                balanceBucket: 'deposit',
                referenceId: requestId,
                description: `विफल रिचार्ज (${requestId}) की ₹${rechargeDoc.data.amount} राशि वॉलेट में वापस`,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: rechargeDoc.data.userId,
                title: 'रिचार्ज विफल — राशि वापस की गई',
                message: `${rechargeDoc.data.operator} (${rechargeDoc.data.mobileNumber}) का ₹${rechargeDoc.data.amount} रिचार्ज विफल रहा और राशि वॉलेट में वापस कर दी गई है।`,
                category: 'recharge',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      }

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 13. Process Refund Request (Approve -> marks recharge 'refunded' + credits wallet; Prevent duplicate refunds)
  app.post('/api/admin/refund/:rechargeId/process', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const { rechargeId } = req.params;
      const action = req.body?.action === 'reject' ? 'reject' : 'approve';
      const adminNote = String(req.body?.adminNote || '').trim().slice(0, 300);

      const refundDoc = await getFirestoreDoc<RefundRequest>(`refundRequests/${rechargeId}`, admin.idToken);
      if (!refundDoc.exists || !refundDoc.data) {
        res.status(404).json({ error: 'रिफंड अनुरोध नहीं मिला।' });
        return;
      }
      if (refundDoc.data.status !== 'pending') {
        res.status(409).json({ error: 'यह रिफंड अनुरोध पहले ही संसाधित किया जा चुका है।' });
        return;
      }

      const rechargeDoc = await getFirestoreDoc<RechargeRequest>(`rechargeRequests/${rechargeId}`, admin.idToken);
      if (!rechargeDoc.exists || !rechargeDoc.data) {
        res.status(404).json({ error: 'मूल रिचार्ज रिकॉर्ड नहीं मिला।' });
        return;
      }

      const notifId = makeUniqueId('NTF');
      if (action === 'approve') {
        if (rechargeDoc.data.status === 'refunded' || rechargeDoc.data.status === 'failed') {
          res.status(409).json({ error: 'इस रिचार्ज की राशि पहले ही वापस की जा चुकी है।' });
          return;
        }

        const targetUserDoc = await getFirestoreDoc<UserProfile>(`users/${refundDoc.data.userId}`, admin.idToken);
        if (!targetUserDoc.exists || !targetUserDoc.data) {
          res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला।' });
          return;
        }

        const newDeposit = roundMoney((targetUserDoc.data.depositBalance || 0) + refundDoc.data.amount);
        const newWallet = roundMoney(newDeposit + (targetUserDoc.data.commissionBalance || 0));
        const txId = makeUniqueId('TXN');

        await commitFirestoreWrites(
          [
            {
              docPath: `refundRequests/${rechargeId}`,
              fields: {
                status: 'approved',
                adminNote: adminNote || 'रिफंड स्वीकृत और वॉलेट में क्रेडिट किया गया',
                processedBy: admin.uid,
              },
              updateMask: ['status', 'adminNote', 'processedBy'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: refundDoc.updateTime },
            },
            {
              docPath: `rechargeRequests/${rechargeId}`,
              fields: {
                status: 'refunded',
                adminNote: adminNote || 'रिफंड स्वीकृत',
                processedBy: admin.uid,
              },
              updateMask: ['status', 'adminNote', 'processedBy'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: rechargeDoc.updateTime },
            },
            {
              docPath: `users/${refundDoc.data.userId}`,
              fields: {
                depositBalance: newDeposit,
                walletBalance: newWallet,
                lastOpType: 'admin',
                lastOpRef: refundDoc.data.refundId,
              },
              updateMask: ['depositBalance', 'walletBalance', 'lastOpType', 'lastOpRef'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: targetUserDoc.updateTime },
            },
            {
              docPath: `transactions/${txId}`,
              fields: {
                transactionId: txId,
                userId: refundDoc.data.userId,
                type: 'refund_credit',
                amount: refundDoc.data.amount,
                direction: 'credit',
                balanceBucket: 'deposit',
                referenceId: refundDoc.data.refundId,
                description: `रिफंड स्वीकृत (${rechargeId}): ₹${refundDoc.data.amount} वॉलेट में क्रेडिट`,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: refundDoc.data.userId,
                title: 'रिफंड अनुरोध स्वीकृत',
                message: `रिचार्ज ${rechargeId} के लिए ₹${refundDoc.data.amount} का रिफंड आपके वॉलेट में जोड़ दिया गया है।`,
                category: 'refund',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      } else {
        await commitFirestoreWrites(
          [
            {
              docPath: `refundRequests/${rechargeId}`,
              fields: {
                status: 'rejected',
                adminNote: adminNote || 'रिफंड अनुरोध अस्वीकृत',
                processedBy: admin.uid,
              },
              updateMask: ['status', 'adminNote', 'processedBy'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: refundDoc.updateTime },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: refundDoc.data.userId,
                title: 'रिफंड अनुरोध अस्वीकृत',
                message: `रिचार्ज ${rechargeId} का रिफंड अनुरोध अस्वीकृत कर दिया गया है। कारण: ${
                  adminNote || 'नियमों के अनुसार अयोग्य'
                }`,
                category: 'refund',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      }

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 14. Process Commission Withdrawal Request (Paid or Rejected)
  app.post('/api/admin/withdrawal/:requestId/process', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const { requestId } = req.params;
      const status = req.body?.status === 'rejected' ? 'rejected' : 'paid';
      const paymentRef = String(req.body?.paymentRef || '').trim().slice(0, 100);
      const adminNote = String(req.body?.adminNote || '').trim().slice(0, 300);

      if (status === 'paid' && paymentRef.length < 2) {
        res.status(400).json({ error: 'भुगतान चिह्नित करने के लिए कृपया भुगतान संदर्भ (UTR / Ref) दर्ज करें।' });
        return;
      }

      const wDoc = await getFirestoreDoc<WithdrawalRequest>(`withdrawalRequests/${requestId}`, admin.idToken);
      if (!wDoc.exists || !wDoc.data) {
        res.status(404).json({ error: 'निकासी अनुरोध नहीं मिला।' });
        return;
      }
      if (wDoc.data.status !== 'pending') {
        res.status(409).json({ error: 'यह निकासी अनुरोध पहले ही संसाधित हो चुका है।' });
        return;
      }

      const notifId = makeUniqueId('NTF');
      if (status === 'paid') {
        await commitFirestoreWrites(
          [
            {
              docPath: `withdrawalRequests/${requestId}`,
              fields: {
                status: 'paid',
                paymentRef,
                adminNote: adminNote || 'भुगतान पूरा हुआ (डेमो मोड)',
                processedBy: admin.uid,
              },
              updateMask: ['status', 'paymentRef', 'adminNote', 'processedBy'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: wDoc.updateTime },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: wDoc.data.userId,
                title: 'निकासी भुगतान पूरा हुआ',
                message: `आपका ₹${wDoc.data.amount.toFixed(2)} का कमीशन निकासी अनुरोध (${requestId}) भुगतान किया गया चिह्नित है। संदर्भ: ${paymentRef}`,
                category: 'withdrawal',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      } else {
        // Rejected -> restore commissionBalance back to user atomically
        const targetUserDoc = await getFirestoreDoc<UserProfile>(`users/${wDoc.data.userId}`, admin.idToken);
        if (!targetUserDoc.exists || !targetUserDoc.data) {
          res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला।' });
          return;
        }
        const newCommission = roundMoney((targetUserDoc.data.commissionBalance || 0) + wDoc.data.amount);
        const newWallet = roundMoney((targetUserDoc.data.depositBalance || 0) + newCommission);
        const txId = makeUniqueId('TXN');

        await commitFirestoreWrites(
          [
            {
              docPath: `withdrawalRequests/${requestId}`,
              fields: {
                status: 'rejected',
                paymentRef: 'REJECTED',
                adminNote: adminNote || 'निकासी अनुरोध अस्वीकृत — राशि कमीशन बैलेंस में वापस',
                processedBy: admin.uid,
              },
              updateMask: ['status', 'paymentRef', 'adminNote', 'processedBy'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: wDoc.updateTime },
            },
            {
              docPath: `users/${wDoc.data.userId}`,
              fields: {
                commissionBalance: newCommission,
                walletBalance: newWallet,
                lastOpType: 'admin',
                lastOpRef: requestId,
              },
              updateMask: ['commissionBalance', 'walletBalance', 'lastOpType', 'lastOpRef'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: targetUserDoc.updateTime },
            },
            {
              docPath: `transactions/${txId}`,
              fields: {
                transactionId: txId,
                userId: wDoc.data.userId,
                type: 'withdrawal_refund',
                amount: wDoc.data.amount,
                direction: 'credit',
                balanceBucket: 'commission',
                referenceId: requestId,
                description: `अस्वीकृत निकासी (${requestId}) की ₹${wDoc.data.amount.toFixed(2)} राशि कमीशन में वापस`,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
            {
              docPath: `notifications/${notifId}`,
              fields: {
                notificationId: notifId,
                targetUserId: wDoc.data.userId,
                title: 'निकासी अनुरोध अस्वीकृत',
                message: `आपका ₹${wDoc.data.amount.toFixed(2)} का निकासी अनुरोध अस्वीकृत हुआ और राशि कमीशन बैलेंस में वापस कर दी गई।`,
                category: 'withdrawal',
                isRead: false,
              },
              serverTimestampFields: ['createdAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      }

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 15. Approve & Credit Monthly 10% Commission (Prevents duplicate monthly commission via deterministic doc ID)
  app.post('/api/admin/commission/approve', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const userId = String(req.body?.userId || '').trim();
      const monthKey = String(req.body?.monthKey || '').trim();

      if (!userId || !/^[0-9]{4}-[0-9]{2}$/.test(monthKey)) {
        res.status(400).json({ error: 'अमान्य उपयोगकर्ता या महीना प्रारूप (YYYY-MM)।' });
        return;
      }

      const commissionId = `${userId}_${monthKey}`;
      const existingCommission = await getFirestoreDoc<MonthlyCommission>(
        `monthlyCommissions/${commissionId}`,
        admin.idToken,
      );
      if (existingCommission.exists) {
        res.status(409).json({ error: 'इस महीने का कमीशन इस उपयोगकर्ता को पहले ही क्रेडिट किया जा चुका है।' });
        return;
      }

      const targetUserDoc = await getFirestoreDoc<UserProfile>(`users/${userId}`, admin.idToken);
      if (!targetUserDoc.exists || !targetUserDoc.data) {
        res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला।' });
        return;
      }

      // Query all recharges for this user and filter ONLY eligible successful ones in monthKey
      const userRecharges = await queryFirestoreCollection<RechargeRequest>('rechargeRequests', admin.idToken, {
        filters: [{ field: 'userId', op: 'EQUAL', value: userId }],
      });

      const eligible = userRecharges
        .map((r) => r.data)
        .filter((r) => r.monthKey === monthKey && r.status === 'success');

      if (eligible.length === 0) {
        res.status(400).json({ error: 'इस महीने में कोई पात्र सफल रिचार्ज लेनदेन नहीं मिला।' });
        return;
      }

      const eligibleRechargeTotal = roundMoney(eligible.reduce((sum, r) => sum + r.amount, 0));
      const commissionAmount = roundMoney(eligibleRechargeTotal * 0.1);
      if (commissionAmount <= 0) {
        res.status(400).json({ error: 'कमीशन राशि शून्य से अधिक होनी चाहिए।' });
        return;
      }

      const newCommission = roundMoney((targetUserDoc.data.commissionBalance || 0) + commissionAmount);
      const newWallet = roundMoney((targetUserDoc.data.depositBalance || 0) + newCommission);
      const txId = makeUniqueId('TXN');
      const notifId = makeUniqueId('NTF');

      await commitFirestoreWrites(
        [
          {
            docPath: `monthlyCommissions/${commissionId}`,
            fields: {
              commissionId,
              userId,
              userMobile: targetUserDoc.data.mobileNumber,
              monthKey,
              eligibleRechargeTotal,
              commissionRate: 0.1,
              commissionAmount,
              eligibleCount: eligible.length,
              status: 'credited',
              approvedBy: admin.uid,
            },
            serverTimestampFields: ['createdAt', 'updatedAt'],
            precondition: { exists: false },
          },
          {
            docPath: `users/${userId}`,
            fields: {
              commissionBalance: newCommission,
              walletBalance: newWallet,
              lastOpType: 'admin',
              lastOpRef: commissionId,
            },
            updateMask: ['commissionBalance', 'walletBalance', 'lastOpType', 'lastOpRef'],
            serverTimestampFields: ['updatedAt'],
            precondition: { updateTime: targetUserDoc.updateTime },
          },
          {
            docPath: `transactions/${txId}`,
            fields: {
              transactionId: txId,
              userId,
              type: 'commission_credit',
              amount: commissionAmount,
              direction: 'credit',
              balanceBucket: 'commission',
              referenceId: commissionId,
              description: `${monthKey} का 10% मासिक कमीशन (पात्र रिचार्ज: ₹${eligibleRechargeTotal})`,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
          {
            docPath: `notifications/${notifId}`,
            fields: {
              notificationId: notifId,
              targetUserId: userId,
              title: 'मासिक कमीशन क्रेडिट हुआ',
              message: `${monthKey} के लिए आपका 10% कमीशन ₹${commissionAmount.toFixed(2)} आपके कमीशन वॉलेट में जोड़ दिया गया है।`,
              category: 'commission',
              isRead: false,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
        ],
        admin.idToken,
      );

      res.json({ ok: true, commissionId, commissionAmount });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 16. Send Custom Admin Notification to User
  app.post('/api/admin/notify', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const targetUserId = String(req.body?.targetUserId || '').trim();
      const title = String(req.body?.title || '').trim().slice(0, 150);
      const message = String(req.body?.message || '').trim().slice(0, 500);

      if (!targetUserId || !title || !message) {
        res.status(400).json({ error: 'कृपया उपयोगकर्ता, शीर्षक और संदेश दर्ज करें।' });
        return;
      }

      const notifId = makeUniqueId('NTF');
      await commitFirestoreWrites(
        [
          {
            docPath: `notifications/${notifId}`,
            fields: {
              notificationId: notifId,
              targetUserId,
              title,
              message,
              category: 'system',
              isRead: false,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
        ],
        admin.idToken,
      );

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 17. Admin Invite Code Management (Create / Toggle Active)
  app.post('/api/admin/invite-codes', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const action = req.body?.action === 'toggle' ? 'toggle' : 'create';
      const code = String(req.body?.code || '').trim().toUpperCase();

      if (!code || code.length < 3 || code.length > 32 || !/^[A-Z0-9_-]+$/.test(code)) {
        res.status(400).json({ error: 'आमंत्रण कोड 3–32 अक्षरों (A-Z, 0-9, _, -) का होना चाहिए।' });
        return;
      }

      if (action === 'create') {
        const label = String(req.body?.label || 'एडमिन आमंत्रण कोड').trim().slice(0, 100);
        await commitFirestoreWrites(
          [
            {
              docPath: `inviteCodes/${code}`,
              fields: {
                code,
                label: label || 'एडमिन आमंत्रण कोड',
                isActive: true,
                createdBy: admin.uid,
              },
              serverTimestampFields: ['createdAt', 'updatedAt'],
              precondition: { exists: false },
            },
          ],
          admin.idToken,
        );
      } else {
        const existing = await getFirestoreDoc<InviteCode>(`inviteCodes/${code}`, admin.idToken);
        if (!existing.exists || !existing.data) {
          res.status(404).json({ error: 'आमंत्रण कोड नहीं मिला।' });
          return;
        }
        await commitFirestoreWrites(
          [
            {
              docPath: `inviteCodes/${code}`,
              fields: {
                isActive: !existing.data.isActive,
              },
              updateMask: ['isActive'],
              serverTimestampFields: ['updatedAt'],
              precondition: { updateTime: existing.updateTime },
            },
          ],
          admin.idToken,
        );
      }

      res.json({ ok: true });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 18. Admin Suspend / Reactivate User Account
  app.post('/api/admin/users/:uid/toggle-status', async (req, res) => {
    const admin = await authenticateAdmin(req, res);
    if (!admin) return;

    try {
      const targetUid = req.params.uid;
      if (targetUid === admin.uid) {
        res.status(400).json({ error: 'आप अपने स्वयं के एडमिन खाते को निलंबित नहीं कर सकते।' });
        return;
      }

      const userDoc = await getFirestoreDoc<UserProfile>(`users/${targetUid}`, admin.idToken);
      if (!userDoc.exists || !userDoc.data) {
        res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला।' });
        return;
      }

      const nextStatus = userDoc.data.status === 'suspended' ? 'active' : 'suspended';
      const nextActivated = nextStatus === 'active';
      const notifId = makeUniqueId('NTF');

      await commitFirestoreWrites(
        [
          {
            docPath: `users/${targetUid}`,
            fields: {
              status: nextStatus,
              isActivated: nextActivated,
            },
            updateMask: ['status', 'isActivated'],
            serverTimestampFields: ['updatedAt'],
            precondition: { updateTime: userDoc.updateTime },
          },
          {
            docPath: `notifications/${notifId}`,
            fields: {
              notificationId: notifId,
              targetUserId: targetUid,
              title: nextStatus === 'suspended' ? 'खाता निलंबित किया गया' : 'खाता पुनः सक्रिय किया गया',
              message:
                nextStatus === 'suspended'
                  ? 'एडमिन द्वारा आपका खाता अस्थायी रूप से निलंबित कर दिया गया है।'
                  : 'एडमिन द्वारा आपका खाता पुनः सक्रिय कर दिया गया है।',
              category: 'system',
              isRead: false,
            },
            serverTimestampFields: ['createdAt'],
            precondition: { exists: false },
          },
        ],
        admin.idToken,
      );

      res.json({ ok: true, status: nextStatus });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // JSON 404 for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'अनुरोधित API मार्ग उपलब्ध नहीं है।' });
  });

  // Serve Vite in dev or built dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const portArgIdx = process.argv.indexOf('--port');
  const cliPort =
    portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : NaN;
  const port = Number.isFinite(cliPort)
    ? cliPort
    : process.env.NODE_ENV === 'production'
    ? Number(process.env.PORT || 3000)
    : 3000;

  app.listen(port, '0.0.0.0', () => {
    console.log(`RECHARGE COMMISSION server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
