/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  TrendingUp, 
  Database, 
  Activity, 
  Cpu, 
  Layers, 
  BarChart3, 
  Clock, 
  Zap,
  LogIn,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Cloud,
  Mail
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Transaction } from "./types";
import { processTransactionsToRFM, fitBGNBD, fitGammaGamma, computeAllModels } from "./utils/analytics";
import { generateEcommerceSampleData } from "./utils/sampleData";
import { AuthProvider, useAuth } from "./context/AuthContext";

import OverviewTab from "./components/OverviewTab";
import ImportTab from "./components/ImportTab";
import CLVTab from "./components/CLVTab";
import ChurnTab from "./components/ChurnTab";
import CohortTab from "./components/CohortTab";
import BusinessImpactTab from "./components/BusinessImpactTab";
import AdminApprovalModal from "./components/AdminApprovalModal";
import AccessPendingBanner from "./components/AccessPendingBanner";
import AuthModal from "./components/AuthModal";

function Dashboard() {
  const { 
    user, 
    token, 
    isCreator, 
    isApproved, 
    creatorEmail, 
    signOut, 
    loading: authLoading,
    authModalOpen,
    authModalTab,
    openAuthModal,
    closeAuthModal,
    authError
  } = useAuth();

  // 1. App State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [datasetType, setDatasetType] = useState("E-commerce Retail (18mo History)");
  const [activeTab, setActiveTab] = useState<"overview" | "import" | "clv" | "churn" | "cohorts" | "impact">("overview");
  const [targetDays, setTargetDays] = useState(90); // default forecast horizon
  const [profitMargin, setProfitMargin] = useState(0.70); // 70% profit margin representable
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [permissionErrorNotice, setPermissionErrorNotice] = useState<string | null>(null);

  // 2. Initialize with default E-commerce dataset on first mount
  useEffect(() => {
    const defaultData = generateEcommerceSampleData();
    setTransactions(defaultData);
  }, []);

  // 3. Auto-fetch from Cloud SQL if user logs in and has records
  useEffect(() => {
    async function checkCloudSqlData() {
      if (!token) return;
      try {
        const res = await fetch("/api/transactions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            try {
              const text = await res.text();
              const data = JSON.parse(text);
              if (data.transactions && data.transactions.length > 0) {
                const mapped: Transaction[] = data.transactions.map((t: any) => ({
                  customerId: t.customerId,
                  date: t.date,
                  amount: t.amount
                }));
                setTransactions(mapped);
                setDatasetType(`Cloud SQL Live Database (${mapped.length} orders)`);
              }
            } catch (jsonErr) {
              console.warn("Could not parse Cloud SQL transactions payload:", jsonErr);
            }
          }
        }
      } catch (err) {
        console.warn("Could not connect to Cloud SQL transactions endpoint:", err);
      }
    }

    if (token) {
      checkCloudSqlData();
    }
  }, [token]);

  // 4. Dynamic analytical computations
  const rfmCustomers = useMemo(() => {
    return processTransactionsToRFM(transactions);
  }, [transactions]);

  const modelParams = useMemo(() => {
    if (rfmCustomers.length === 0) {
      return { r: 0.5, alpha: 10, a: 0.8, b: 2.5, p: 6.2, q: 3.6, gamma: 15.4 };
    }
    const bgnbd = fitBGNBD(rfmCustomers);
    const gg = fitGammaGamma(rfmCustomers);
    return {
      r: bgnbd.r,
      alpha: bgnbd.alpha,
      a: bgnbd.a,
      b: bgnbd.b,
      p: gg.p,
      q: gg.q,
      gamma: gg.gamma
    };
  }, [rfmCustomers]);

  const analyticsResults = useMemo(() => {
    return computeAllModels(rfmCustomers, modelParams, targetDays, profitMargin);
  }, [rfmCustomers, modelParams, targetDays, profitMargin]);

  // Security Verification Guard
  const verifyWritePermission = (): boolean => {
    if (!user) {
      setPermissionErrorNotice("Authentication Required: You must sign in to modify customer data, upload CSVs, or add orders.");
      openAuthModal("signin");
      return false;
    }
    if (!isApproved && !isCreator) {
      setPermissionErrorNotice(`Access Restricted: Your account (${user.email}) is pending approval from the creator (${creatorEmail}). Please drop an email to request access.`);
      openAuthModal("request");
      return false;
    }
    return true;
  };

  // Handler for custom imports
  const handleDataImported = (newTransactions: Transaction[], type: string) => {
    if (!verifyWritePermission()) return;
    setTransactions(newTransactions);
    setDatasetType(type);
    setActiveTab("overview");
  };

  // Add a brand new customer
  const handleAddCustomer = async (customerId: string, amount: number, date: string) => {
    if (!verifyWritePermission()) return;

    const newTx: Transaction = { customerId, amount, date };
    const updated = [newTx, ...transactions];
    setTransactions(updated);

    if (token) {
      try {
        await fetch("/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            transactions: [{
              transactionId: `manual_${Date.now()}`,
              customerId,
              date,
              amount,
              source: "manual_entry"
            }],
            clearExisting: false
          })
        });
      } catch (err) {
        console.error("Failed to sync new customer to Cloud SQL:", err);
      }
    }
  };

  // Add an order to an existing customer
  const handleAddOrderToCustomer = async (customerId: string, amount: number, date: string) => {
    if (!verifyWritePermission()) return;

    const newTx: Transaction = { customerId, amount, date };
    const updated = [newTx, ...transactions];
    setTransactions(updated);

    if (token) {
      try {
        await fetch("/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            transactions: [{
              transactionId: `order_${Date.now()}`,
              customerId,
              date,
              amount,
              source: "manual_entry"
            }],
            clearExisting: false
          })
        });
      } catch (err) {
        console.error("Failed to sync new order to Cloud SQL:", err);
      }
    }
  };

  // Delete a customer and their orders
  const handleDeleteCustomer = async (customerId: string) => {
    if (!verifyWritePermission()) return;

    const updated = transactions.filter(t => t.customerId !== customerId);
    setTransactions(updated);

    if (token) {
      try {
        await fetch("/api/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            transactions: updated.map(t => ({
              transactionId: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              customerId: t.customerId,
              date: t.date,
              amount: t.amount,
              source: "sync"
            })),
            clearExisting: true
          })
        });
      } catch (err) {
        console.error("Failed to sync deletion to Cloud SQL:", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-600 antialiased" id="app-root">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 shadow-2xs" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          
          {/* Logo & title */}
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0 flex items-center justify-center">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-display font-bold text-slate-800 text-base sm:text-lg leading-tight tracking-tight">
                  Customer Lifetime Value & Churn Engine
                </h1>
                <span className="inline-flex items-center text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                  Cloud SQL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium flex items-center">
                <Database className="w-3.5 h-3.5 mr-1 text-slate-300" />
                Active Feed: <span className="font-semibold text-slate-600 ml-1">{datasetType}</span>
              </p>
            </div>
          </div>

          {/* Right Controls: Horizon, Margin & Auth */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto" id="global-controls">
            
            {/* Horizon Picker */}
            <div className="flex items-center space-x-1.5 text-xs bg-slate-50 p-1.5 rounded-xl border border-slate-100" id="horizon-picker">
              <span className="text-slate-400 font-semibold flex items-center px-1.5">
                <Clock className="w-3.5 h-3.5 mr-1" />
                Horizon:
              </span>
              <div className="flex space-x-1 font-mono font-medium">
                {[30, 90, 180, 365].map(days => (
                  <button
                    key={days}
                    onClick={() => setTargetDays(days)}
                    className={`px-2 py-0.5 rounded-lg text-xs transition-all ${
                      targetDays === days 
                        ? "bg-white text-indigo-600 shadow-xs font-bold" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    id={`horizon-${days}d`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>

            {/* Profit Margin slider */}
            <div className="flex items-center space-x-2 text-xs bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-100" id="margin-control">
              <span className="text-slate-400 font-semibold">Margin:</span>
              <span className="font-mono font-bold text-slate-700">{(profitMargin * 100).toFixed(0)}%</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={profitMargin}
                onChange={e => setProfitMargin(parseFloat(e.target.value))}
                className="w-14 accent-indigo-600 h-1"
                id="profit-margin-slider"
              />
            </div>

            {/* Creator Admin Access Management Button */}
            {isCreator && (
              <button
                onClick={() => setAdminModalOpen(true)}
                className="flex items-center space-x-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 px-3 rounded-xl shadow-xs transition-colors"
                title="Manage user access and approve permissions"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>Admin Access</span>
              </button>
            )}

            {/* Auth Controls & User Status */}
            <div className="flex items-center space-x-2">
              {user && !isApproved && !isCreator && (
                <button
                  onClick={() => openAuthModal("request")}
                  className="hidden sm:flex items-center space-x-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 px-2.5 rounded-xl shadow-xs transition-colors"
                  title="Request write authorization from the creator"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Request Access</span>
                </button>
              )}

              {user ? (
                <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200/80 py-1 px-2.5 rounded-xl text-xs">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white ${
                    isCreator ? "bg-amber-600" : isApproved ? "bg-emerald-600" : "bg-slate-500"
                  }`}>
                    {user.email ? user.email.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-800 max-w-[120px] truncate hidden md:inline leading-none">
                      {user.email}
                    </span>
                    <span className="text-[9px] font-bold font-mono leading-tight mt-0.5">
                      {isCreator ? (
                        <span className="text-amber-600">Creator (Admin)</span>
                      ) : isApproved ? (
                        <span className="text-emerald-600">Approved</span>
                      ) : (
                        <span className="text-slate-500">Read-Only</span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={signOut}
                    title="Sign Out"
                    className="p-1 hover:text-rose-600 text-slate-400 transition-colors ml-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openAuthModal("request")}
                    className="flex items-center space-x-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 px-3 rounded-xl shadow-xs transition-colors"
                    title="Request access to use and add customer records"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Request Access</span>
                  </button>

                  <button
                    onClick={() => openAuthModal("signin")}
                    className="flex items-center space-x-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1.5 px-3.5 rounded-xl shadow-xs transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </header>

      {/* Access Permission Pending Gate Banner */}
      <AccessPendingBanner />

      {/* Permission Error Toast Banner */}
      {permissionErrorNotice && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-rose-800 text-xs flex justify-between items-center animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{permissionErrorNotice}</span>
          </div>
          <button 
            onClick={() => setPermissionErrorNotice(null)}
            className="text-rose-500 hover:text-rose-700 font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main navigation Tabs Bar */}
      <nav className="bg-white border-b border-slate-100" id="navigation-tabs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto" id="tabs-scroller">
            
            {/* Tab 1: Overview */}
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-4 px-1 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all relative shrink-0 flex items-center space-x-2 ${
                activeTab === "overview" 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
              id="tab-overview"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Forecast Overview</span>
            </button>

            {/* Tab 2: Cohorts */}
            <button
              onClick={() => setActiveTab("cohorts")}
              className={`py-4 px-1 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all relative shrink-0 flex items-center space-x-2 ${
                activeTab === "cohorts" 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
              id="tab-cohorts"
            >
              <Layers className="w-4 h-4" />
              <span>Cohorts Analysis</span>
            </button>

            {/* Tab 3: Customer Directory & CLV */}
            <button
              onClick={() => setActiveTab("clv")}
              className={`py-4 px-1 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all relative shrink-0 flex items-center space-x-2 ${
                activeTab === "clv" 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
              id="tab-clv"
            >
              <Activity className="w-4 h-4" />
              <span>Customer Directory &amp; CLV</span>
            </button>

            {/* Tab 4: ML Attrition */}
            <button
              onClick={() => setActiveTab("churn")}
              className={`py-4 px-1 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all relative shrink-0 flex items-center space-x-2 ${
                activeTab === "churn" 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
              id="tab-churn"
            >
              <Cpu className="w-4 h-4" />
              <span>Supervised Attrition ML</span>
            </button>

            {/* Tab 5: Business Impact & AI */}
            <button
              onClick={() => setActiveTab("impact")}
              className={`py-4 px-1 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all relative shrink-0 flex items-center space-x-2 ${
                activeTab === "impact" 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
              id="tab-impact"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Business Impact &amp; AI</span>
            </button>

            {/* Tab 6: Database & Continuous Sync */}
            <button
              onClick={() => setActiveTab("import")}
              className={`py-4 px-1 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all relative shrink-0 flex items-center space-x-2 ${
                activeTab === "import" 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
              id="tab-import"
            >
              <Cloud className="w-4 h-4" />
              <span>Cloud SQL &amp; Ingestion</span>
            </button>

          </div>
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" id="main-content-area">
        <AnimatePresence mode="wait">
          {transactions.length === 0 ? (
            <div className="py-24 text-center" id="empty-state">
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
              <h2 className="font-display font-semibold text-slate-800 text-sm">Bootstrapping Analytic Database...</h2>
              <p className="text-xs text-slate-400 mt-1">Initializing transaction arrays and compiling local estimators.</p>
            </div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              id="active-tab-container"
            >
              {activeTab === "overview" && (
                <OverviewTab
                  customers={rfmCustomers}
                  predictions={analyticsResults.predictions}
                  targetDays={targetDays}
                />
              )}

              {activeTab === "cohorts" && (
                <CohortTab customers={rfmCustomers} />
              )}

              {activeTab === "clv" && (
                <CLVTab
                  customers={rfmCustomers}
                  predictions={analyticsResults.predictions}
                  bgnbdParams={modelParams}
                  targetDays={targetDays}
                  rawTransactions={transactions}
                  onAddCustomer={handleAddCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onAddOrderToCustomer={handleAddOrderToCustomer}
                />
              )}

              {activeTab === "churn" && (
                <ChurnTab
                  customers={rfmCustomers}
                  predictions={analyticsResults.predictions}
                  metrics={analyticsResults.metrics}
                  rules={analyticsResults.rules}
                />
              )}

              {activeTab === "impact" && (
                <BusinessImpactTab
                  customers={rfmCustomers}
                  predictions={analyticsResults.predictions}
                  metrics={analyticsResults.metrics}
                  rules={analyticsResults.rules}
                  datasetType={datasetType}
                />
              )}

              {activeTab === "import" && (
                <ImportTab
                  onDataLoaded={handleDataImported}
                  currentDatasetType={datasetType}
                  customersCount={rfmCustomers.length}
                  transactionsCount={transactions.length}
                  currentTransactions={transactions}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Admin Creator Approval Modal */}
      <AdminApprovalModal 
        isOpen={adminModalOpen} 
        onClose={() => setAdminModalOpen(false)} 
      />

      {/* Authentication and Access Request Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        defaultTab={authModalTab}
      />

      {/* Humble Footer */}
      <footer className="bg-white border-t border-slate-100 py-6" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 gap-4">
          <span className="font-medium">
            Customer Lifetime Value &amp; Churn Dashboard &copy; 2026. Managed by <strong className="text-slate-600">{creatorEmail}</strong>.
          </span>
          <div className="flex space-x-6">
            <span className="font-mono">Fitted LL: {analyticsResults?.metrics?.logLikelihood?.toFixed(2) || "0.00"}</span>
            <span className="font-mono">AIC: {analyticsResults?.metrics?.aic?.toFixed(2) || "0.00"}</span>
            <span className="font-mono">ROC AUC: {analyticsResults?.metrics?.churnAuc?.toFixed(2) || "0.50"}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
