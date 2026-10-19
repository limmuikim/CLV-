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
  getUserByEmail,
  createAccessRequest,
  CREATOR_EMAIL
} from "./src/db/operations.ts";
import { createSessionToken } from "./src/lib/jwt.ts";
import { buildStrategicPrompt, generateLocalStrategicReport } from "./src/lib/strategicReportGenerator.ts";

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

// Public endpoint: Submit an access request
app.post("/api/auth/request-access", async (req, res) => {
  try {
    const { email, name, note } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRecord = await createAccessRequest(cleanEmail, name, note);
    const isCreator = cleanEmail === CREATOR_EMAIL.toLowerCase();

    res.json({
      success: true,
      user: userRecord,
      isCreator,
      isApproved: isCreator || userRecord.status === 'approved',
      creatorEmail: CREATOR_EMAIL,
      message: isCreator 
        ? "Welcome, Creator! You have full administrative access." 
        : `Your access request has been recorded. Please also drop an email to ${CREATOR_EMAIL} to expedite approval.`
    });
  } catch (error: any) {
    console.error("Access request error:", error);
    res.status(500).json({ error: error.message || "Failed to process access request" });
  }
});

// Direct email-based login endpoint (for Creator and pre-approved team members)
app.post(["/api/auth/login-email", "/api/auth/login", "/api/login"], async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isCreator = cleanEmail === CREATOR_EMAIL.toLowerCase();

    // Look up or register user
    let userRecord = await getUserByEmail(cleanEmail);
    if (!userRecord) {
      if (isCreator) {
        userRecord = await getOrCreateUser(`creator_${Date.now()}`, cleanEmail);
      } else {
        // Automatically create access request for new user so they can access read-only mode and await creator approval
        userRecord = await createAccessRequest(cleanEmail, cleanEmail.split('@')[0], "Email login access registration");
      }
    }

    // If creator, ensure approved
    if (isCreator && (userRecord.status !== 'approved' || userRecord.role !== 'admin')) {
      userRecord = await getOrCreateUser(userRecord.uid, cleanEmail);
    }

    const isApproved = isCreator || userRecord.status === 'approved';

    // Generate signed session token
    const token = createSessionToken({
      uid: userRecord.uid,
      email: cleanEmail,
      role: userRecord.role,
      status: userRecord.status
    });

    res.json({
      success: true,
      token,
      user: {
        uid: userRecord.uid,
        email: cleanEmail,
        displayName: isCreator ? "Mui Kim (Creator)" : cleanEmail.split('@')[0],
      },
      dbUser: userRecord,
      isCreator,
      isApproved,
      creatorEmail: CREATOR_EMAIL
    });
  } catch (error: any) {
    console.error("Email login error:", error);
    res.status(500).json({ error: error.message || "Login failed" });
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
  const payload = req.body || {};

  // Check if API key is configured
  const currentKey = process.env.GEMINI_API_KEY || geminiApiKey;

  if (!currentKey) {
    const report = generateLocalStrategicReport(payload);
    return res.json({ 
      report, 
      source: "analytical_engine",
      notice: "Generated with embedded Strategic Analysis Engine. Configure GEMINI_API_KEY to activate live Gemini AI reporting."
    });
  }

  try {
    const client = new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = buildStrategicPrompt(payload);

    // Use fast and supported gemini-2.5-flash
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    res.json({ 
      report: response.text,
      source: "gemini-2.5-flash"
    });
  } catch (error: any) {
    console.warn("Gemini generation failed or timed out, synthesizing report via analytical engine:", error?.message);
    const fallbackReport = generateLocalStrategicReport(payload);
    res.json({ 
      report: fallbackReport,
      source: "analytical_engine_fallback",
      error: error?.message || "Service temporarily unavailable"
    });
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
