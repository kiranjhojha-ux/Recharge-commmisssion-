import React, { useState } from 'react';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { CheckCircle2, Clock, KeyRound, LogOut, ShieldCheck, Smartphone, UserCheck } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { apiRequest } from '../lib/api';
import type { UserProfile } from '../types';
import { DemoQrCode } from './DemoQrCode';

interface AuthOnboardingProps {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  onProfileUpdated: () => void;
}

export const AuthOnboarding: React.FC<AuthOnboardingProps> = ({
  firebaseUser,
  profile,
  loading,
  onProfileUpdated,
}) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Registration form states
  const [displayName, setDisplayName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [inviteCode, setInviteCode] = useState('RC2026');
  const [otp, setOtp] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  // Activation Rs 499 reference state
  const [activationRef, setActivationRef] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'लॉगिन में समस्या आई।';
      setAuthError(
        msg.includes('popup-closed')
          ? 'लॉगिन विंडो बंद कर दी गई। कृपया पुनः प्रयास करें।'
          : `लॉगिन त्रुटि: ${msg}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMessage(null);
    if (!/^[6-9][0-9]{9}$/.test(mobileNumber.trim())) {
      setAuthError('कृपया 10 अंकों का मान्य भारतीय मोबाइल नंबर दर्ज करें।');
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<{ challengeToken: string; demoOtp: string; message: string }>(
        '/api/auth/send-otp',
        {
          method: 'POST',
          body: { mobileNumber: mobileNumber.trim() },
        },
      );
      setChallengeToken(res.challengeToken);
      setDemoOtpHint(res.demoOtp);
      setOtpSent(true);
      setInfoMessage('डेमो OTP जनरेट हो गया है। सत्यापन के लिए नीचे OTP दर्ज करें।');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'OTP भेजने में त्रुटि हुई।');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMessage(null);
    setBusy(true);
    try {
      await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: {
          displayName: displayName.trim() || firebaseUser?.displayName || 'उपयोगकर्ता',
          mobileNumber: mobileNumber.trim(),
          otp: otp.trim(),
          challengeToken,
          inviteCode: inviteCode.trim(),
        },
      });
      onProfileUpdated();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'पंजीकरण विफल रहा।');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMessage(null);
    if (activationRef.trim().length < 4) {
      setAuthError('कृपया कम से कम 4 अक्षरों का डेमो भुगतान संदर्भ / UTR दर्ज करें।');
      return;
    }
    setBusy(true);
    try {
      await apiRequest('/api/auth/submit-activation', {
        method: 'POST',
        body: { activationRef: activationRef.trim() },
      });
      setInfoMessage('आपका ₹499 सक्रियण अनुरोध एडमिन अनुमोदन के लिए भेज दिया गया है।');
      onProfileUpdated();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'सक्रियण अनुरोध सबमिट नहीं हो सका।');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="text-sm font-medium text-slate-700">खाता विवरण लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Development Mode Top Notice */}
      <div className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-center text-xs font-medium text-blue-900">
        डेमो मोड (Development Mode): यह एक कार्यात्मक डेमो है। वास्तविक धन संग्रह, स्वचालित भुगतान गेटवे या वास्तविक बैंक निकासी सक्षम नहीं है।
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-36px)] max-w-6xl grid-cols-1 items-center gap-8 px-4 py-8 lg:grid-cols-12 lg:px-8">
        {/* Left Brand & Value Column */}
        <div className="space-y-6 lg:col-span-6">
          <div className="space-y-3">
            <div className="text-sm font-bold tracking-wide text-blue-600">RECHARGE COMMISSION</div>
            <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl [text-wrap:balance]">
              सुरक्षित मोबाइल रिचार्ज और मासिक 10% कमीशन पोर्टल
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600">
              Jio, Airtel, Vi और BSNL मोबाइल रिचार्ज प्रबंधन, पारदर्शी वॉलेट खाता बही, तथा हर कैलेंडर माह के सफल रिचार्ज पर 10% कमीशन ट्रैकिंग।
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">10% मासिक कमीशन</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                माह के सभी पात्र सफल रिचार्ज पर 10% कमीशन (विफल और रिफंड लेनदेन छोड़कर)।
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">सत्यापित वॉलेट सुरक्षा</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                प्रत्येक डिपॉजिट, रिचार्ज, रिफंड और निकासी का सुरक्षित सर्वर-साइड रिकॉर्ड।
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">₹1000+ वॉलेट डिपॉजिट</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                ₹1000 के गुणज में डिपॉजिट अनुरोध और एडमिन सत्यापन के बाद क्रेडिट।
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">गलत रिचार्ज रिफंड</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                गलत नंबर पर रिचार्ज होने पर सही नंबर और कारण के साथ रिफंड अनुरोध सुविधा।
              </p>
            </div>
          </div>
        </div>

        {/* Right Interactive Auth / Onboarding Card */}
        <div className="lg:col-span-6">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            {authError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                {authError}
              </div>
            )}
            {infoMessage && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900">
                {infoMessage}
              </div>
            )}

            {/* Case 1: Not signed in yet */}
            {!firebaseUser && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">लॉगिन / नया खाता पंजीकरण</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    सुरक्षित प्रमाणीकरण के लिए अपने Google खाते से लॉगिन करें।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={busy}
                  className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span>{busy ? 'लॉगिन हो रहा है...' : 'Google के साथ लॉगिन / पंजीकरण करें'}</span>
                </button>

                <div className="border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
                  नए उपयोगकर्ताओं को लॉगिन के बाद मोबाइल नंबर, OTP सत्यापन, आमंत्रण कोड और ₹499 खाता सक्रियण चरण पूरा करना होगा।
                </div>
              </div>
            )}

            {/* Case 2: Signed in with Firebase, needs profile registration + OTP */}
            {firebaseUser && !profile && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">पंजीकरण और OTP सत्यापन</h2>
                    <p className="mt-1 text-xs text-slate-600">
                      सत्यापित ईमेल: <span className="font-medium text-slate-900">{firebaseUser.email}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>लॉगआउट</span>
                  </button>
                </div>

                <form onSubmit={otpSent ? handleVerifyAndRegister : handleSendOtp} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">पूरा नाम</label>
                    <input
                      type="text"
                      value={displayName || firebaseUser.displayName || ''}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="अपना नाम दर्ज करें"
                      required
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">ईमेल पता (सत्यापित)</label>
                    <input
                      type="email"
                      value={firebaseUser.email || ''}
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">मोबाइल नंबर (10 अंक)</label>
                    <div className="relative">
                      <Smartphone className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={mobileNumber}
                        onChange={(e) => {
                          setMobileNumber(e.target.value.replace(/\D/g, ''));
                          if (otpSent) {
                            setOtpSent(false);
                            setOtp('');
                            setDemoOtpHint(null);
                          }
                        }}
                        placeholder="उदा. 9876543210"
                        required
                        className="font-mono-tabular w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">आमंत्रण कोड (Invite Code)</label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="RC2026"
                        required
                        className="font-mono-tabular w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">डेमो आमंत्रण कोड: RC2026</p>
                  </div>

                  {otpSent && (
                    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                      {demoOtpHint && (
                        <div className="text-xs font-medium text-blue-900">
                          डेमो सत्यापन OTP: <span className="font-mono-tabular font-bold">{demoOtpHint}</span>
                        </div>
                      )}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">6 अंकों का OTP दर्ज करें</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="6 अंकों का OTP"
                          required
                          className="font-mono-tabular w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {!otpSent ? (
                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-[46px] w-full rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                    >
                      {busy ? 'OTP भेजा जा रहा है...' : 'OTP भेजें'}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="submit"
                        disabled={busy}
                        className="min-h-[46px] flex-1 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                      >
                        {busy ? 'सत्यापित हो रहा है...' : 'OTP सत्यापित करें और पंजीकरण पूरा करें'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={busy}
                        className="min-h-[46px] rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        पुनः भेजें
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* Case 3: Registered, needs Rs 499 activation fee demo submission */}
            {firebaseUser && profile && profile.status === 'pending_activation' && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">खाता सक्रियण शुल्क (₹499)</h2>
                    <p className="mt-1 text-xs text-slate-600">
                      खाता सक्रिय करने के लिए ₹499 का डेमो सक्रियण संदर्भ सबमिट करें।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>लॉगआउट</span>
                  </button>
                </div>

                <DemoQrCode amount={499} purpose="खाता सक्रियण शुल्क — RECHARGE COMMISSION" />

                <form onSubmit={handleSubmitActivation} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      डेमो भुगतान संदर्भ / UTR संख्या
                    </label>
                    <input
                      type="text"
                      value={activationRef}
                      onChange={(e) => setActivationRef(e.target.value)}
                      placeholder="उदा. DEMO499UTR1024"
                      required
                      className="font-mono-tabular w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[46px] w-full rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busy ? 'सबमिट हो रहा है...' : '₹499 सक्रियण अनुरोध सबमिट करें'}
                  </button>
                </form>
              </div>
            )}

            {/* Case 4: Pending Admin Approval */}
            {firebaseUser && profile && profile.status === 'pending_approval' && (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Clock className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">एडमिन अनुमोदन लंबित है</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    आपका पंजीकरण और ₹499 सक्रियण अनुरोध (<span className="font-mono-tabular font-semibold text-slate-800">{profile.activationRef || '—'}</span>) प्राप्त हो गया है। एडमिन द्वारा सत्यापन के बाद आपका खाता सक्रिय हो जाएगा।
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-700">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">नाम:</span>
                    <span className="font-semibold">{profile.displayName}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">मोबाइल:</span>
                    <span className="font-mono-tabular font-semibold">{profile.mobileNumber}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">स्थिति:</span>
                    <span className="font-semibold text-blue-700">समीक्षाधीन (Pending Approval)</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onProfileUpdated}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>स्थिति रीफ़्रेश करें</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>लॉगआउट</span>
                  </button>
                </div>
              </div>
            )}

            {/* Case 5: Suspended */}
            {firebaseUser && profile && profile.status === 'suspended' && (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">खाता निलंबित है</h2>
                <p className="text-sm text-slate-600">अधिक जानकारी के लिए कृपया एडमिन से संपर्क करें।</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  लॉगआउट करें
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
