/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Database, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Cloud, 
  RefreshCw, 
  Trash2, 
  Save, 
  LogIn, 
  Send,
  Zap,
  Plus,
  Search,
  ExternalLink,
  Table,
  Check,
  Lock,
  ShieldAlert,
  Mail,
  Copy
} from "lucide-react";
import { Transaction, APIConfig } from "../types";
import { generateEcommerceSampleData, generateSaaSSampleData } from "../utils/sampleData";
import { useAuth } from "../context/AuthContext";

interface ImportTabProps {
  onDataLoaded: (transactions: Transaction[], datasetType: string) => void;
  currentDatasetType: string;
  customersCount: number;
  transactionsCount: number;
  currentTransactions: Transaction[];
}

export default function ImportTab({
  onDataLoaded,
  currentDatasetType,
  customersCount,
  transactionsCount,
  currentTransactions
}: ImportTabProps) {
  const { user, token, isCreator, isApproved, creatorEmail, signInWithGoogle } = useAuth();
  const hasWriteAccess = Boolean(user && (isApproved || isCreator));

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  const handleCopyCsvDraft = () => {
    const draft = `To: ${creatorEmail}\nSubject: Access Request: Upload CSV & Modify Customer Data\n\nHi Mui Kim,\n\nI would like to request authorized access to upload CSV datasets and write customer records in the Customer Lifetime Value & Churn Engine.\n\nMy Google Account: ${user?.email || "N/A"}\nUID: ${user?.uid || "N/A"}\n\nPlease approve my account in your Creator Access Portal.\n\nThank you!`;
    navigator.clipboard.writeText(draft);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2500);
  };
  
  // Cloud SQL Sync State
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [simulatingOrder, setSimulatingOrder] = useState(false);

  // Live Database Grid State
  const [dbRows, setDbRows] = useState<any[]>([]);
  const [dbSearch, setDbSearch] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [dbPage, setDbPage] = useState(1);
  const dbItemsPerPage = 8;

  // Manual Add Form
  const [newCustId, setNewCustId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [addingOrder, setAddingOrder] = useState(false);

  // API Config State
  const [apiConfig, setApiConfig] = useState<APIConfig>({
    endpointUrl: "https://api.mycompany.com/v1/transactions",
    method: "GET",
    headers: { "Authorization": "Bearer token_abc123" },
    mapping: {
      customerId: "user_id",
      date: "purchase_date",
      amount: "price"
    }
  });
  const [apiLoading, setApiLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch live database rows when token changes
  const fetchDbRows = async () => {
    if (!token) return;
    setDbLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDbRows(data.transactions || []);
      }
    } catch (err) {
      console.error("Failed to load db rows:", err);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDbRows();
    }
  }, [token]);

  // Save current active transactions into Cloud SQL
  const handleSaveToCloudSql = async () => {
    if (!token) return;
    if (!hasWriteAccess) {
      setSyncStatus({
        type: "error",
        message: `Security Access Restricted: Your account is pending creator authorization. Please drop an email to ${creatorEmail} to approve access.`
      });
      return;
    }
    setSyncLoading(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          transactions: currentTransactions.map(t => ({
            transactionId: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            customerId: t.customerId,
            date: t.date,
            amount: t.amount,
            source: "user_sync"
          })),
          clearExisting: true
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to persist to Cloud SQL");
      }

      const data = await res.json();
      setSyncStatus({
        type: "success",
        message: `Successfully synchronized and stored ${data.insertedCount} transactions in Cloud SQL PostgreSQL!`
      });
      onDataLoaded(currentTransactions, `Cloud SQL Live Database (${data.insertedCount} orders)`);
      fetchDbRows();
    } catch (err: any) {
      console.error(err);
      setSyncStatus({
        type: "error",
        message: err.message || "Failed to persist records to Cloud SQL."
      });
    } finally {
      setSyncLoading(false);
    }
  };

  // Load transactions from Cloud SQL into the analytics engine
  const handleFetchFromCloudSql = async () => {
    if (!token) return;
    setSyncLoading(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/transactions", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load transactions");
      }
      const data = await res.json();
      const records = data.transactions || [];
      if (records.length === 0) {
        setSyncStatus({
          type: "error",
          message: "No transactions found in Cloud SQL yet. Click 'Persist to Cloud SQL' or add an order below."
        });
        return;
      }

      const mapped: Transaction[] = records.map((t: any) => ({
        customerId: t.customerId,
        date: t.date,
        amount: t.amount
      }));

      onDataLoaded(mapped, `Cloud SQL Live Database (${mapped.length} orders)`);
      setDbRows(records);
      setSyncStatus({
        type: "success",
        message: `Loaded ${mapped.length} orders directly from Cloud SQL PostgreSQL.`
      });
    } catch (err: any) {
      console.error(err);
      setSyncStatus({
        type: "error",
        message: err.message || "Failed to load from Cloud SQL."
      });
    } finally {
      setSyncLoading(false);
    }
  };

  // Clear transactions in Cloud SQL
  const handleClearCloudSql = async () => {
    if (!token) return;
    if (!hasWriteAccess) {
      setSyncStatus({
        type: "error",
        message: `Security Access Restricted: Deleting database records requires approval from creator ${creatorEmail}.`
      });
      return;
    }
    if (!confirm("Are you sure you want to delete all stored transactions for your account in Cloud SQL?")) return;
    setSyncLoading(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear database");
      }
      setDbRows([]);
      setSyncStatus({
        type: "success",
        message: "All database transactions wiped from Cloud SQL."
      });
    } catch (err: any) {
      setSyncStatus({
        type: "error",
        message: err.message || "Failed to clear transactions."
      });
    } finally {
      setSyncLoading(false);
    }
  };

  // Delete a single row from Cloud SQL
  const handleDeleteRow = async (id: number) => {
    if (!token) return;
    if (!hasWriteAccess) {
      setSyncStatus({
        type: "error",
        message: `Security Access Restricted: Removing transactions requires creator authorization (${creatorEmail}).`
      });
      return;
    }
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = dbRows.filter(r => r.id !== id);
        setDbRows(updated);
        // Also sync active in-memory transactions
        const mapped: Transaction[] = updated.map((t: any) => ({
          customerId: t.customerId,
          date: t.date,
          amount: t.amount
        }));
        onDataLoaded(mapped, `Cloud SQL Live Database (${mapped.length} orders)`);
      }
    } catch (err) {
      console.error("Failed to delete row:", err);
    }
  };

  // Manual Add Order into Cloud SQL
  const handleAddManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newCustId || !newAmount) return;
    if (!hasWriteAccess) {
      setSyncStatus({
        type: "error",
        message: `Security Access Restricted: Adding customer orders requires creator approval from ${creatorEmail}.`
      });
      return;
    }
    setAddingOrder(true);
    try {
      const orderAmount = parseFloat(newAmount);
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          transactions: [{
            transactionId: `manual_${Date.now()}`,
            customerId: newCustId.trim(),
            date: newDate,
            amount: orderAmount,
            source: "manual_entry"
          }],
          clearExisting: false
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add order");
      }

      setNewCustId("");
      setNewAmount("");
      
      // Refresh DB rows and memory
      await fetchDbRows();
      const updatedTx: Transaction = {
        customerId: newCustId.trim(),
        date: newDate,
        amount: orderAmount
      };
      const updated = [updatedTx, ...currentTransactions];
      onDataLoaded(updated, `Cloud SQL Live Database (${updated.length} orders)`);

      setSyncStatus({
        type: "success",
        message: `Order for ${newCustId} ($${orderAmount}) recorded into Cloud SQL!`
      });
    } catch (err: any) {
      setSyncStatus({
        type: "error",
        message: err.message || "Failed to insert order."
      });
    } finally {
      setAddingOrder(false);
    }
  };

  // Live order webhook simulator
  const handleSimulateIncomingOrder = async () => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    if (!hasWriteAccess) {
      setSyncStatus({
        type: "error",
        message: `Security Access Restricted: Live order simulation requires creator approval from ${creatorEmail}.`
      });
      return;
    }
    setSimulatingOrder(true);
    try {
      const sampleCustomer = currentTransactions.length > 0 
        ? currentTransactions[Math.floor(Math.random() * currentTransactions.length)].customerId 
        : `CUST-${Math.floor(Math.random() * 900 + 100)}`;
      
      const today = new Date().toISOString().split("T")[0];
      const randomAmount = parseFloat((Math.random() * 120 + 15).toFixed(2));

      const res = await fetch("/api/webhook/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: user.uid,
          customerId: sampleCustomer,
          amount: randomAmount,
          date: today
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Webhook ingestion failed");
      }

      await fetchDbRows();
      const newTx: Transaction = {
        customerId: sampleCustomer,
        date: today,
        amount: randomAmount
      };
      const updated = [newTx, ...currentTransactions];
      onDataLoaded(updated, `Cloud SQL Live Database (${updated.length} orders)`);

      setSyncStatus({
        type: "success",
        message: `⚡ Webhook Ingested: ${sampleCustomer} order ($${randomAmount}) committed to Cloud SQL.`
      });
    } catch (err: any) {
      setSyncStatus({
        type: "error",
        message: err.message || "Order simulation failed."
      });
    } finally {
      setSimulatingOrder(false);
    }
  };

  // Load Presets
  const handleLoadPreset = (type: "ecommerce" | "saas") => {
    let txs: Transaction[] = [];
    if (type === "ecommerce") {
      txs = generateEcommerceSampleData();
      onDataLoaded(txs, "E-commerce Retail (18mo History)");
    } else {
      txs = generateSaaSSampleData();
      onDataLoaded(txs, "SaaS Recurring Subscription");
    }
  };

  // CSV Parsing
  const parseCSV = (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error("CSV file is empty or lacks headers.");
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]+/g, ''));
      
      const customerIdx = headers.findIndex(h => h.includes("customer") || h.includes("cust") || h.includes("user") || h === "id");
      const dateIdx = headers.findIndex(h => h.includes("date") || h.includes("time") || h.includes("invoice"));
      const amountIdx = headers.findIndex(h => h.includes("amount") || h.includes("revenue") || h.includes("price") || h.includes("sales") || h.includes("spend"));

      if (customerIdx === -1 || dateIdx === -1 || amountIdx === -1) {
        throw new Error(
          `Could not auto-detect columns. Ensure your CSV contains columns for Customer ID, Date, and Amount.`
        );
      }

      const parsedTransactions: Transaction[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(",").map(c => c.trim().replace(/['"]+/g, ''));
        if (cols.length < headers.length) continue;

        const customerId = cols[customerIdx];
        const dateStr = cols[dateIdx];
        const amountStr = cols[amountIdx];

        const amount = parseFloat(amountStr);
        if (!customerId || !dateStr || isNaN(amount)) continue;

        parsedTransactions.push({
          customerId,
          date: dateStr,
          amount
        });
      }

      if (!user) {
        throw new Error("Authentication Required: Please sign in with Google to upload and process customer CSV data.");
      }

      if (!hasWriteAccess) {
        throw new Error(`Security Access Restricted: Your account (${user.email}) is pending creator authorization. Please drop an email to ${creatorEmail} to approve access.`);
      }

      onDataLoaded(parsedTransactions, `Custom Upload: ${csvFile?.name || "CSV Data"}`);
      setCsvError(null);
    } catch (err: any) {
      setCsvError(err.message || "An error occurred while parsing the CSV.");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setCsvFile(file);
      readFileContent(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCsvFile(file);
      readFileContent(file);
    }
  };

  const readFileContent = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.onerror = () => {
      setCsvError("Failed to read the file.");
    };
    reader.readAsText(file);
  };

  // Filtered db rows for viewer
  const filteredDbRows = dbRows.filter(r => 
    r.customerId?.toLowerCase().includes(dbSearch.toLowerCase()) ||
    r.date?.includes(dbSearch) ||
    r.source?.toLowerCase().includes(dbSearch.toLowerCase())
  );

  const paginatedDbRows = filteredDbRows.slice((dbPage - 1) * dbItemsPerPage, dbPage * dbItemsPerPage);
  const totalDbPages = Math.ceil(filteredDbRows.length / dbItemsPerPage) || 1;

  return (
    <div className="space-y-8" id="import-container">
      
      {/* Cloud SQL Live Database Banner & Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden" id="cloud-sql-status-card">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 mb-2">
              <Cloud className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Managed Cloud SQL PostgreSQL Engine</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                Online (asia-southeast1)
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-white tracking-tight">
              Live Continuous Ingestion &amp; Database Sync
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
              Your transactional orders and customer CLV calculations are mapped to a production PostgreSQL database. Update data via webhooks, CSV sync, or the row editor below.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {user ? (
              <>
                <button
                  onClick={handleSaveToCloudSql}
                  disabled={syncLoading || !hasWriteAccess}
                  className={`px-4 py-2.5 rounded-xl text-white text-xs font-semibold flex items-center space-x-2 shadow-xs transition-colors ${
                    hasWriteAccess 
                      ? "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50" 
                      : "bg-slate-700/80 text-slate-400 border border-white/10 cursor-not-allowed"
                  }`}
                  id="persist-to-cloudsql-btn"
                  title={hasWriteAccess ? "Save current dataset into Cloud SQL" : `Approval from creator (${creatorEmail}) required`}
                >
                  {syncLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : !hasWriteAccess ? (
                    <Lock className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{hasWriteAccess ? "Persist to Cloud SQL" : "Persist (Approval Required)"}</span>
                </button>

                <button
                  onClick={handleFetchFromCloudSql}
                  disabled={syncLoading}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center space-x-2 transition-colors border border-white/10"
                  id="load-from-cloudsql-btn"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Load Live Records</span>
                </button>

                <button
                  onClick={handleSimulateIncomingOrder}
                  disabled={simulatingOrder || !hasWriteAccess}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors ${
                    hasWriteAccess 
                      ? "bg-amber-500 hover:bg-amber-400 text-slate-950" 
                      : "bg-slate-800 text-slate-400 border border-white/10 cursor-not-allowed"
                  }`}
                  id="simulate-live-order-btn"
                  title={hasWriteAccess ? "Trigger real-time webhook order" : `Approval from creator (${creatorEmail}) required`}
                >
                  {!hasWriteAccess ? <Lock className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-slate-950" />}
                  <span>{simulatingOrder ? "Ingesting..." : hasWriteAccess ? "Simulate Incoming Order (+1)" : "Simulate (Locked)"}</span>
                </button>
              </>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-2 shadow-xs transition-colors"
                id="cloudsql-login-btn"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google to Sync Database</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync notification message */}
        {syncStatus && (
          <div className={`mt-4 p-3 rounded-xl text-xs flex items-center space-x-2 ${
            syncStatus.type === "success" 
              ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30" 
              : "bg-rose-500/20 text-rose-200 border border-rose-500/30"
          }`}>
            {syncStatus.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{syncStatus.message}</span>
          </div>
        )}

        {/* Cloud Console & Webhook Direct Link Bar */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap justify-between items-center text-xs text-slate-300 gap-4">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span className="bg-white/10 px-2.5 py-1 rounded-lg text-indigo-300">
              Project: <strong>starlit-dominion-9p2jd</strong>
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded-lg text-emerald-300">
              Instance: <strong>ai-studio-88760f16</strong>
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded-lg text-amber-300">
              Region: <strong>asia-southeast1</strong>
            </span>
          </div>

          <a
            href="https://console.cloud.google.com/sql/instances/ai-studio-88760f16/overview?project=starlit-dominion-9p2jd"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs text-indigo-300 hover:text-white font-medium transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
          >
            <span>Open in Google Cloud Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Database Direct Explorer & Row Editor */}
      {user && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6" id="db-explorer-card">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Table className="w-5 h-5 text-indigo-600" />
                <h3 className="font-display font-semibold text-slate-800 text-base">
                  Cloud SQL Table Explorer (`transactions`)
                </h3>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-medium">
                  {dbRows.length} rows committed
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Directly assess rows in your PostgreSQL table, insert manual transactions, or remove stale entries.
              </p>
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto">
              <div className="relative w-full md:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter table rows..."
                  value={dbSearch}
                  onChange={e => { setDbSearch(e.target.value); setDbPage(1); }}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
              <button
                onClick={fetchDbRows}
                title="Refresh Table"
                disabled={dbLoading}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500"
              >
                <RefreshCw className={`w-4 h-4 ${dbLoading ? "animate-spin text-indigo-600" : ""}`} />
              </button>
              <button
                onClick={handleClearCloudSql}
                title="Wipe Table"
                className="p-2 border border-rose-200 rounded-xl hover:bg-rose-50 text-rose-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Manual Add Form */}
          <form onSubmit={handleAddManualOrder} className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center">
              <Plus className="w-3.5 h-3.5 mr-1 text-indigo-600" />
              Add Order:
            </span>
            <input
              type="text"
              placeholder="Customer ID (e.g. CUST-990)"
              value={newCustId}
              onChange={e => setNewCustId(e.target.value)}
              className="text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono flex-1 min-w-[140px]"
              required
            />
            <input
              type="number"
              step="0.01"
              min="1"
              placeholder="Amount ($)"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              className="text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono w-28"
              required
            />
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono w-36"
              required
            />
            <button
              type="submit"
              disabled={addingOrder || !hasWriteAccess}
              className={`px-4 py-2 font-semibold text-xs rounded-lg transition-colors flex items-center space-x-1.5 shrink-0 ${
                hasWriteAccess
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
              title={hasWriteAccess ? "Commit Order" : "Authorization required from creator muikimlim.insead@gmail.com"}
            >
              {!hasWriteAccess ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{addingOrder ? "Saving..." : hasWriteAccess ? "Commit Order" : "Commit Order (Locked)"}</span>
            </button>
          </form>

          {/* Database Table Grid */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <th className="py-3 px-4">Row ID</th>
                  <th className="py-3 px-4">Customer ID</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Source</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                {paginatedDbRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      {dbRows.length === 0 
                        ? "No transactions currently in Cloud SQL. Use 'Persist to Cloud SQL' or add an order above."
                        : "No rows match your filter search."}
                    </td>
                  </tr>
                ) : (
                  paginatedDbRows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 text-slate-400">#{row.id}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{row.customerId}</td>
                      <td className="py-2.5 px-4">{row.date}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                        ${typeof row.amount === "number" ? row.amount.toFixed(2) : row.amount}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                          {row.source || "manual"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          disabled={!hasWriteAccess}
                          className={`p-1 transition-colors ${
                            hasWriteAccess ? "text-slate-400 hover:text-rose-600" : "text-slate-300 cursor-not-allowed"
                          }`}
                          title={hasWriteAccess ? "Delete from database" : "Locked (Approval Required)"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredDbRows.length > 0 && (
            <div className="flex justify-between items-center text-xs text-slate-400 pt-2">
              <span>
                Showing {((dbPage - 1) * dbItemsPerPage) + 1} to {Math.min(filteredDbRows.length, dbPage * dbItemsPerPage)} of {filteredDbRows.length} rows
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setDbPage(p => Math.max(1, p - 1))}
                  disabled={dbPage === 1}
                  className="px-3 py-1 rounded border border-slate-200 text-slate-600 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="font-mono px-2 py-1">{dbPage} / {totalDbPages}</span>
                <button
                  onClick={() => setDbPage(p => Math.min(totalDbPages, p + 1))}
                  disabled={dbPage === totalDbPages}
                  className="px-3 py-1 rounded border border-slate-200 text-slate-600 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preset & CSV Import Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Presets */}
        <div className="col-span-1 lg:col-span-6 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs h-full" id="presets-card">
            <div className="flex items-center space-x-3 mb-3">
              <Database className="w-5 h-5 text-indigo-600" />
              <h2 className="font-display text-base font-semibold text-slate-800">Demo Datasets</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Load multi-year transactional logs to experience model updates across different business models.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleLoadPreset("ecommerce")}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  currentDatasetType.includes("E-commerce")
                    ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600/30"
                    : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="font-display font-semibold text-slate-800 text-xs block mb-1">Retail E-commerce</span>
                <p className="text-[11px] text-slate-500">250 shoppers over 18 months, non-contractual repeat purchases.</p>
              </button>

              <button
                onClick={() => handleLoadPreset("saas")}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  currentDatasetType.includes("SaaS")
                    ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600/30"
                    : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="font-display font-semibold text-slate-800 text-xs block mb-1">SaaS Subscriptions</span>
                <p className="text-[11px] text-slate-500">150 accounts across Basic, Pro, Enterprise tiers.</p>
              </button>
            </div>
          </div>
        </div>

        {/* CSV Upload */}
        <div className="col-span-1 lg:col-span-6 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs h-full" id="csv-uploader-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                <h2 className="font-display text-base font-semibold text-slate-800">Upload CSV File</h2>
              </div>
              <button
                onClick={() => {
                  const headers = "CustomerID,InvoiceDate,PurchaseAmount\nCUST-1001,2025-01-15,49.99\nCUST-1002,2025-01-15,129.50\nCUST-1001,2025-02-12,24.50\n";
                  const blob = new Blob([headers], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "customer_transactions_template.csv";
                  a.click();
                }}
                className="text-[11px] text-indigo-600 hover:underline font-medium"
              >
                Sample CSV
              </button>
            </div>
            
            {!user ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center space-y-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-xs">Authentication Required</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                    Please sign in with Google to upload customer transaction CSVs or commit live data.
                  </p>
                </div>
                <button
                  onClick={signInWithGoogle}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In with Google</span>
                </button>
              </div>
            ) : !hasWriteAccess ? (
              <div className="border-2 border-dashed border-amber-200 rounded-xl p-6 text-center bg-amber-50/40 flex flex-col items-center justify-center space-y-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-950 text-xs">Creator Authorization Required</h3>
                  <p className="text-[11px] text-amber-800 mt-0.5 max-w-sm">
                    You are signed in as <strong>{user.email}</strong>. Uploading custom CSV files or modifying customer databases requires approval from creator <strong>{creatorEmail}</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <a
                    href={`mailto:${creatorEmail}?subject=${encodeURIComponent("Access Request: Upload CSV & Modify Customer Data")}&body=${encodeURIComponent(
                      `Hi Mui Kim,\n\nI would like to request permission to upload CSV datasets and write customer records in the Customer Lifetime Value & Churn Engine.\n\nMy Google Account: ${user.email}\nUID: ${user.uid}\n\nPlease approve my account in your Creator Access Portal.\n\nThank you!`
                    )}`}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-medium shadow-xs flex items-center space-x-1 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Creator for Access</span>
                  </a>
                  <button
                    onClick={handleCopyCsvDraft}
                    className="px-3 py-1.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-medium flex items-center space-x-1 transition-colors"
                  >
                    {copiedDraft ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
                    <span>{copiedDraft ? "Copied!" : "Copy Email Draft"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragActive ? "border-indigo-600 bg-indigo-50/20" : "border-slate-200 hover:border-slate-400 bg-slate-50/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="w-5 h-5 text-indigo-500 mx-auto mb-2" />
                <span className="text-xs font-medium text-slate-700 block">
                  {csvFile ? csvFile.name : "Click or drag & drop CSV file"}
                </span>
                <span className="text-[10px] text-slate-400">CustomerID, InvoiceDate, PurchaseAmount</span>
              </form>
            )}

            {csvError && (
              <p className="text-xs text-rose-600 mt-2 font-medium">{csvError}</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
