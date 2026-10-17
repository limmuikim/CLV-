/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Layers, Calendar, Users, HelpCircle, ArrowRight, Activity } from "lucide-react";
import { RFMCustomer, CohortData } from "../types";
import { generateCohortData } from "../utils/analytics";

interface CohortTabProps {
  customers: RFMCustomer[];
}

export default function CohortTab({ customers }: CohortTabProps) {
  const cohortRows = useMemo(() => {
    return generateCohortData(customers);
  }, [customers]);

  // Average retention across all cohorts for the bottom baseline row
  const averageRetention = useMemo(() => {
    if (cohortRows.length === 0) return Array(12).fill(0);
    const avgs = Array(12).fill(0);
    
    for (let month = 0; month < 12; month++) {
      let sum = 0;
      let count = 0;
      for (const row of cohortRows) {
        if (row.retention[month] !== undefined) {
          sum += row.retention[month];
          count++;
        }
      }
      avgs[month] = count > 0 ? sum / count : 0;
    }
    return avgs;
  }, [cohortRows]);

  // Dynamic heat map coloring based on retention value
  const getHeatmapStyle = (value: number) => {
    if (value === 100) return { backgroundColor: "rgba(79, 70, 229, 0.9)", color: "#ffffff" };
    if (value >= 70) return { backgroundColor: `rgba(79, 70, 229, ${0.4 + (value / 200)})`, color: "#ffffff" };
    if (value >= 40) return { backgroundColor: `rgba(79, 70, 229, ${0.2 + (value / 250)})`, color: "#1e293b" };
    if (value >= 15) return { backgroundColor: `rgba(79, 70, 229, ${0.05 + (value / 300)})`, color: "#334155" };
    return { backgroundColor: "rgba(241, 245, 249, 0.5)", color: "#64748b" };
  };

  return (
    <div className="space-y-8" id="cohort-tab-container">
      
      {/* Intro Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs" id="cohort-intro-card">
        <div className="flex items-center space-x-3 mb-3">
          <Activity className="w-5 h-5 text-indigo-600" />
          <h2 className="font-display text-lg font-semibold text-slate-800">Acquisition Cohort Retention Heatmap</h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed max-w-4xl">
          Cohort analysis groups customers by their signup month and tracks their repurchase rates over their lifecycle. A healthy database displays steady horizontal coloring (sustainable repeat buying), while rapid vertical color fading warns of early post-acquisition fatigue.
        </p>
      </div>

      {/* Heatmap Table */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs overflow-hidden" id="cohort-heatmap-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-3 sticky left-0 bg-white z-10 w-24">Cohort Month</th>
                <th className="py-4 px-3 w-20 text-center">Size</th>
                <th className="py-4 px-3 w-24 text-right">Revenue</th>
                {Array(12).fill(0).map((_, i) => (
                  <th key={i} className="py-4 px-2 text-center w-16">M{i}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs font-mono text-slate-600">
              {cohortRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400 font-medium">
                    No transactions loaded to assemble cohorts.
                  </td>
                </tr>
              ) : (
                cohortRows.map(row => (
                  <tr key={row.cohortName} className="hover:bg-slate-50/50 transition-colors" id={`cohort-row-${row.cohortName}`}>
                    {/* Month Name */}
                    <td className="py-3 px-3 font-display font-semibold text-slate-800 sticky left-0 bg-white border-r border-slate-100 z-10">
                      {row.cohortName}
                    </td>
                    
                    {/* Cohort size */}
                    <td className="py-3 px-3 text-center text-slate-500">
                      {row.size}
                    </td>

                    {/* Cohort revenue */}
                    <td className="py-3 px-3 text-right text-slate-500 pr-4">
                      ${row.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>

                    {/* Month cells */}
                    {row.retention.map((pct, monthIdx) => {
                      const cellStyle = getHeatmapStyle(pct);
                      return (
                        <td
                          key={monthIdx}
                          style={cellStyle}
                          className="py-3 px-2 text-center font-semibold transition-all duration-300 relative group border-r border-b border-white/40"
                          id={`cell-${row.cohortName}-M${monthIdx}`}
                        >
                          {pct.toFixed(0)}%
                          
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg z-50 w-28 text-center pointer-events-none">
                            <span className="font-semibold">{pct.toFixed(1)}% Active</span>
                            <span className="text-slate-400 mt-0.5">Month {monthIdx}</span>
                            <span className="text-slate-400">
                              {Math.round(row.size * (pct / 100))} of {row.size} clients
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}

              {/* Bottom Average / Baseline row */}
              {cohortRows.length > 0 && (
                <tr className="border-t border-slate-200 bg-slate-50/70 font-semibold" id="cohort-averages-row">
                  <td className="py-4 px-3 font-display text-slate-800 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">
                    Average Baseline
                  </td>
                  <td className="py-4 px-3 text-center text-slate-500">
                    {cohortRows.reduce((sum, r) => sum + r.size, 0)}
                  </td>
                  <td className="py-4 px-3 text-right text-slate-500 pr-4">
                    ${cohortRows.reduce((sum, r) => sum + r.totalRevenue, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  {averageRetention.map((avgPct, monthIdx) => (
                    <td
                      key={monthIdx}
                      style={getHeatmapStyle(avgPct)}
                      className="py-4 px-2 text-center font-bold border-r border-white/60"
                      id={`cell-avg-M${monthIdx}`}
                    >
                      {avgPct.toFixed(0)}%
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
