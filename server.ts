/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { requireAuth, requireApprovedAccess, requireAdmin, AuthRequest } from "./src/middleware/auth.ts";
import { 
  getOrCreateUser, 
  getUserTransactions, 
  insertTransactions, 
  deleteUserTransactions,
  deleteTransactionById,
  saveSnapshots, 
  getLatestSnapshots,
  getAllUsers,
  updateUserStatus,
  CREATOR_EMAIL
} from "./src/db/operations.ts";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize Gemini Client server-side
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    geminiActive: !!ai,
    databaseConfigured: !!process.env.SQL_HOST 
  });
});

// Authenticate user & sync to Cloud SQL with approval status check
app.get("/api/user/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || "unknown@user.com";
    if (!uid) {
      return res.status(401).json({ error: "Missing user identification" });
    }
    const userRecord = await getOrCreateUser(uid, email);
    const isCreator = email.trim().toLowerCase() === CREATOR_EMAIL.toLowerCase();
    res.json({ 
      success: true, 
      user: userRecord,
      isCreator,
      isApproved: isCreator || userRecord.status === 'approved',
      creatorEmail: CREATOR_EMAIL
    });
  } catch (error: any) {
    console.error("User sync error:", error);
    res.status(500).json({ error: error.message || "Failed to authenticate user with database" });
  }
});

// Admin endpoint: List all registered users (Creator only)
app.get("/api/admin/users", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userList = await getAllUsers();
    res.json({ users: userList });
  } catch (error: any) {
    console.error("Fetch all users error:", error);
    res.status(500).json({ error: error.message || "Failed to query user directory" });
  }
});

// Admin endpoint: Update user access status (Creator only)
app.post("/api/admin/users/:targetUid/status", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { targetUid } = req.params;
    const { status } = req.body;
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ error: "Invalid status value. Must be 'approved', 'pending', or 'rejected'." });
    }
    const updated = await updateUserStatus(targetUid, status);
    res.json({ success: true, user: updated });
  } catch (error: any) {
    console.error("Update user status error:", error);
    res.status(500).json({ error: error.message || "Failed to update user status" });
  }
});

// Get continuous transactions for authenticated user
app.get("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const records = await getUserTransactions(uid);
    res.json({ transactions: records });
  } catch (error: any) {
    console.error("Fetch transactions error:", error);
    res.status(500).json({ error: error.message || "Failed to query database transactions" });
  }
});

// Batch insert transactions into Cloud SQL (Protected: requires Creator or Approved user)
app.post("/api/transactions", requireAuth, requireApprovedAccess, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const email = req.user?.email || "unknown@user.com";
    await getOrCreateUser(uid, email);

    const { transactions: newTxs, clearExisting } = req.body;
    if (!Array.isArray(newTxs)) {
      return res.status(400).json({ error: "Transactions payload must be an array" });
    }

    if (clearExisting) {
      await deleteUserTransactions(uid);
    }

    const inserted = await insertTransactions(uid, newTxs);
    res.json({ success: true, insertedCount: inserted.length });
  } catch (error: any) {
    console.error("Insert transactions error:", error);
    res.status(500).json({ error: error.message || "Failed to store transactions in database" });
  }
});

// Delete user's transactions (Protected: requires Creator or Approved user)
app.delete("/api/transactions", requireAuth, requireApprovedAccess, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    await deleteUserTransactions(uid);
    res.json({ success: true, message: "Transactions wiped successfully." });
  } catch (error: any) {
    console.error("Delete transactions error:", error);
    res.status(500).json({ error: error.message || "Failed to wipe database transactions" });
  }
});

// Delete single transaction by ID (Protected: requires Creator or Approved user)
app.delete("/api/transactions/:id", requireAuth, requireApprovedAccess, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const txId = parseInt(req.params.id);
    if (isNaN(txId)) {
      return res.status(400).json({ error: "Invalid transaction ID parameter" });
    }
    const deleted = await deleteTransactionById(uid, txId);
    res.json({ success: true, deleted: deleted[0] });
  } catch (error: any) {
    console.error("Delete single transaction error:", error);
    res.status(500).json({ error: error.message || "Failed to delete transaction" });
  }
});

// Save calculated CLV & Churn model snapshots (Protected: requires Creator or Approved user)
app.post("/api/snapshots", requireAuth, requireApprovedAccess, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { snapshots } = req.body;
    if (!Array.isArray(snapshots)) {
      return res.status(400).json({ error: "Snapshots payload must be an array" });
    }
    const saved = await saveSnapshots(uid, snapshots);
    res.json({ success: true, savedCount: saved.length });
  } catch (error: any) {
    console.error("Save snapshots error:", error);
    res.status(500).json({ error: error.message || "Failed to save customer model snapshots" });
  }
});

// Get calculated snapshots
app.get("/api/snapshots", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const snapshots = await getLatestSnapshots(uid);
    res.json({ snapshots });
  } catch (error: any) {
    console.error("Fetch snapshots error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch model snapshots" });
  }
});

