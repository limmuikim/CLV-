/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  customerId: string;
  date: string;
  amount: number;
  quantity?: number;
}

export interface RFMCustomer {
  customerId: string;
  frequency: number;       // Number of repeat transactions (total - 1)
  recency: number;         // Days between first and last purchase
  tenure: number;          // Days between first purchase and end of observation period
  monetaryValue: number;   // Average transaction value of repeat purchases (or overall average)
  totalSpend: number;      // Total spend of all transactions
  transactionCount: number;// Total number of transactions
  firstPurchaseDate: string;
  lastPurchaseDate: string;
  cohort: string;          // e.g., "2025-01" based on first purchase
}

export interface ModelParameters {
  r: number;
  alpha: number;
  a: number;
  b: number;
  p: number;
  q: number;
  gamma: number;
}

export interface PredictionResult {
  customerId: string;
  pAlive: number;                  // P(Alive) from BG/NBD
  expectedTransactions: number;    // E(X) from BG/NBD over target period
  expectedMonetaryValue: number;   // E(M) from Gamma-Gamma
  predictedCLV: number;            // CLV = E(X) * E(M) * Margin
  mlChurnRisk: number;             // Churn probability from Supervised ML (e.g. Logistic Regression)
  mlPredictedCLV: number;          // CLV prediction from Supervised ML (Linear Regression)
}

export interface ModelMetrics {
  // Statistical fit
  logLikelihood: number;
  aic: number;
  
  // Churn classification performance (ML vs ground truth)
  churnAccuracy: number;
  churnPrecision: number;
  churnRecall: number;
  churnF1: number;
  churnAuc: number;
  
  // CLV regression performance
  clvMae: number;
  clvR2: number;
}

export interface CohortData {
  cohortName: string; // "YYYY-MM"
  size: number;
  totalRevenue: number;
  retention: number[]; // Percentage of customers active in Month 0, 1, 2, ...
}

export interface BusinessMetrics {
  campaignCost: number;
  incentiveValue: number;
  campaignConversion: number;
  averageCAC: number;
  customerCount: number;
}

export interface APIConfig {
  endpointUrl: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  mapping: {
    customerId: string;
    date: string;
    amount: string;
  };
}
