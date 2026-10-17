/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction } from "../types";

// Generate realistic E-commerce transaction logs spanning 18 months
export function generateEcommerceSampleData(): Transaction[] {
  const transactions: Transaction[] = [];
  const startYear = 2025;
  const startMonth = 0; // January 2025
  const durationMonths = 18;

  // Let's create 250 customers with various acquisition months
  const customerCount = 250;
  
  // Base date is Jan 1, 2025
  const baseDate = new Date(startYear, startMonth, 1);
  const endPeriodDate = new Date(baseDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);

  for (let c = 1; c <= customerCount; c++) {
    const customerId = `CUST-${String(c).padStart(4, "0")}`;
    
    // Choose signup month randomly
    const signupMonthOffset = Math.floor(Math.random() * (durationMonths - 3)); // acquired at least 3 months ago
    const signupDate = new Date(baseDate.getTime() + signupMonthOffset * 30 * 24 * 60 * 60 * 1000 + Math.random() * 28 * 24 * 60 * 60 * 1000);

    // Customer characteristics
    // 3 segments: 
    // 1. High value/loyals (20%): purchase frequently (interval 15-30 days), higher ticket size ($80-$150)
    // 2. Average shoppers (50%): purchase occasionally (interval 45-90 days), ticket size ($30-$80)
    // 3. One-time/Churned (30%): purchase 1 or 2 times then dropout, ticket size ($15-$45)
    const rand = Math.random();
    let segment: "loyal" | "average" | "onetime";
    if (rand < 0.2) segment = "loyal";
    else if (rand < 0.7) segment = "average";
    else segment = "onetime";

    // First transaction (signup)
    let purchaseAmount = segment === "loyal" 
      ? 80 + Math.random() * 70 
      : segment === "average" 
        ? 30 + Math.random() * 50 
        : 15 + Math.random() * 30;

    transactions.push({
      customerId,
      date: signupDate.toISOString().split("T")[0],
      amount: Math.round(purchaseAmount * 100) / 100
    });

    // Generate repeat transactions based on segment retention rate
    let currentDate = new Date(signupDate);
    const maxPurchases = segment === "loyal" ? 18 : segment === "average" ? 6 : 2;
    let purchaseIntervalDays = segment === "loyal" 
      ? 15 + Math.floor(Math.random() * 20) 
      : segment === "average" 
        ? 40 + Math.floor(Math.random() * 60) 
        : 90 + Math.floor(Math.random() * 120);

    // Probability of churn at each step
    const churnProbability = segment === "loyal" ? 0.05 : segment === "average" ? 0.20 : 0.70;

    let purchases = 1;
    while (purchases < maxPurchases) {
      // Add purchase interval
      currentDate = new Date(currentDate.getTime() + purchaseIntervalDays * 24 * 60 * 60 * 1000);
      if (currentDate.getTime() > endPeriodDate.getTime()) {
        break; // Reached end of history
      }

      // Check if customer churned/dropped out before this transaction
      if (Math.random() < churnProbability) {
        break;
      }

      purchaseAmount = segment === "loyal" 
        ? 75 + Math.random() * 80 
        : segment === "average" 
          ? 25 + Math.random() * 60 
          : 15 + Math.random() * 20;

      transactions.push({
        customerId,
        date: currentDate.toISOString().split("T")[0],
        amount: Math.round(purchaseAmount * 100) / 100
      });

      purchases++;
      
      // Slight variation in purchase intervals
      purchaseIntervalDays = Math.max(7, purchaseIntervalDays + (Math.floor(Math.random() * 11) - 5));
    }
  }

  // Sort chronological
  return transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Generate realistic SaaS Subscription transaction logs
export function generateSaaSSampleData(): Transaction[] {
  const transactions: Transaction[] = [];
  const startYear = 2025;
  const durationMonths = 18;
  const customerCount = 150;

  const baseDate = new Date(startYear, 0, 1);
  const endPeriodDate = new Date(baseDate.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);

  for (let c = 1; c <= customerCount; c++) {
    const customerId = `SUB-${String(c).padStart(4, "0")}`;
    
    // Acquisition month
    const signupMonthOffset = Math.floor(Math.random() * (durationMonths - 2));
    const signupDate = new Date(baseDate.getTime() + signupMonthOffset * 30 * 24 * 60 * 60 * 1000 + Math.random() * 15 * 24 * 60 * 60 * 1000);

    // SaaS tiers: $29 (Basic), $79 (Pro), $249 (Enterprise)
    const tierRand = Math.random();
    let monthlyFee = 29;
    if (tierRand < 0.6) monthlyFee = 29;
    else if (tierRand < 0.9) monthlyFee = 79;
    else monthlyFee = 249;

    // First payment
    transactions.push({
      customerId,
      date: signupDate.toISOString().split("T")[0],
      amount: monthlyFee
    });

    // Monthly recurrence
    let currentDate = new Date(signupDate);
    // Lifetime in months based on a customer attrition probability
    const monthlyChurnRate = monthlyFee === 29 ? 0.08 : monthlyFee === 79 ? 0.04 : 0.02; // Enterprise churn is lowest
    
    let month = 1;
    while (true) {
      // Add 1 month
      currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
      if (currentDate.getTime() > endPeriodDate.getTime()) {
        break;
      }

      // Check for churn
      if (Math.random() < monthlyChurnRate) {
        break;
      }

      // Record monthly payment
      transactions.push({
        customerId,
        date: currentDate.toISOString().split("T")[0],
        amount: monthlyFee
      });

      month++;
    }
  }

  return transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