// Continuous Webhook API endpoint: allows automated external ingestion (e.g. from Shopify, Stripe, Zapier)
app.post("/api/webhook/orders", async (req, res) => {
  try {
    const { targetUserId, orderId, customerId, amount, date } = req.body;
    if (!targetUserId || !customerId || !amount) {
      return res.status(400).json({ 
        error: "Missing required fields: targetUserId, customerId, and amount are required." 
      });
    }

    const orderDate = date || new Date().toISOString().split("T")[0];
    const txId = orderId || `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const inserted = await insertTransactions(targetUserId, [{
      transactionId: txId,
      customerId,
      date: orderDate,
      amount: parseFloat(amount),
      source: "webhook"
    }]);

    res.json({ 
      success: true, 
      message: "Order successfully recorded to live Cloud SQL database",
      transaction: inserted[0]
    });
  } catch (error: any) {
    console.error("Webhook ingestion error:", error);
    res.status(500).json({ error: error.message || "Failed to record incoming order" });
  }
});

// AI Strategic Summary generation endpoint
app.post("/api/analyze", async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets."
      });
    }

    const {
      datasetType,
      customerCount,
      totalSpend,
      bgnbdParams,
      mlMetrics,
      rules,
      businessImpact,
      targetDays
    } = req.body;

    const prompt = `
You are an expert Chief Marketing Officer (CMO) and Senior Business Analyst. Your job is to translate complex mathematical, statistical, and Machine Learning outcomes into a highly persuasive, plain-English strategic narrative for non-technical stakeholders (e.g., CEOs, Product Managers, Board Members).

Here are the inputs from our analytic modeling engine:

1. DATASET PROFILE:
- Type: ${datasetType}
- Size: ${customerCount} total customers analyzed
- Total Historical Value: $${(totalSpend || 0).toLocaleString()}

2. STATISTICAL BG/NBD PARAMETERS:
- Transaction Rate Shape (r): ${bgnbdParams.r.toFixed(4)}
- Transaction Rate Scale (alpha): ${bgnbdParams.alpha.toFixed(4)}
- Dropout Probability Beta Shape (a): ${bgnbdParams.a.toFixed(4)}
- Dropout Probability Beta Scale (b): ${bgnbdParams.b.toFixed(4)}
- Gamma-Gamma Scale parameter (p): ${bgnbdParams.p?.toFixed(4) || "6.2"}
- Gamma-Gamma Shape parameter (q): ${bgnbdParams.q?.toFixed(4) || "3.6"}
- Gamma-Gamma Monetary parameter (gamma): ${bgnbdParams.gamma?.toFixed(4) || "15.4"}
*Explain what these parameters imply about customer purchase frequency and how fast customers are dropping out, in conversational, plain English.*

3. MACHINE LEARNING CHURN & CLV PERFORMANCE METRICS:
- Supervised Attrition Accuracy: ${(mlMetrics.churnAccuracy * 100).toFixed(1)}%
- Supervised Attrition Precision: ${(mlMetrics.churnPrecision * 100).toFixed(1)}%
- Supervised Attrition Recall (Sensitivity): ${(mlMetrics.churnRecall * 100).toFixed(1)}%
- Area Under ROC Curve (AUC): ${(mlMetrics.churnAuc * 100).toFixed(1)}%
- Future CLV Regression MAE: $${(mlMetrics.clvMae || 0).toFixed(2)}
*Translate these technical metrics into their business equivalent! Why does a Recall of ${(mlMetrics.churnRecall * 100).toFixed(1)}% matter for cost-efficiency? Why is Precision crucial for preserving promotional budget?*

4. SUPERVISED DECISION TREE RULES FOR ATTRITION:
${(rules || []).map((rule: string) => `- ${rule}`).join("\n")}

5. BUSINESS IMPACT & CAMPAIGN CALCULATIONS (for a prospective retention campaign):
- Campaign Cost Per Customer: $${businessImpact.campaignCost}
- Incentive Value Offered: $${businessImpact.incentiveValue}
- Expected Retention Campaign Success/Conversion: ${businessImpact.campaignConversion}%
- Overall Churn Rate of Pool: ${(businessImpact.currentChurnRate * 100).toFixed(1)}%
- Total Churn-Risk Targets Detected: ${businessImpact.targetedCustomers}
- Estimated Prevented Churners: ${businessImpact.preventedChurnCount}
- Gross Revenue Saved: $${(businessImpact.grossRevenueSaved || 0).toLocaleString()}
- Total Cost (Marketing + Redeemed Incentives): $${(businessImpact.campaignCostTotal + businessImpact.incentiveCostTotal).toLocaleString()}
- Projected Net Savings: $${(businessImpact.netSavings || 0).toLocaleString()}
- Expected ROI: ${(businessImpact.roi || 0).toFixed(1)}%

Please synthesize these inputs into a beautifully formatted Strategic Briefing (using elegant Markdown structure, no technical jargon or math symbols like math blocks, just standard plain text formatted with bold headings and structured bullet points).

Structure the briefing with these exact sections:
1. ### 📊 EXECUTIVE SUMMARY
   - Brief synthesis of overall customer health and the forecast for the next ${targetDays} days.
2. ### 🧠 DECODING CUSTOMER BEHAVIOR (BG/NBD & Gamma-Gamma Interpretation)
   - Explain what the statistical parameters mean regarding customer transaction velocities and attrition rates. (e.g., does our cohort have a high initial purchase impulse but rapid decay, or a slow but steady pace?)
3. ### 🎯 BRIDGING THE GAP: ML METRICS AS BUSINESS VALUES
   - Explicitly translate the Churn Model's Precision, Recall, and AUC-ROC into tangible dollars, saved hours, and targeted marketing efficiencies. Demonstrate how the machine learning classifier outperforms a generic "blast to all" marketing strategy.
4. ### 🗺️ ACTIONABLE RETENTION PLAYBOOK
   - Provide 3 distinct, highly creative, and highly specific campaign recommendations based directly on the Decision Tree rules. Give each campaign a professional title, specify the exact target cohort, and outline the incentive strategy.
5. ### 🚀 REVENUE & ROI FORECASTS
   - Final summary of the projected ROI (${(businessImpact.roi || 0).toFixed(1)}%) and clear steps for the executive sponsor to greenlight this retention strategy.

Keep the tone highly professional, strategic, clear, and reassuring. Do not use complex mathematical notation; use standard dollar and percentage notations.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Gemini strategic report generation failed:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Start server and handle Vite development vs production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
