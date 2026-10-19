/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  HelpCircle, 
  Search, 
  Percent, 
  Sparkles, 
  UserPlus, 
  Edit3, 
  Trash2, 
  Plus, 
  X, 
  Check, 
  History,
  ShoppingBag,
  Clock,
  ArrowRight,
  Lock,
  ShieldAlert,
  Mail,
  Copy
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { RFMCustomer, PredictionResult, ModelParameters, Transaction } from "../types";
import { useAuth } from "../context/AuthContext";

interface CLVTabProps {
  customers: RFMCustomer[];
  predictions: PredictionResult[];
  bgnbdParams: ModelParameters;
  targetDays: number;
  rawTransactions?: Transaction[];
  onAddCustomer?: (customerId: string, amount: number, date: string) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onAddOrderToCustomer?: (customerId: string, amount: number, date: string) => void;
}

export default function CLVTab({
  customers,
  predictions,
  bgnbdParams,
  targetDays,
  rawTransactions = [],
  onAddCustomer,
  onDeleteCustomer,
  onAddOrderToCustomer
}: CLVTabProps) {
  const { user, isCreator, isApproved, creatorEmail, signInWithGoogle, openAuthModal } = useAuth();
  const hasWriteAccess = Boolean(user && (isApproved || isCreator));

  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityModalReason, setSecurityModalReason] = useState<string>("");
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [newCustId, setNewCustId] = useState("");
  const [newCustAmount, setNewCustAmount] = useState("");
  const [newCustDate, setNewCustDate] = useState(new Date().toISOString().split("T")[0]);

  // Edit / Details Modal State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);

  const handleTriggerAddCustomer = () => {
    if (!user) {
      setSecurityModalReason("You must sign in with Google to add or modify customer records.");
      setShowSecurityModal(true);
      return;
    }
    if (!hasWriteAccess) {
      setSecurityModalReason(`Your account (${user.email}) is currently in Read-Only mode. Adding customer records requires authorization from creator ${creatorEmail}.`);
      setShowSecurityModal(true);
      return;
    }
    setShowAddModal(true);
  };

  const handleTriggerEditCustomer = (customerId: string) => {
    if (!user) {
      setSecurityModalReason("You must sign in with Google to view detailed order histories or add incremental transactions.");
      setShowSecurityModal(true);
      return;
    }
    if (!hasWriteAccess) {
      setSecurityModalReason(`Account pending approval. Modifying orders for customer ${customerId} requires authorization from creator ${creatorEmail}.`);
      setShowSecurityModal(true);
      return;
    }
    setSelectedCustomerId(customerId);
  };

  const handleTriggerDeleteCustomer = (customerId: string) => {
    if (!user) {
      setSecurityModalReason("You must sign in with Google to delete customer records.");
      setShowSecurityModal(true);
      return;
    }
    if (!hasWriteAccess) {
      setSecurityModalReason(`Account pending approval. Deleting customer records requires authorization from creator ${creatorEmail}.`);
      setShowSecurityModal(true);
      return;
    }
    if (confirm(`Delete customer ${customerId} and all their transaction history?`)) {
      if (onDeleteCustomer) onDeleteCustomer(customerId);
    }
  };

  const handleCopySecurityEmail = () => {
    const draft = `To: ${creatorEmail}\nSubject: Access Request: Customer Lifetime Value & Churn Engine\n\nHi Mui Kim,\n\nI would like to request permission to add and edit customer records in the Customer Lifetime Value & Churn Engine.\n\nMy Google Account: ${user?.email || "N/A"}\nUID: ${user?.uid || "N/A"}\n\nPlease approve my account in your Creator Access Portal.\n\nThank you!`;
    navigator.clipboard.writeText(draft);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2500);
  };

  // 1. Bin Probability Alive for Histogram
  const histogramData = useMemo(() => {
    const bins = Array(10).fill(0).map((_, i) => ({
      name: `${i * 10}-${(i + 1) * 10}%`,
      count: 0,
      color: i < 3 ? "#ef4444" : i < 7 ? "#f59e0b" : "#10b981"
    }));

    for (const p of predictions) {
      const idx = Math.min(9, Math.floor(p.pAlive * 10));
      bins[idx].count++;
    }

    return bins;
  }, [predictions]);

  // 2. Filter & Search customers list
  const filteredCustomers = useMemo(() => {
    return predictions.map(p => {
      const c = customers.find(cust => cust.customerId === p.customerId);
      return {
        ...p,
        frequency: c?.frequency || 0,
        recency: c?.recency || 0,
        tenure: c?.tenure || 0,
        monetaryValue: c?.monetaryValue || 0,
        totalSpend: c?.totalSpend || 0,
        firstDate: c?.firstPurchaseDate || "",
        lastDate: c?.lastPurchaseDate || ""
      };
    }).filter(item => {
      const matchesSearch = item.customerId.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (healthFilter === "all") return matchesSearch;
      if (healthFilter === "high") return matchesSearch && item.pAlive >= 0.75;
      if (healthFilter === "medium") return matchesSearch && item.pAlive >= 0.30 && item.pAlive < 0.75;
      if (healthFilter === "low") return matchesSearch && item.pAlive < 0.30;
      
      return matchesSearch;
    });
  }, [customers, predictions, searchTerm, healthFilter]);

  // Paginated listings
  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const currencyFormatter = (value: number) => {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Find selected customer details
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    const pred = predictions.find(p => p.customerId === selectedCustomerId);
    const cust = customers.find(c => c.customerId === selectedCustomerId);
    const txs = rawTransactions.filter(t => t.customerId === selectedCustomerId);
    return {
      pred,
      cust,
      txs
    };
  }, [selectedCustomerId, predictions, customers, rawTransactions]);

  // Handle Create Customer submit
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustId || !newCustAmount) return;
    const amt = parseFloat(newCustAmount);
    if (isNaN(amt)) return;

    if (onAddCustomer) {
      onAddCustomer(newCustId.trim(), amt, newCustDate);
    }

    setNewCustId("");
    setNewCustAmount("");
    setShowAddModal(false);
  };

  // Handle Add Order to existing customer
  const handleAddOrderToCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !orderAmount) return;
    const amt = parseFloat(orderAmount);
    if (isNaN(amt)) return;

    if (onAddOrderToCustomer) {
      onAddOrderToCustomer(selectedCustomerId, amt, orderDate);
    }

    setOrderAmount("");
  };

  return (
    <div className="space-y-8" id="clv-tab-container">
      
      {/* Parameter Explanations & Statistical coefficients */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="stats-math-panel">
        
        {/* Statistical parameters card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs lg:col-span-8 space-y-6" id="parameters-dashboard">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-800">BG/NBD & Gamma-Gamma Model Configuration</h2>
            <p className="text-xs text-slate-500 mt-1">
              Fitted coefficients that define purchase speeds and cancellation frequencies across the population.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* parameter r */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative group" id="param-r-card">
              <span className="text-[10px] font-bold text-indigo-600 block uppercase tracking-wider mb-1 flex items-center">
                Transaction Shape (r)
                <HelpCircle className="w-3.5 h-3.5 ml-1 text-slate-300 group-hover:text-indigo-500 cursor-pointer" />
              </span>
              <span className="text-xl font-mono font-bold text-slate-800">{bgnbdParams.r.toFixed(4)}</span>
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Represents initial purchase intensity of newly acquired accounts.
              </p>
            </div>

            {/* parameter alpha */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative group" id="param-alpha-card">
              <span className="text-[10px] font-bold text-indigo-600 block uppercase tracking-wider mb-1 flex items-center">
                Transaction Scale (α)
                <HelpCircle className="w-3.5 h-3.5 ml-1 text-slate-300 group-hover:text-indigo-500 cursor-pointer" />
              </span>
              <span className="text-xl font-mono font-bold text-slate-800">{bgnbdParams.alpha.toFixed(4)}</span>
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Represents frequency decay rate over time.
              </p>
            </div>

            {/* parameter a */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative group" id="param-a-card">
              <span className="text-[10px] font-bold text-amber-600 block uppercase tracking-wider mb-1 flex items-center">
                Dropout Beta (a)
                <HelpCircle className="w-3.5 h-3.5 ml-1 text-slate-300 group-hover:text-amber-500 cursor-pointer" />
              </span>
              <span className="text-xl font-mono font-bold text-slate-800">{bgnbdParams.a.toFixed(4)}</span>
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Shapes dropout speed before second purchases occur.
              </p>
            </div>

            {/* parameter b */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative group" id="param-b-card">
              <span className="text-[10px] font-bold text-amber-600 block uppercase tracking-wider mb-1 flex items-center">
                Retention Beta (b)
                <HelpCircle className="w-3.5 h-3.5 ml-1 text-slate-300 group-hover:text-amber-500 cursor-pointer" />
              </span>
              <span className="text-xl font-mono font-bold text-slate-800">{bgnbdParams.b.toFixed(4)}</span>
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Shapes retention resilience once frequency begins to expand.
              </p>
            </div>

          </div>

          <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100/30 flex items-start space-x-3 text-xs leading-relaxed text-indigo-900" id="statistics-interpretation">
            <Sparkles className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold block mb-0.5">Statistical Inference Summary:</span>
              Your customer transaction velocity ratio is <span className="font-semibold">{(bgnbdParams.r / bgnbdParams.alpha).toFixed(3)} purchases/day</span>. The high ratio of <span className="font-mono">b / a ({ (bgnbdParams.b / bgnbdParams.a).toFixed(1) }x)</span> signals a healthy customer pool, meaning customers who purchase at least twice exhibit very high subsequent retention.
            </div>
          </div>
        </div>

        {/* Explainers card for non-technical */}
        <div className="bg-slate-900 text-slate-300 rounded-2xl p-6 lg:col-span-4 flex flex-col justify-between" id="clv-educational-card">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 block mb-2">How BG/NBD Fits CLV</span>
            <h3 className="font-display font-semibold text-white text-base mb-4">The Probability of Being "Alive"</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Unlike contractual subscription cancels, retail customers rarely "tell" you they are leaving. They simply drift away. 
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              The BG/NBD model calculates a real-time <strong className="text-slate-200">Probability of Being Alive, P(Alive)</strong>. If an account has a history of purchasing every 10 days, and hasn't ordered in 30 days, their P(Alive) decays rapidly. If their interval is usually 90 days, 30 days of silence is normal, keeping their P(Alive) index near 98%.
            </p>
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center space-x-2 text-[10px] text-indigo-300 font-medium">
            <Percent className="w-4 h-4 text-indigo-400" />
            <span>Formulated by Fader, Hardie & Berger.</span>
          </div>
        </div>

      </div>

      {/* Probability Alive Distribution chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs" id="survival-distribution-chart">
        <div className="mb-6">
          <h2 className="font-display text-lg font-semibold text-slate-800">Database Churn Risk Distribution (U-Curve Diagnosis)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Visualizes customer volume across survival probabilities. A U-shaped distribution is standard: accounts are either highly engaged (right) or completely dormant (left).
          </p>
        </div>

        <div className="h-64 w-full" id="p-alive-histogram">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #f1f5f9" }}
                formatter={(value: any) => [value, "Customer Count"]}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {histogramData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Customer listing table */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs" id="clv-table-card">
        
        {/* Table Search & Filter controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="font-display text-lg font-semibold text-slate-800">Customer Directory &amp; Lifetime Projections</h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-mono font-semibold px-2 py-0.5 rounded-full">
                {filteredCustomers.length} Customers
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Add new customers, edit accounts, or log incremental orders to instantly update lifetime projections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto" id="table-filter-controls">
            
            {/* Add Customer Button */}
            <button
              onClick={handleTriggerAddCustomer}
              className={`py-2 px-3.5 font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 shrink-0 ${
                hasWriteAccess 
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80"
              }`}
              id="add-customer-top-btn"
              title={hasWriteAccess ? "Add new customer" : "Authentication & Approval Required to add customers"}
            >
              {!hasWriteAccess ? <Lock className="w-3.5 h-3.5 text-slate-500" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>{hasWriteAccess ? "Add Customer" : "Add Customer 🔒"}</span>
            </button>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Customer ID..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                id="search-customer-input"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex items-center space-x-1 border border-slate-200 rounded-xl p-1 bg-slate-50" id="health-filter-group">
              <button
                onClick={() => { setHealthFilter("all"); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  healthFilter === "all" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                All
              </button>
              <button
                onClick={() => { setHealthFilter("high"); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  healthFilter === "high" ? "bg-emerald-50 text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Healthy
              </button>
              <button
                onClick={() => { setHealthFilter("medium"); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  healthFilter === "medium" ? "bg-amber-50 text-amber-700 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Caution
              </button>
              <button
                onClick={() => { setHealthFilter("low"); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  healthFilter === "low" ? "bg-rose-50 text-rose-700 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Dormant
              </button>
            </div>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto" id="customers-clv-table">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-4 px-4">Customer ID</th>
                <th className="py-4 px-3 text-center">Frequency</th>
                <th className="py-4 px-3 text-center">Recency / Tenure</th>
                <th className="py-4 px-3 text-right">Avg Order</th>
                <th className="py-4 px-3 text-center">P(Alive)</th>
                <th className="py-4 px-3 text-center">E(Sales) in {targetDays}d</th>
                <th className="py-4 px-3 text-right">E(Monetary)</th>
                <th className="py-4 px-3 text-right font-semibold text-indigo-600">Future CLV</th>
                <th className="py-4 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-600">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    No customers match the active filters or search terms.
                  </td>
                </tr>
              ) : (
                paginatedList.map(c => {
                  let healthBg = "bg-emerald-50 text-emerald-700";
                  if (c.pAlive < 0.30) healthBg = "bg-rose-50 text-rose-700";
                  else if (c.pAlive < 0.75) healthBg = "bg-amber-50 text-amber-700";

                  return (
                    <tr key={c.customerId} className="hover:bg-slate-50/50 transition-colors" id={`row-${c.customerId}`}>
                      <td className="py-3 px-4 font-display font-medium text-slate-800 flex items-center space-x-1.5">
                        <span>{c.customerId}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">{c.frequency}</td>
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">{c.recency} / {c.tenure}d</td>
                      <td className="py-3 px-3 text-right font-mono">${c.monetaryValue.toFixed(2)}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${healthBg}`}>
                          {(c.pAlive * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-700">{c.expectedTransactions.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-mono">${c.expectedMonetaryValue.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right font-semibold font-mono text-indigo-600">
                        {currencyFormatter(c.predictedCLV)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleTriggerEditCustomer(c.customerId)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={hasWriteAccess ? "Edit / Add Orders" : "View / Edit (Authentication & Approval Required)"}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleTriggerDeleteCustomer(c.customerId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={hasWriteAccess ? "Delete Customer" : "Delete (Authentication & Approval Required)"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {filteredCustomers.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4 text-xs text-slate-400" id="clv-table-pagination">
            <span>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(filteredCustomers.length, currentPage * itemsPerPage)} of {filteredCustomers.length} profiles
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
                id="prev-page-btn"
              >
                Previous
              </button>
              <span className="font-medium text-slate-700 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
                id="next-page-btn"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal 1: Add New Customer */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-indigo-600">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-display font-semibold text-slate-800 text-base">Add New Customer</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. CUST-5001 or email@domain.com"
                  value={newCustId}
                  onChange={e => setNewCustId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono focus:border-indigo-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">First Purchase ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="99.50"
                    value={newCustAmount}
                    onChange={e => setNewCustAmount(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono focus:border-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={newCustDate}
                    onChange={e => setNewCustDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono focus:border-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                Creating this customer will add their opening order and recalculate real-time RFM parameters and survival probability.
              </p>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs"
                >
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Customer / View Orders & Add Transaction */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-display font-bold text-slate-800 text-lg">
                    {selectedCustomerId}
                  </h3>
                  {selectedCustomer.pred && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      selectedCustomer.pred.pAlive >= 0.75 
                        ? "bg-emerald-50 text-emerald-700" 
                        : selectedCustomer.pred.pAlive >= 0.30 
                        ? "bg-amber-50 text-amber-700" 
                        : "bg-rose-50 text-rose-700"
                    }`}>
                      {(selectedCustomer.pred.pAlive * 100).toFixed(0)}% P(Alive)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Customer profile &amp; chronological order timeline.
                </p>
              </div>
              <button 
                onClick={() => setSelectedCustomerId(null)} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Orders</span>
                <span className="text-base font-bold font-mono text-slate-800">
                  {selectedCustomer.cust ? selectedCustomer.cust.frequency + 1 : selectedCustomer.txs.length}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Spend</span>
                <span className="text-base font-bold font-mono text-slate-800">
                  ${(selectedCustomer.cust?.totalSpend || selectedCustomer.txs.reduce((s, t) => s + t.amount, 0)).toFixed(0)}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Avg Value</span>
                <span className="text-base font-bold font-mono text-slate-800">
                  ${(selectedCustomer.cust?.monetaryValue || 0).toFixed(0)}
                </span>
              </div>
              <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-900">
                <span className="text-[10px] text-indigo-600 font-bold block uppercase">Future CLV</span>
                <span className="text-base font-bold font-mono text-indigo-700">
                  ${(selectedCustomer.pred?.predictedCLV || 0).toFixed(0)}
                </span>
              </div>
            </div>

            {/* Form: Add another purchase to this customer */}
            <form onSubmit={handleAddOrderToCurrent} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-700 shrink-0">
                + New Order:
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="Amount ($)"
                value={orderAmount}
                onChange={e => setOrderAmount(e.target.value)}
                className="text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono w-28 focus:outline-hidden"
                required
              />
              <input
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono flex-1 focus:outline-hidden"
                required
              />
              <button
                type="submit"
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors shrink-0"
              >
                Log Order
              </button>
            </form>

            {/* Chronological order list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Recorded Transactions ({selectedCustomer.txs.length})
              </span>
              {selectedCustomer.txs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No orders recorded.</p>
              ) : (
                selectedCustomer.txs.map((tx, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs">
                    <div className="flex items-center space-x-2">
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-slate-700">{tx.date}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-800">
                      ${tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Footer with Delete option */}
            <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
              <button
                onClick={() => {
                  if (confirm(`Remove ${selectedCustomerId} from database?`)) {
                    if (onDeleteCustomer) onDeleteCustomer(selectedCustomerId!);
                    setSelectedCustomerId(null);
                  }
                }}
                className="text-rose-600 hover:text-rose-800 font-medium flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Customer Profile</span>
              </button>

              <button
                onClick={() => setSelectedCustomerId(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal 3: Security Access Gate Modal (Authentication & Creator Approval) */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-amber-600">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-base">
                    {!user ? "Authentication Required" : "Creator Approval Required"}
                  </h3>
                  <p className="text-xs text-slate-400">Security &amp; Data Integrity Protection</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecurityModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>{securityModalReason}</p>

              {!user ? (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <span className="font-semibold text-slate-800 block">Why is sign-in required?</span>
                  <p className="text-slate-500 text-[11px]">
                    To maintain clean customer cohort tracking and safeguard production databases, only verified user accounts can create or modify customer records.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/60 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-900 font-semibold">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>How to get authorized?</span>
                  </div>
                  <p className="text-amber-800 text-[11px]">
                    Please email creator <strong>{creatorEmail}</strong>. Once approved in the Creator Access Portal, your account will immediately have write access to add customers and run real-time updates.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowSecurityModal(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 border border-slate-200"
              >
                Cancel
              </button>

              {!user ? (
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setShowSecurityModal(false);
                      openAuthModal("request");
                    }}
                    className="flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-medium border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center justify-center space-x-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Request Access</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowSecurityModal(false);
                      openAuthModal("signin");
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs flex items-center justify-center space-x-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    onClick={handleCopySecurityEmail}
                    className="flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center space-x-1"
                  >
                    {copiedDraft ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDraft ? "Copied!" : "Copy Email"}</span>
                  </button>
                  <a
                    href={`mailto:${creatorEmail}?subject=${encodeURIComponent("Access Request: Customer Lifetime Value & Churn Engine")}&body=${encodeURIComponent(
                      `Hi Mui Kim,\n\nI would like to request permission to add and edit customer records in the Customer Lifetime Value & Churn Engine.\n\nMy Google Account: ${user.email}\nUID: ${user.uid}\n\nPlease approve my account in your Creator Access Portal.\n\nThank you!`
                    )}`}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 shadow-xs flex items-center justify-center space-x-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Creator</span>
                  </a>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
