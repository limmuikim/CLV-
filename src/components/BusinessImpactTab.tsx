/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { DollarSign, Percent, TrendingUp, Sparkles, BookOpen, Download, Copy, Check, RefreshCw, AlertCircle } from "lucide-react";
import { RFMCustomer, PredictionResult, ModelMetrics } from "../types";
import { calculateBusinessImpact } from "../utils/analytics";

interface BusinessImpactTabProps {
  customers: RFMCustomer[];
  predictions: PredictionResult[];
  metrics: ModelMetrics;
  rules: string[];
  datasetType: string;
}

export default function BusinessImpactTab({
  customers,
  predictions,
  metrics,
  rules,
  datasetType
}: BusinessImpactTabProps) {
  // 1. Simulation Inputs
  const [campaignCost, setCampaignCost] = useState(15); // $15 per targeted account
  const [incentiveValue, setIncentiveValue] = useState(40); // $40 incentive offered to converts
  const [campaignConversion, setCampaignConversion] = useState(25); // 25% of targets successfully converted
  
  // 2. Strategic Report Generation State
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 3. Dynamic Calculation
  const averageCLV = useMemo(() => {
    if (customers.length === 0) return 150;
    const totalSpend = customers.reduce((sum, c) => sum + c.totalSpend, 0);
    const predictedCLV = predictions.reduce((sum, p) => sum + p.predictedCLV, 0);
    return (totalSpend + predictedCLV) / customers.length;
  }, [customers, predictions]);

  const impact = useMemo(() => {
    return calculateBusinessImpact(customers, predictions, metrics, {
      campaignCost,
      incentiveValue,
      campaignConversion,
      averageCLV
    });
  }, [customers, predictions, metrics, campaignCost, incentiveValue, campaignConversion, averageCLV]);

  // 4. Request Gemini Strategic Briefing from Full-Stack Express Server
  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    const totalSpend = customers.reduce((sum, c) => sum + c.totalSpend, 0);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          datasetType,
          customerCount: customers.length,
          totalSpend,
          bgnbdParams: {
            r: 0.5,
            alpha: 10,
            a: 0.8,
            b: 2.5,
            p: 6.2,
            q: 3.6,
            gamma: averageCLV / 2.38
          },
          mlMetrics: metrics,
          rules,
          businessImpact: {
            campaignCost,
            incentiveValue,
            campaignConversion,
            currentChurnRate: impact.currentChurnRate,
            targetedCustomers: impact.targetedCustomers,
            preventedChurnCount: impact.preventedChurnCount,
            grossRevenueSaved: impact.grossRevenueSaved,
            campaignCostTotal: impact.campaignCostTotal,
            incentiveCostTotal: impact.incentiveCostTotal,
            netSavings: impact.netSavings,
            roi: impact.roi
          },
          targetDays: 90
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      setReport(data.report);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to contact Gemini server. Ensure your GEMINI_API_KEY is active.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${datasetType.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_strategic_briefing.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 5. Custom regex Markdown Renderer to display beautiful structured report
  const renderFormattedReport = (mdText: string) => {
    const lines = mdText.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;

      // H3 Headings
      if (trimmed.startsWith("###")) {
        return (
          <h3 key={idx} className="font-display font-bold text-slate-800 text-sm tracking-wide uppercase mt-6 mb-3 border-b border-slate-100 pb-2">
            {trimmed.replace(/^###\s*/, "")}
          </h3>
        );
      }

      // H2 Headings
      if (trimmed.startsWith("##")) {
        return (
          <h2 key={idx} className="font-display font-bold text-indigo-600 text-base tracking-wide uppercase mt-8 mb-4 border-l-2 border-indigo-600 pl-3">
            {trimmed.replace(/^##\s*/, "")}
          </h2>
        );
      }

      // H1 Headings
      if (trimmed.startsWith("#")) {
        return (
          <h1 key={idx} className="font-display font-extrabold text-slate-900 text-xl tracking-tight mb-6 text-center">
            {trimmed.replace(/^#\s*/, "")}
          </h1>
        );
      }

      // Bullet items
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const text = trimmed.replace(/^[-*]\s*/, "");
        // Format bold highlights
        const boldParts = text.split("**");
        return (
          <li key={idx} className="ml-4 pl-1 list-disc text-slate-600 text-xs leading-relaxed mb-1.5">
            {boldParts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="text-slate-800 font-semibold">{part}</strong> : part))}
          </li>
        );
      }

      // Bold text replacements in normal paragraphs
      const boldParts = trimmed.split("**");
      return (
        <p key={idx} className="text-slate-600 text-xs leading-relaxed mb-3">
          {boldParts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="text-slate-800 font-semibold">{part}</strong> : part))}
        </p>
      );
    });
  };

  return (
    <div className="space-y-8" id="business-impact-tab">
      
      {/* Intro Translation description */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs" id="translation-descriptor-card">
        <div className="flex items-center space-x-3 mb-3">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h2 className="font-display text-lg font-semibold text-slate-800">Retention Campaign Financial Simulator</h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed max-w-4xl">
          By translating statistical Churn Recall and Precision metrics into financial variables, you can calculate the exact Return on Investment (ROI) of targeted retention campaigns before deploying budget. Adjust the parameters below to configure your prospective campaign.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="simulator-grid-container">
        
        {/* Sliders Control Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs lg:col-span-4 space-y-6" id="sliders-control-card">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block">Simulation Inputs</span>

          {/* Slider 1: Campaign Cost */}
          <div id="cost-slider-group">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-700">Outreach Overhead</label>
              <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">${campaignCost} / customer</span>
            </div>
            <input
              type="range"
              min="2"
              max="100"
              step="1"
              value={campaignCost}
              onChange={e => setCampaignCost(parseInt(e.target.value))}
              className="w-full accent-indigo-600"
              id="campaign-cost-slider"
            />
            <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
              Fixed costs (creative production, SMS/Email delivery, agency billings) to target one risk profile.
            </span>
          </div>

          {/* Slider 2: Incentive Value */}
          <div id="incentive-slider-group">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-700">Incentive Offer Value</label>
              <span className="text-xs font-mono font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg">${incentiveValue} / converted</span>
            </div>
            <input
              type="range"
              min="5"
              max="250"
              step="5"
              value={incentiveValue}
              onChange={e => setIncentiveValue(parseInt(e.target.value))}
              className="w-full accent-amber-500"
              id="incentive-value-slider"
            />
            <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
              Direct dollar value (vouchers, discounts, free extension months) awarded ONLY to converted stayers.
            </span>
          </div>

          {/* Slider 3: Campaign Conversion */}
          <div id="conversion-slider-group">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-700">Campaign Success Rate</label>
              <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">{campaignConversion}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="80"
              step="1"
              value={campaignConversion}
              onChange={e => setCampaignConversion(parseInt(e.target.value))}
              className="w-full accent-emerald-500"
              id="conversion-success-slider"
            />
            <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
              The % of targeted churn-risk customers who successfully respond to the promotion and stay active.
            </span>
          </div>
        </div>

        {/* Dynamic ROI Readout cards */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6" id="simulator-roi-readout">
          
          {/* Card 1: Prevented Churn and Saved Revenue */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col justify-between" id="prevented-churn-revenue-card">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Prevented Bleed</span>
              <h3 className="text-3xl font-display font-bold text-slate-800 font-mono tracking-tight mb-2">
                {impact.preventedChurnCount} <span className="text-sm font-normal text-slate-400">clients saved</span>
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Based on active database segments, the ML model identifies <span className="font-semibold text-indigo-600">{impact.targetedCustomers}</span> targeted accounts. Converting {campaignConversion}% of genuine risks saves these profiles.
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between items-center text-xs">
              <span className="font-semibold text-emerald-800">Gross Value Reclaimed:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">${Math.round(impact.grossRevenueSaved).toLocaleString()}</span>
            </div>
          </div>

          {/* Card 2: Projected Net Savings and ROI */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col justify-between" id="net-savings-roi-card">
            <div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">Return on Campaign Spend</span>
              <h3 className="text-3xl font-display font-bold text-indigo-600 font-mono tracking-tight mb-2">
                {impact.roi.toFixed(1)}% <span className="text-sm font-normal text-slate-400">ROI</span>
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Total campaign cost is <span className="font-semibold">${Math.round(impact.campaignCostTotal + impact.incentiveCostTotal).toLocaleString()}</span>. Deducting this overhead leaves net reclaimed margins.
              </p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex justify-between items-center text-xs">
              <span className="font-semibold text-indigo-800">Projected Net Savings:</span>
              <span className="font-mono font-bold text-indigo-700 text-sm">${Math.round(impact.netSavings).toLocaleString()}</span>
            </div>
          </div>

          {/* Translation Insight banner */}
          <div className="col-span-1 md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 leading-relaxed" id="recall-precision-translation-box">
            <span className="font-semibold text-slate-700 block mb-1">How Model Recall & Precision Reduce Campaign Costs:</span>
            {impact.listAccuracyMsg}
          </div>

        </div>

      </div>

      {/* Strategic Report Section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6" id="strategic-report-section">
        
        {/* Generate Trigger block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6" id="generate-trigger-header">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-800 flex items-center">
              <Sparkles className="w-5 h-5 text-indigo-600 mr-2" />
              AI Strategic Board Briefing Generator
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Call Gemini server-side to synthesize model parameters, ROC AUC, decision tree splits, and ROI forecasts into a professional executive-ready presentation.
            </p>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-full md:w-auto py-3 px-6 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-display font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2 shrink-0"
            id="generate-strategic-briefing-btn"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Structuring Briefing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Draft Executive Board Briefing</span>
              </>
            )}
          </button>
        </div>

        {/* Loading messages block */}
        {loading && (
          <div className="py-24 flex flex-col items-center justify-center space-y-4" id="briefing-loading-screen">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>
            <div className="text-center">
              <span className="font-semibold text-slate-800 text-sm block">Analyzing customer behaviors...</span>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Filing BG/NBD coefficients, auditing supervised decision tree rules, and formatting financial ROI summaries for stakeholders.
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-start space-x-3 text-sm" id="briefing-error-box">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Strategic Generation Failed:</span>
              {error}
              <p className="text-xs text-rose-500 mt-2 leading-relaxed">
                Ensure process.env.GEMINI_API_KEY is properly initialized via the Settings secrets explorer in the AI Studio UI to activate server-side reporting.
              </p>
            </div>
          </div>
        )}

        {/* Display completed report */}
        {report && !loading && (
          <div className="rounded-xl border border-slate-100 shadow-xs overflow-hidden bg-slate-50/20" id="strategic-report-display">
            
            {/* Header controls for report */}
            <div className="flex justify-between items-center bg-slate-50 p-4 border-b border-slate-100 text-xs">
              <div className="flex items-center space-x-2 text-slate-500 font-medium">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Generated by Gemini 3.5-Flash</span>
              </div>

              <div className="flex items-center space-x-2" id="report-action-buttons">
                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  className="p-1.5 px-3 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium flex items-center space-x-1.5 transition-colors"
                  id="copy-briefing-btn"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Draft</span>
                    </>
                  )}
                </button>

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  className="p-1.5 px-3 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium flex items-center space-x-1.5 transition-colors"
                  id="download-briefing-btn"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download (.md)</span>
                </button>
              </div>
            </div>

            {/* Structured Text block */}
            <div className="p-8 max-w-3xl mx-auto prose prose-slate select-text" id="report-md-render">
              {renderFormattedReport(report)}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
