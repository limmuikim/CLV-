/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ShieldAlert, Mail, RefreshCw, LogOut, Lock, LogIn, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AccessPendingBanner() {
  const { 
    user, 
    isApproved, 
    isCreator, 
    creatorEmail, 
    refreshUserProfile, 
    signOut,
    openAuthModal 
  } = useAuth();
  
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  // If user is approved or creator, don't show any restriction banner
  if (isApproved || isCreator) {
    return null;
  }

  // 1. Unauthenticated Visitor Banner
  if (!user) {
    return (
      <div className="bg-indigo-900/5 border-b border-indigo-100 px-4 py-2.5 text-slate-700 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-indigo-100 text-indigo-700 rounded-md shrink-0">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-semibold text-slate-800">Protected Workspace (Read-Only Demo Mode):</span>{" "}
              <span className="text-slate-600 text-[11px]">
                To upload company CSV datasets or add/edit customers, sign in or request write authorization from <strong>{creatorEmail}</strong>.
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => openAuthModal("request")}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-2xs transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Request Access</span>
            </button>

            <button
              onClick={() => openAuthModal("signin")}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center space-x-1.5 shadow-2xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Signed-In but Pending Approval Banner
  const rawMailDraft = `Hi Mui Kim,\n\nI would like to request authorized access to use the Customer Lifetime Value & Churn Engine.\n\nMy Google Account: ${user.email}\nUser UID: ${user.uid}\nTimestamp: ${new Date().toISOString()}\n\nPlease approve my account in your Creator Access Portal.\n\nThank you!`;

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(
      `To: ${creatorEmail}\nSubject: Access Request: Customer Lifetime Value & Churn Engine\n\n${rawMailDraft}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRefresh = async () => {
    setChecking(true);
    await refreshUserProfile();
    setTimeout(() => setChecking(false), 600);
  };

  const mailSubject = encodeURIComponent("Access Request: Customer Lifetime Value & Churn Engine");
  const mailBody = encodeURIComponent(rawMailDraft);
  const mailtoLink = `mailto:${creatorEmail}?subject=${mailSubject}&body=${mailBody}`;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 text-amber-900 text-xs shadow-2xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-amber-950 block">
              Restricted Access: Account Pending Creator Approval
            </span>
            <span className="text-amber-800 text-[11px]">
              You are signed in as <strong>{user.email}</strong> in Read-Only Preview mode. Writing customer data or uploading CSVs requires explicit authorization from <strong>{creatorEmail}</strong>.
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => openAuthModal("request")}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Creator for Access</span>
          </button>

          <button
            onClick={handleCopyDraft}
            className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 font-medium text-xs flex items-center space-x-1 transition-colors"
            title="Copy draft message to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Mail className="w-3.5 h-3.5 text-amber-600" />}
            <span>{copied ? "Copied!" : "Copy Email Draft"}</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={checking}
            className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 font-medium text-xs flex items-center space-x-1 transition-colors"
            title="Check if permission was granted"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin text-amber-600" : ""}`} />
            <span>{checking ? "Checking..." : "Refresh Status"}</span>
          </button>

          <button
            onClick={signOut}
            className="p-1.5 text-amber-700 hover:text-amber-900 rounded-lg hover:bg-amber-100/50"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
