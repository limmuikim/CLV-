/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  X, 
  LogIn, 
  Mail, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  UserPlus, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertCircle,
  Sparkles,
  KeyRound
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "request" | "email";
}

export default function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { 
    signInWithGoogle, 
    signInWithEmail, 
    requestAccess, 
    creatorEmail, 
    authError,
    setAuthError
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"signin" | "request" | "email">(defaultTab);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync tab when opening modal
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setLocalError(null);
      setReqSubmitted(false);
    }
  }, [isOpen, defaultTab]);

  // Email login form state
  const [emailInput, setEmailInput] = useState("");

  // Access request form state
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqNote, setReqNote] = useState("");
  const [reqSubmitted, setReqSubmitted] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setLocalError(null);
    setAuthError(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error("Google sign in failed in modal:", err);
      let msg = err?.message || "Google sign in failed.";
      if (err?.code === "auth/unauthorized-domain") {
        msg = "This web domain is not yet authorized in Firebase Console. You can use Direct Email Login below to log in immediately as Creator or approved user!";
      } else if (err?.code === "auth/popup-blocked") {
        msg = "The sign-in popup was blocked by your browser. Please allow popups or use Direct Email Login below.";
      }
      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (emailToUse?: string) => {
    const targetEmail = (emailToUse || emailInput).trim();
    if (!targetEmail) {
      setLocalError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setLocalError(null);
    setAuthError(null);
    try {
      await signInWithEmail(targetEmail);
      onClose();
    } catch (err: any) {
      console.error("Email login failed:", err);
      setLocalError(err.message || "Failed to log in with this email.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqEmail || !reqEmail.includes("@")) {
      setLocalError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setLocalError(null);
    try {
      await requestAccess(reqEmail, reqName, reqNote);
      setReqSubmitted(true);
    } catch (err: any) {
      setLocalError(err.message || "Failed to submit access request.");
    } finally {
      setLoading(false);
    }
  };

  const emailDraftSubject = "Access Request: Customer Lifetime Value & Churn Engine";
  const emailDraftBody = `Hi Mui Kim,

I would like to request authorized write access to use the Customer Lifetime Value & Churn Engine.

My Name: ${reqName || "Team Member"}
My Email: ${reqEmail}
Purpose: ${reqNote || "Customer Lifetime Value analysis and Churn modeling"}
Date: ${new Date().toLocaleDateString()}

Please approve my account in your Creator Access Portal.

Thank you!`;

  const mailtoLink = `mailto:${creatorEmail}?subject=${encodeURIComponent(emailDraftSubject)}&body=${encodeURIComponent(emailDraftBody)}`;

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(`To: ${creatorEmail}\nSubject: ${emailDraftSubject}\n\n${emailDraftBody}`);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-800 text-base">
                Secure Access & Authentication
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Protected system controlled by <strong className="text-slate-600">{creatorEmail}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl mt-4 text-xs font-medium">
          <button
            onClick={() => { setActiveTab("signin"); setLocalError(null); }}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1 ${
              activeTab === "signin"
                ? "bg-white text-indigo-600 font-bold shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          
          <button
            onClick={() => { setActiveTab("email"); setLocalError(null); }}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1 ${
              activeTab === "email"
                ? "bg-white text-indigo-600 font-bold shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Direct Login</span>
          </button>

          <button
            onClick={() => { setActiveTab("request"); setLocalError(null); }}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1 ${
              activeTab === "request"
                ? "bg-white text-indigo-600 font-bold shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Request Access</span>
          </button>
        </div>

        {/* Error notification banner */}
        {(localError || authError) && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Authentication Notice</span>
              <span>{localError || authError}</span>
            </div>
          </div>
        )}

        {/* Tab 1: Standard Sign-In */}
        {activeTab === "signin" && (
          <div className="py-4 space-y-4">
            <p className="text-xs text-slate-500">
              Sign in with your Google account. If your account is approved by Mui Kim, you will unlock full customer and CSV editing rights.
            </p>

            {/* Google OAuth Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 rounded-xl font-medium text-xs shadow-xs flex items-center justify-center space-x-2.5 transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? "Connecting to Google..." : "Continue with Google"}</span>
            </button>

            {/* Creator Fast Log In Card */}
            <div className="pt-2 border-t border-slate-100">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-2">
                <div className="flex items-center space-x-2 text-amber-900 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Creator One-Click Admin Access</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Are you the application creator (<strong>{creatorEmail}</strong>)? Log in immediately to access full administrative and database rights.
                </p>
                <button
                  onClick={() => handleEmailSignIn(creatorEmail)}
                  disabled={loading}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Log In as Creator ({creatorEmail})</span>
                </button>
              </div>
            </div>

            <div className="text-center pt-1">
              <button
                onClick={() => setActiveTab("request")}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center space-x-1"
              >
                <span>Don't have an approved account? Request access here</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Direct Email Login */}
        {activeTab === "email" && (
          <div className="py-4 space-y-3">
            <p className="text-xs text-slate-500">
              Enter your registered Google or corporate email. If your email has been approved by the creator, you can log in directly.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Email Address
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="name@company.com or muikimlim.insead@gmail.com"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <button
              onClick={() => handleEmailSignIn()}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? "Verifying..." : "Log In with Email"}</span>
            </button>

            {/* Quick buttons */}
            <div className="pt-2 border-t border-slate-100 flex flex-col space-y-2">
              <span className="text-[11px] text-slate-400 font-medium">Quick Credentials:</span>
              <button
                onClick={() => {
                  setEmailInput(creatorEmail);
                  handleEmailSignIn(creatorEmail);
                }}
                className="text-left p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs flex justify-between items-center transition-colors"
              >
                <div>
                  <span className="font-semibold text-slate-800 block">{creatorEmail}</span>
                  <span className="text-[10px] text-amber-600 font-medium">Creator / System Owner (Auto-Approved)</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">1-Click</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Request Access Form */}
        {activeTab === "request" && (
          <div className="py-3">
            {!reqSubmitted ? (
              <form onSubmit={handleRequestSubmit} className="space-y-3">
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Requesting Authorization</span>
                    <span>
                      Submit your email below. This registers your request directly in the Creator Access Portal and prepares an email for <strong>{creatorEmail}</strong>.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={reqName}
                    onChange={e => setReqName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Email Address (Google or Work Email)
                  </label>
                  <input
                    type="email"
                    required
                    value={reqEmail}
                    onChange={e => setReqEmail(e.target.value)}
                    placeholder="e.g. johndoe@gmail.com"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purpose / Team Note (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={reqNote}
                    onChange={e => setReqNote(e.target.value)}
                    placeholder="e.g. Marketing team customer lifetime value calculation & churn review"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex flex-col space-y-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center space-x-2"
                  >
                    <Mail className="w-4 h-4" />
                    <span>{loading ? "Submitting Request..." : "Submit Access Request to Creator"}</span>
                  </button>

                  <a
                    href={mailtoLink}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Email Directly to {creatorEmail}</span>
                  </a>
                </div>
              </form>
            ) : (
              <div className="py-4 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Access Request Submitted!</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Your email <strong>{reqEmail}</strong> has been logged in the system. To complete access approval, please drop an email to the creator:
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs font-mono text-slate-600 space-y-1">
                  <div><strong>To:</strong> {creatorEmail}</div>
                  <div><strong>Subject:</strong> {emailDraftSubject}</div>
                  <div className="text-[11px] text-slate-400 font-sans mt-2">
                    "Hi Mui Kim, I would like to request authorized write access to use the Customer Lifetime Value & Churn Engine for {reqEmail}."
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                  <a
                    href={mailtoLink}
                    className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Email Now</span>
                  </a>

                  <button
                    onClick={handleCopyDraft}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    {copiedDraft ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDraft ? "Copied!" : "Copy Email Draft"}</span>
                  </button>

                  <button
                    onClick={() => handleEmailSignIn(reqEmail)}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Enter in Read-Only Mode</span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setReqSubmitted(false);
                      onClose();
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
