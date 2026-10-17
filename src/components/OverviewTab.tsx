/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Users, DollarSign, RefreshCw, AlertTriangle, ArrowUpRight, ArrowDownRight, TrendingUp, HelpCircle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, Cell } from "recharts";
import { RFMCustomer, PredictionResult } from "../types";

interface OverviewTabProps {
  customers: RFMCustomer[];
  predictions: PredictionResult[];
  targetDays: number;
}

export default function OverviewTab({
  customers,
  predictions,
  targetDays
}: OverviewTabProps) {
  // 1. Calculate Aggregate Metrics
  const summaryStats = useMemo(() => {
    if (customers.length === 0) {
      return {
        totalCustomers: 0,
        historicalSpend: 0,
        projectedRevenue: 0,
        averageCLV: 0,
        projectedChurnRate: 0,
        activeCustomerCount: 0,
        churnRiskCount: 0
      };
    }

    const totalCustomers = customers.length;
    const historicalSpend = customers.reduce((sum, c) => sum + c.totalSpend, 0);
    const projectedRevenue = predictions.reduce((sum, p) => sum + p.predictedCLV, 0);
    const averageCLV = totalCustomers > 0 ? (historicalSpend + projectedRevenue) / totalCustomers : 0;

    // Churn Risk: Customers with probability of being alive < 50%
    const churnRiskCount = predictions.filter(p => p.pAlive < 0.50).length;
    const projectedChurnRate = (churnRiskCount / totalCustomers) * 100;
    const activeCustomerCount = totalCustomers - churnRiskCount;

    return {
      totalCustomers,
      historicalSpend,
      projectedRevenue,
      averageCLV,
      projectedChurnRate,
      activeCustomerCount,
      churnRiskCount
    };
  }, [customers, predictions]);

  // 2. Generate 12-Month Revenue Forecast Chart Data
  const forecastData = useMemo(() => {
    if (customers.length === 0 || predictions.length === 0) return [];

    const dataPoints = [];
    let cumulativeHistorical = summaryStats.historicalSpend;
    let cumulativeProjected = 0;

    // Distribute expected transactions over 12 months
    const monthlyDecayRates = [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.72, 0.68, 0.65, 0.62, 0.6, 0.58];

    for (let month = 1; month <= 12; month++) {
      // Calculate revenue expected for this month across all customers
      // For each customer, expected future transaction rate * average transaction value * monthly decaying rate
      let monthlyRevenue = 0;
      for (const p of predictions) {
        // scale expected Transactions (which is for targetDays, e.g. 90 days) to monthly equivalent (30 days)
        const baseMonthlyTransactions = p.expectedTransactions / (targetDays / 30);
        const monthlyTransactionsDecayed = baseMonthlyTransactions * (monthlyDecayRates[month - 1] || 0.5);
        monthlyRevenue += monthlyTransactionsDecayed * p.expectedMonetaryValue;
      }

      // Add a small safety factor for margins
      monthlyRevenue = Math.max(0, monthlyRevenue * 0.4); // adjusted for profit margin representation

      cumulativeProjected += monthlyRevenue;

      dataPoints.push({
        name: `Month ${month}`,
        "Monthly Forecast": Math.round(monthlyRevenue),
        "Cumulative Projected Value": Math.round(cumulativeHistorical + cumulativeProjected),
        "Baseline Target": Math.round(cumulativeHistorical + (summaryStats.historicalSpend * 0.15) * (month / 12))
      });
    }

    return dataPoints;
  }, [customers, predictions, summaryStats, targetDays]);

  // 3. Segment Customers into Tiers
  const tierDistribution = useMemo(() => {
    if (predictions.length === 0) return [];

    const segments = {
      "VIP (Loyals with >80% Health)": { count: 0, clvContribution: 0, color: "#4f46e5" },
      "Average Core (Steady purchases)": { count: 0, clvContribution: 0, color: "#10b981" },
      "At Risk (Dormant but High Spend)": { count: 0, clvContribution: 0, color: "#f59e0b" },
      "One-Timers (Single purchase, high churn)": { count: 0, clvContribution: 0, color: "#ef4444" }
    };

    for (let i = 0; i < predictions.length; i++) {
      const p = predictions[i];
      const c = customers.find(cust => cust.customerId === p.customerId);
      if (!c) continue;

      const totalValue = c.totalSpend + p.predictedCLV;

      if (p.pAlive >= 0.80 && c.frequency >= 3) {
        segments["VIP (Loyals with >80% Health)"].count++;
        segments["VIP (Loyals with >80% Health)"].clvContribution += totalValue;
      } else if (p.pAlive >= 0.50 && c.frequency >= 1) {
        segments["Average Core (Steady purchases)"].count++;
        segments["Average Core (Steady purchases)"].clvContribution += totalValue;
      } else if (p.pAlive < 0.50 && c.totalSpend > 100) {
        segments["At Risk (Dormant but High Spend)"].count++;
        segments["At Risk (Dormant but High Spend)"].clvContribution += totalValue;
      } else {
        segments["One-Timers (Single purchase, high churn)"].count++;
        segments["One-Timers (Single purchase, high churn)"].clvContribution += totalValue;
      }
    }

    return Object.entries(segments).map(([name, val]) => ({
      name,
      Count: val.count,
      "Total Segment CLV Value ($)": Math.round(val.clvContribution),
      color: val.color
    }));
  }, [customers, predictions]);

  const currencyFormatter = (value: number) => {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-8" id="overview-tab-container">
      
      {/* KPI Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="kpi-grid">
        
        {/* KPI 1: Active Database Size */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs relative overflow-hidden" id="kpi-total-customers">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <span className="flex items-center text-xs text-emerald-600 bg-emerald-50 font-medium px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              <span>+4.2% MoM</span>
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Total Active Customers</span>
          <span className="text-3xl font-display font-bold text-slate-800 font-mono tracking-tight">
            {summaryStats.totalCustomers.toLocaleString()}
          </span>
          <p className="text-xs text-slate-500 mt-2">
            <span className="font-semibold text-indigo-600">{summaryStats.activeCustomerCount}</span> active vs <span className="font-semibold text-amber-600">{summaryStats.churnRiskCount}</span> at-risk.
          </p>
        </div>

        {/* KPI 2: Total Historical Billings */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs relative overflow-hidden" id="kpi-historical-spend">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="flex items-center text-xs text-emerald-600 bg-emerald-50 font-medium px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              <span>+12.8% YoY</span>
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Historical Revenue</span>
          <span className="text-3xl font-display font-bold text-slate-800 font-mono tracking-tight">
            {currencyFormatter(summaryStats.historicalSpend)}
          </span>
          <p className="text-xs text-slate-500 mt-2">
            Aggregated gross value of all transactions in dataset.
          </p>
        </div>

        {/* KPI 3: Projected Future Add-on */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs relative overflow-hidden" id="kpi-projected-clv">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
              <RefreshCw className="w-6 h-6 animate-spin-slow" />
            </div>
            <span className="text-xs text-indigo-600 bg-indigo-50 font-semibold px-2 py-0.5 rounded-full flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
              <span>{targetDays}d Forecast</span>
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Projected Future Revenue</span>
          <span className="text-3xl font-display font-bold text-indigo-600 font-mono tracking-tight">
            {currencyFormatter(summaryStats.projectedRevenue)}
          </span>
          <p className="text-xs text-slate-500 mt-2">
            Predicted statistical revenue addition over the next <span className="font-semibold">{targetDays} days</span>.
          </p>
        </div>

        {/* KPI 4: Churn/At-Risk Rate */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs relative overflow-hidden" id="kpi-churn-rate">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            {summaryStats.projectedChurnRate > 35 ? (
              <span className="flex items-center text-xs text-rose-600 bg-rose-50 font-medium px-2 py-0.5 rounded-full">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                <span>High Risk</span>
              </span>
            ) : (
              <span className="flex items-center text-xs text-emerald-600 bg-emerald-50 font-medium px-2 py-0.5 rounded-full">
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                <span>Stable</span>
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Projected Churn Rate</span>
          <span className={`text-3xl font-display font-bold font-mono tracking-tight ${
            summaryStats.projectedChurnRate > 35 ? "text-amber-600" : "text-emerald-600"
          }`}>
            {summaryStats.projectedChurnRate.toFixed(1)}%
          </span>
          <p className="text-xs text-slate-500 mt-2">
            Based on BG/NBD probability of being alive decay indexes.
          </p>
        </div>
      </div>

      {/* Main Graph: Cumulative Projected Value and Monthly Forecasts */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs" id="forecast-chart-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-800">12-Month Predictive Revenue Trajectory</h2>
            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              Statistical model overlay showing expected monthly cash inflow decay against overall business cumulative lifetime valuation targets.
            </p>
          </div>
          <div className="flex items-center space-x-4 mt-3 md:mt-0 bg-slate-50 p-2 rounded-lg text-xs border border-slate-100">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-indigo-600 rounded-xs" />
              <span className="text-slate-600 font-medium">Cumulative Projected CLV</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-emerald-500 rounded-xs" />
              <span className="text-slate-600 font-medium">Monthly Incremental Cash</span>
            </div>
          </div>
        </div>

        <div className="h-96 w-full" id="cumulative-clv-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.01}/>
                </linearGradient>
                <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis yAxisId="left" stroke="#4f46e5" fontSize={11} tickFormatter={currencyFormatter} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} tickFormatter={currencyFormatter} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}
                formatter={(value: any, name: any) => [currencyFormatter(value as number), name]}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px", fontFamily: "Inter" }} />
              <Area yAxisId="left" type="monotone" dataKey="Cumulative Projected Value" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCumulative)" />
              <Area yAxisId="right" type="monotone" dataKey="Monthly Forecast" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorMonthly)" />
              <Area yAxisId="left" type="monotone" dataKey="Baseline Target" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Segment Distribution Dashboard row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="segmentation-row">
        
        {/* Segment breakdown Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs lg:col-span-7" id="segment-dist-card">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-slate-800">Customer Segments by Overall CLV Concentration</h2>
            <p className="text-xs text-slate-500 mt-1">
              Visualizes which segment of your database represents the highest share of combined historical & predicted future billings.
            </p>
          </div>

          <div className="h-80 w-full" id="segment-clv-bar-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierDistribution} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={currencyFormatter} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={120} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)" }}
                  formatter={(value: any) => [currencyFormatter(value as number), "Overall Value"]}
                />
                <Bar dataKey="Total Segment CLV Value ($)" radius={[0, 8, 8, 0]}>
                  {tierDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Informative explanation text panel (Actionable Insights) */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 lg:col-span-5 flex flex-col justify-between" id="insight-summary-panel">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 mb-3">
              <TrendingUp className="w-5 h-5" />
              <h3 className="font-display font-semibold text-sm">Key Strategic Takeaways</h3>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-white rounded-xl border border-slate-100 flex items-start space-x-3">
                <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2 shrink-0" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">VIP Concentration:</strong> Your top segment represents high loyalty. However, because they account for a substantial percentage of total CLV, any drop in their retention is highly punitive.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-100 flex items-start space-x-3">
                <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 shrink-0" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">At-Risk Core:</strong> Customers with high historical spend who haven't ordered recently represent immediate retention targets. A standard reactivation campaign could save significant margin.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-100 flex items-start space-x-3">
                <div className="w-2 h-2 bg-rose-500 rounded-full mt-2 shrink-0" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">One-Timer Bleed:</strong> Customers with frequency of 0 are decaying rapidly. To optimize acquisition CAC, consider post-purchase onboarding series to encourage a second purchase early.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center">
              <HelpCircle className="w-4 h-4 mr-1 text-slate-300" />
              <span>Calculated over {predictions.length} profiles</span>
            </span>
            <span className="font-mono">Updated: Just Now</span>
          </div>
        </div>

      </div>

    </div>
  );
}
